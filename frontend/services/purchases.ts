// ============================================================
// LocoSnap — In-App Purchases Service
// Thin wrapper around RevenueCat. Fail silently if keys missing.
// All operations are non-blocking and degrade gracefully.
// ============================================================

import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo,
  SubscriptionOption,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from "react-native-purchases";
import { Platform } from "react-native";
import { supabase } from "../config/supabase";
import { track, captureError } from "./analytics";

// ── Config ───────────────────────────────────────────────────

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";

const PRO_ENTITLEMENT = "pro";

// Play win-back: the `winback-annual-33off` offer (1yr single payment) is
// tagged `winback-annual` on the annual base plan. Developer-determined
// eligibility means Google won't auto-surface it — the app selects it.
const WINBACK_ANNUAL_TAG = "winback-annual";

// ── State ────────────────────────────────────────────────────

let initialized = false;

// ── Initialization ───────────────────────────────────────────

export function initPurchases(): void {
  if (initialized) return;

  const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;

  if (!apiKey) {
    console.log("[PURCHASES] Disabled (no API key)");
    return;
  }

  try {
    Purchases.configure({ apiKey });
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    initialized = true;
    console.log("[PURCHASES] RevenueCat initialized");
  } catch (error) {
    console.warn("[PURCHASES] Init failed:", (error as Error).message);
  }
}

// ── RevenueCat User Identity ─────────────────────────────────

export async function loginRevenueCat(userId: string): Promise<void> {
  if (!initialized) return;

  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.warn("[PURCHASES] Login failed:", (error as Error).message);
  }
}

export async function logoutRevenueCat(): Promise<void> {
  if (!initialized) return;

  try {
    await Purchases.logOut();
  } catch (error) {
    console.warn("[PURCHASES] Logout failed:", (error as Error).message);
  }
}

// ── Entitlement Check ────────────────────────────────────────

export async function checkEntitlements(): Promise<boolean> {
  if (!initialized) return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  } catch {
    return false;
  }
}

// ── Pro entitlement detail ──────────────────────────────────
// Phase F — expiring-soon banner needs expirationDate + willRenew
// to decide whether to show. checkEntitlements() only returns a
// boolean; this returns the full structured state so the UI can
// compute days-remaining locally.
//
// Returns null only on RevenueCat error / not-initialised. Legacy
// manually-granted Pro users (profile.is_pro=true with no RC
// entitlement) come back as { isPro: false, expirationDate: null,
// willRenew: false } — the banner hides on null expirationDate so
// they're correctly excluded.
export interface ProEntitlementInfo {
  isPro: boolean;
  expirationDate: string | null;
  willRenew: boolean;
}

export async function getProEntitlementInfo(): Promise<ProEntitlementInfo | null> {
  if (!initialized) return null;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const ent = customerInfo.entitlements.active[PRO_ENTITLEMENT];
    if (!ent) {
      return { isPro: false, expirationDate: null, willRenew: false };
    }
    return {
      isPro: true,
      expirationDate: ent.expirationDate ?? null,
      willRenew: ent.willRenew ?? false,
    };
  } catch {
    return null;
  }
}

// ── Sync Pro Status ──────────────────────────────────────────
// Check RevenueCat entitlement and update Supabase is_pro.
// Called on app launch and after profile fetch to reconcile.

export async function syncProStatus(userId: string): Promise<boolean> {
  // Beta/preview builds: all users get Pro for free to test all features
  if (process.env.EXPO_PUBLIC_BETA_PRO === "true") {
    await supabase.from("profiles").update({ is_pro: true }).eq("id", userId);
    return true;
  }

  if (!initialized) return false;

  try {
    const isPro = await checkEntitlements();

    // Only write back to Supabase when RevenueCat grants Pro.
    // Never let a RevenueCat "false" override a manually-granted is_pro.
    if (isPro) {
      await supabase
        .from("profiles")
        .update({ is_pro: true })
        .eq("id", userId);
    }

    return isPro;
  } catch (error) {
    console.warn("[PURCHASES] Sync failed:", (error as Error).message);
    return false;
  }
}

// ── Get Offerings ────────────────────────────────────────────

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  if (!initialized) return null;

  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.warn("[PURCHASES] Get offerings failed:", (error as Error).message);
    return null;
  }
}

// ── Purchase ─────────────────────────────────────────────────

