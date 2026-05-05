import { todaysThemedDay } from "../../constants/themedDay";

describe("todaysThemedDay", () => {
  it("returns rare_tier with 2x on a Tuesday", () => {
    // Tue 2026-05-05 12:00 UTC
    const tue = new Date(Date.UTC(2026, 4, 5, 12));
    expect(todaysThemedDay(tue)).toEqual({ kind: "rare_tier", multiplier: 2 });
  });

  it("returns null on a Wednesday", () => {
    const wed = new Date(Date.UTC(2026, 4, 6, 12));
    expect(todaysThemedDay(wed)).toBeNull();
  });

  it("returns null on a Saturday (heritage deferred to v1.0.27)", () => {
    const sat = new Date(Date.UTC(2026, 4, 9, 12));
    expect(todaysThemedDay(sat)).toBeNull();
  });

  it("returns null on a Sunday", () => {
    const sun = new Date(Date.UTC(2026, 4, 10, 12));
    expect(todaysThemedDay(sun)).toBeNull();
  });
});
