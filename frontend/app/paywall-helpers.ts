// Pure logic helpers for paywall package composition. Unit-tested
// independently of RN render so we can validate sort + kind detection
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
