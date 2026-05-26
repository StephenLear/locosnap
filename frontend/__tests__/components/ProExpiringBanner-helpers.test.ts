import {
  decideBannerVisibility,
  BANNER_WINDOW_DAYS,
} from "../../components/ProExpiringBanner-helpers";

const NOW = "2026-05-26T12:00:00Z";
const isoIn = (hours: number) =>
  new Date(Date.parse(NOW) + hours * 3600 * 1000).toISOString();

describe("decideBannerVisibility — hide conditions", () => {
  it("hides when not Pro", () => {
    expect(
      decideBannerVisibility({
        isPro: false,
        entitlement: { expirationDate: isoIn(48), willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: false });
  });

  it("hides when entitlement is null (legacy manually-granted Pro)", () => {
    expect(
      decideBannerVisibility({ isPro: true, entitlement: null, now: NOW })
    ).toEqual({ show: false });
  });

  it("hides when expirationDate is null (lifetime Pro)", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: null, willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: false });
  });

  it("hides when auto-renewing (willRenew=true)", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: isoIn(48), willRenew: true },
        now: NOW,
      })
    ).toEqual({ show: false });
  });

  it("hides when expiration is more than 7 days out", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: isoIn(8 * 24), willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: false });
  });

  it("hides when already expired (negative remaining)", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: isoIn(-2), willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: false });
  });

  it("hides on malformed expirationDate", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: "not-a-date", willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: false });
  });
});

describe("decideBannerVisibility — show conditions", () => {
  it("shows when expiration is within 7 days and not renewing", () => {
    const out = decideBannerVisibility({
      isPro: true,
      entitlement: { expirationDate: isoIn(3 * 24), willRenew: false },
      now: NOW,
    });
    expect(out.show).toBe(true);
  });

  it("rounds 47h up to 2 days remaining", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: isoIn(47), willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: true, daysRemaining: 2 });
  });

  it("rounds 23h up to 1 day remaining", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: { expirationDate: isoIn(23), willRenew: false },
        now: NOW,
      })
    ).toEqual({ show: true, daysRemaining: 1 });
  });

  it("includes exact 7-day boundary as visible", () => {
    expect(
      decideBannerVisibility({
        isPro: true,
        entitlement: {
          expirationDate: isoIn(BANNER_WINDOW_DAYS * 24),
          willRenew: false,
        },
        now: NOW,
      })
    ).toEqual({ show: true, daysRemaining: BANNER_WINDOW_DAYS });
  });
});
