// Pure logic helpers for paywall package composition + display formatters.
// Unit-tested independently of RN render so we can validate sort, kind
// detection, weekly-equivalent formatting, and intro-offer descriptors
// without touching RevenueCat SDK or React Native.

export type PaywallPackageKind = "monthly" | "annual" | "lifetime" | "unknown";

interface PackageLike {
  packageType?: string;
  identifier: string;
}

export function getPackageKind(pkg: PackageLike): PaywallPackageKind {
  const id = (pkg.identifier || "").toLowerCase();
  const type = (pkg.packageType || "").toUpperCase();

  if (type === "LIFETIME" || id.includes("lifetime")) return "lifetime";
  if (type === "ANNUAL" || id.includes("annual")) return "annual";
  if (type === "MONTHLY" || id.includes("monthly")) return "monthly";

  return "unknown";
}

const KIND_ORDER: Record<PaywallPackageKind, number> = {
  annual: 0,
  monthly: 1,
  lifetime: 2,
  unknown: 3,
};

export function sortPaywallPackages<T extends PackageLike>(packages: T[]): T[] {
  return [...packages].sort(
    (a, b) => KIND_ORDER[getPackageKind(a)] - KIND_ORDER[getPackageKind(b)]
  );
}

export function findDefaultIndex<T extends PackageLike>(packages: T[]): number {
  const annualIdx = packages.findIndex((p) => getPackageKind(p) === "annual");
  return annualIdx >= 0 ? annualIdx : 0;
}

// ── Weekly-equivalent formatter (annual price anchor) ─────────────
// Annual price ÷ 52 formatted as currency. Used as a secondary line
// under the annual tile's primary "/year" price to anchor against
// a coffee/beer-sized weekly figure (psychologically stronger than
// the monthly-equivalent, which collapses to a few cents' delta
// against the monthly tier).
export type PaywallLocale = "en" | "de" | "pl";

const LOCALE_TO_BCP47: Record<PaywallLocale, string> = {
  en: "en-US",
  de: "de-DE",
  pl: "pl-PL",
};

export function formatPerWeek(
  annualPrice: number,
  currencyCode: string,
  locale: PaywallLocale
): string {
  if (!Number.isFinite(annualPrice) || annualPrice <= 0) return "";
  const weekly = annualPrice / 52;
  const bcp47 = LOCALE_TO_BCP47[locale] ?? "en-US";
  try {
    return new Intl.NumberFormat(bcp47, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(weekly);
  } catch {
    // Fallback if currencyCode is malformed — preserve weekly figure
    return `${weekly.toFixed(2)} ${currencyCode}`;
  }
}

// ── Intro-offer descriptor (truthful intro copy from RevenueCat) ──
// Drops the legacy hardcoded "30% OFF FIRST 3 MONTHS" copy in favour
// of structured fields that map onto i18n templates per locale.
// Returns null when the package has no intro offer (most tiles).
export interface IntroPriceLike {
  priceString: string;
  periodUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | string;
  periodNumberOfUnits: number;
}

export type IntroPeriodUnit = "day" | "week" | "month" | "year";

export interface IntroOfferDescriptor {
  introPriceString: string;
  count: number;
  unit: IntroPeriodUnit;
}

const PERIOD_UNIT_MAP: Record<string, IntroPeriodUnit> = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

export function describeIntroOffer(
  introPrice: IntroPriceLike | null | undefined
): IntroOfferDescriptor | null {
  if (!introPrice) return null;
  if (!introPrice.priceString) return null;
  const unit = PERIOD_UNIT_MAP[(introPrice.periodUnit || "").toUpperCase()];
  if (!unit) return null;
  const count = Math.max(1, Math.floor(introPrice.periodNumberOfUnits || 1));
  return {
    introPriceString: introPrice.priceString,
    count,
    unit,
  };
}
