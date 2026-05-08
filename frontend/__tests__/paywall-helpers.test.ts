import {
  getPackageKind,
  sortPaywallPackages,
  findDefaultIndex,
} from "../app/paywall-helpers";

describe("getPackageKind", () => {
  it("detects annual via packageType", () => {
    expect(getPackageKind({ packageType: "ANNUAL", identifier: "x" })).toBe(
      "annual"
    );
  });

  it("detects annual via identifier substring", () => {
    expect(getPackageKind({ identifier: "$rc_annual" })).toBe("annual");
  });

  it("detects monthly via packageType", () => {
    expect(getPackageKind({ packageType: "MONTHLY", identifier: "x" })).toBe(
      "monthly"
    );
  });

  it("detects lifetime via packageType", () => {
    expect(getPackageKind({ packageType: "LIFETIME", identifier: "x" })).toBe(
      "lifetime"
    );
  });

  it("detects lifetime via identifier", () => {
    expect(getPackageKind({ identifier: "$rc_lifetime" })).toBe("lifetime");
  });

  it("returns 'unknown' for unrecognised packages", () => {
    expect(getPackageKind({ identifier: "foo" })).toBe("unknown");
  });
});

describe("sortPaywallPackages", () => {
  it("orders annual first, monthly second, lifetime third", () => {
    const input = [
      { identifier: "$rc_lifetime" },
      { identifier: "$rc_monthly" },
      { identifier: "$rc_annual" },
    ];
    const kinds = sortPaywallPackages(input).map(getPackageKind);
    expect(kinds).toEqual(["annual", "monthly", "lifetime"]);
  });

  it("does not mutate input", () => {
    const input = [
      { identifier: "$rc_monthly" },
      { identifier: "$rc_annual" },
    ];
    const original = [...input];
    sortPaywallPackages(input);
    expect(input).toEqual(original);
  });

  it("preserves unknown packages at the end", () => {
    const input = [
      { identifier: "weird" },
      { identifier: "$rc_annual" },
      { identifier: "$rc_lifetime" },
    ];
    const kinds = sortPaywallPackages(input).map(getPackageKind);
    expect(kinds).toEqual(["annual", "lifetime", "unknown"]);
  });
});

describe("findDefaultIndex", () => {
  it("returns annual index when present", () => {
    const sorted = [
      { identifier: "$rc_annual" },
      { identifier: "$rc_monthly" },
      { identifier: "$rc_lifetime" },
    ];
    expect(findDefaultIndex(sorted)).toBe(0);
  });

  it("falls back to 0 when annual is absent", () => {
    const sorted = [
      { identifier: "$rc_monthly" },
      { identifier: "$rc_lifetime" },
    ];
    expect(findDefaultIndex(sorted)).toBe(0);
  });
});
