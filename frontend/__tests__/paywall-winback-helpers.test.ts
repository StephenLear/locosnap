import {
  decideWinBackVisibility,
  getWinBackPriceString,
} from "../app/paywall-winback-helpers";

describe("decideWinBackVisibility", () => {
  it("shows only when android + lapsed + hasOption", () => {
    expect(
      decideWinBackVisibility({
        platform: "android",
        lapsed: true,
        hasOption: true,
      })
    ).toBe(true);
  });

  it("hides on iOS even when lapsed with an option (Apple auto-surfaces)", () => {
    expect(
      decideWinBackVisibility({
        platform: "ios",
        lapsed: true,
        hasOption: true,
      })
    ).toBe(false);
  });

  it("hides when the user is not lapsed", () => {
    expect(
      decideWinBackVisibility({
        platform: "android",
        lapsed: false,
        hasOption: true,
      })
    ).toBe(false);
  });

  it("hides when the tagged option was not found", () => {
    expect(
      decideWinBackVisibility({
        platform: "android",
        lapsed: true,
        hasOption: false,
      })
    ).toBe(false);
  });
});

describe("getWinBackPriceString", () => {
  it("reads the formatted price from fullPricePhase", () => {
    expect(
      getWinBackPriceString({
        fullPricePhase: { price: { formatted: "€19.99" } },
        pricingPhases: [{ price: { formatted: "€0.00" } }],
      })
    ).toBe("€19.99");
  });

  it("falls back to the first usable pricing phase when fullPricePhase is absent", () => {
    expect(
      getWinBackPriceString({
        fullPricePhase: null,
        pricingPhases: [
          { price: { formatted: "" } },
          { price: { formatted: "229,00 zł" } },
        ],
      })
    ).toBe("229,00 zł");
  });

  it("returns null for a null option", () => {
    expect(getWinBackPriceString(null)).toBeNull();
    expect(getWinBackPriceString(undefined)).toBeNull();
  });

  it("skips a zero-amount (free-trial) phase and returns the paid phase", () => {
    expect(
      getWinBackPriceString({
        fullPricePhase: null,
        pricingPhases: [
          { price: { formatted: "€0.00", amountMicros: 0 } },
          { price: { formatted: "€19.99", amountMicros: 19990000 } },
        ],
      })
    ).toBe("€19.99");
  });

  it("returns null when no phase has a usable formatted price", () => {
    expect(
      getWinBackPriceString({
        fullPricePhase: { price: { formatted: "" } },
        pricingPhases: [{ price: null }, {}],
      })
    ).toBeNull();
  });
});