export async function purchasePro(
  packageToPurchase: PurchasesPackage
): Promise<boolean> {
  if (!initialized) return false;

  try {
    track("purchase_started", {
      package_id: packageToPurchase.identifier,
    });

    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    const isPro =
      customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      track("purchase_completed", {
        product_id: packageToPurchase.product.identifier,
        price: packageToPurchase.product.priceString,
      });
    }

    return isPro;
  } catch (error: any) {
    // User cancelled — not an error
    if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return false;
    }

    track("purchase_failed", { error: error.message });
    captureError(error, { context: "purchasePro" });
    throw error;
  }
}

// ── Purchase Blueprint Credits (Consumable) ─────────────────

export async function purchaseBlueprintCredits(
  packageToPurchase: PurchasesPackage
): Promise<boolean> {
  if (!initialized) return false;

  try {
    track("blueprint_credit_purchase_started", {
      package_id: packageToPurchase.identifier,
    });

    await Purchases.purchasePackage(packageToPurchase);

    track("blueprint_credit_purchase_completed", {
      product_id: packageToPurchase.product.identifier,
      price: packageToPurchase.product.priceString,
    });

    return true;
  } catch (error: any) {
    if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return false;
    }

    track("blueprint_credit_purchase_failed", { error: error.message });
    captureError(error, { context: "purchaseBlueprintCredits" });
    throw error;
  }
}

// ── Play Win-Back (Android only) ─────────────────────────────
// Apple auto-surfaces its own win-back offer with no app code, so these
// helpers are Android-only. They find the `winback-annual`-tagged
// subscriptionOption on the annual base plan and let an eligible lapsed
// user buy 1 year of Pro at the discounted single-payment price.

// Find the annual product's win-back subscriptionOption by tag. Returns
// null on iOS, when not initialised, when offerings/annual product are
// missing, or when no option carries the tag — caller falls back to the
// normal full-price plan list on null.
export async function getWinBackAnnualOption(): Promise<SubscriptionOption | null> {
  if (!initialized) return null;
  if (Platform.OS !== "android") return null;

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings?.current?.availablePackages ?? [];
    // Prefer the canonical ANNUAL package type; only fall back to a
    // substring match if no standard annual package exists, so a custom
    // package whose identifier merely contains "annual" can never win
    // over the real annual product.
    const annual =
      packages.find((p) => p.packageType === "ANNUAL") ??
      packages.find((p) => p.identifier.toLowerCase().includes("annual"));
    const options = annual?.product?.subscriptionOptions ?? null;
    if (!options) return null;
    return (
      options.find((o) => o.tags.includes(WINBACK_ANNUAL_TAG)) ?? null
    );
  } catch (error) {
    console.warn(
      "[PURCHASES] Win-back option lookup failed:",
      (error as Error).message
    );
    return null;
  }
}

// True only when the user previously had the `pro` entitlement and it has
// now expired (lapsed). Lifetime / never-expiring entitlements and active
// subs return false. Android-only (iOS uses Apple's native win-back).
export async function isLapsedProEligible(): Promise<boolean> {
  if (!initialized) return false;
  if (Platform.OS !== "android") return false;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const ent = customerInfo.entitlements.all[PRO_ENTITLEMENT];
    if (!ent) return false;
    if (ent.isActive) return false;
    if (!ent.expirationDate) return false; // lifetime → not a lapse
    return Date.parse(ent.expirationDate) < Date.now();
  } catch {
    return false;
  }
}

// Purchase the win-back subscriptionOption directly. The user is lapsed
// (no active sub), so this is a fresh purchase — NO GoogleProductChangeInfo.
// Cancel returns false silently; other errors are tracked + captured and
// re-thrown so the caller can surface the error and keep the full-price
// plans available.
export async function purchaseWinBackAnnual(
  option: SubscriptionOption
): Promise<boolean> {
  if (!initialized) return false;

  try {
    track("winback_purchase_started", { option_id: option.id });

    const { customerInfo } = await Purchases.purchaseSubscriptionOption(option);

    const isPro =
      customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      track("winback_purchase_completed", { option_id: option.id });
    }

    return isPro;
  } catch (error: any) {
    if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return false;
    }

    track("winback_purchase_failed", { error: error.message });
    captureError(error, { context: "purchaseWinBackAnnual" });
    throw error;
  }
}

// ── Restore Purchases ────────────────────────────────────────

export async function restorePurchases(): Promise<boolean> {
  if (!initialized) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPro =
      customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (isPro) {
      track("purchase_restored");
    }

    return isPro;
  } catch (error) {
    captureError(error as Error, { context: "restorePurchases" });
    throw error;
  }
}

// ── Re-exports for convenience ───────────────────────────────

export type {
  PurchasesPackage,
  PurchasesOfferings,
  CustomerInfo,
  SubscriptionOption,
};
