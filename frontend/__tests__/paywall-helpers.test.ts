import {
  getPackageKind,
  sortPaywallPackages,
  findDefaultIndex,
  formatPerWeek,
  describeIntroOffer,
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

describe("formatPerWeek", () => {
  it("formats DE annual €34.99 as ~€0.67/week in de-DE locale", () => {
    const out = formatPerWeek(34.99, "EUR", "de");
    // de-DE uses comma decimal separator + EUR symbol
    expect(out).toMatch(/0[.,]67/);
    expect(out).toMatch(/€/);
  });

  it("formats UK annual £27.99 as ~£0.54/week in en locale", () => {
    const out = formatPerWeek(27.99, "GBP", "en");
    expect(out).toMatch(/0\.54/);
    expect(out).toMatch(/£/);
  });

  it("formats PL annual 89.99 zł as ~1.73 zł/week in pl-PL locale", () => {
    const out = formatPerWeek(89.99, "PLN", "pl");
    // pl-PL uses comma decimal separator + zł suffix
    expect(out).toMatch(/1[.,]73/);
    expect(out).toMatch(/zł/);
  });

  it("returns empty string for non-positive prices", () => {
    expect(formatPerWeek(0, "EUR", "de")).toBe("");
    expect(formatPerWeek(-5, "EUR", "de")).toBe("");
    expect(formatPerWeek(NaN, "EUR", "de")).toBe("");
  });

  it("falls back gracefully on malformed currency code", () => {
    const out = formatPerWeek(52, "ZZZ", "en");
    // Intl may either render with the literal code or throw — either way
    // we get a numeric weekly figure (52/52 = 1.00).
    expect(out).toMatch(/1\.00|1,00/);
    expect(out).toMatch(/ZZZ/);
  });
});

describe("describeIntroOffer", () => {
  it("returns null when introPrice is absent", () => {
    expect(describeIntroOffer(null)).toBeNull();
    expect(describeIntroOffer(undefined)).toBeNull();
  });

  it("returns null when priceString is missing", () => {
    expect(
      describeIntroOffer({
        priceString: "",
        periodUnit: "MONTH",
        periodNumberOfUnits: 1,
      })
    ).toBeNull();
  });

  it("returns null when periodUnit is unrecognised", () => {
    expect(
      describeIntroOffer({
        priceString: "€1",
        periodUnit: "GARBAGE",
        periodNumberOfUnits: 1,
      })
    ).toBeNull();
  });

  it("describes DE €1 first month correctly", () => {
    const desc = describeIntroOffer({
      priceString: "€1.00",
      periodUnit: "MONTH",
      periodNumberOfUnits: 1,
    });
    expect(desc).toEqual({
      introPriceString: "€1.00",
      count: 1,
      unit: "month",
    });
  });

  it("describes a 3-month intro offer correctly", () => {
    const desc = describeIntroOffer({
      priceString: "€3.00",
      periodUnit: "MONTH",
      periodNumberOfUnits: 3,
    });
    expect(desc).toEqual({
      introPriceString: "€3.00",
      count: 3,
      unit: "month",
    });
  });

  it("normalises lowercased periodUnit", () => {
    const desc = describeIntroOffer({
      priceString: "€1.00",
      periodUnit: "month",
      periodNumberOfUnits: 1,
    });
    expect(desc?.unit).toBe("month");
  });

  it("clamps zero/negative periodNumberOfUnits to 1", () => {
    const desc = describeIntroOffer({
      priceString: "€1.00",
      periodUnit: "MONTH",
      periodNumberOfUnits: 0,
    });
    expect(desc?.count).toBe(1);
  });
});
