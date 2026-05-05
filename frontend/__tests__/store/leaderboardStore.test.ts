// ============================================================
// useLeaderboardStore — pure state transition tests (Phase 2 E.1)
// ============================================================

import { useLeaderboardStore } from "../../store/leaderboardStore";

describe("useLeaderboardStore", () => {
  beforeEach(() => {
    useLeaderboardStore.getState().reset();
  });

  describe("initial state", () => {
    it("defaults activeTab to my_league", () => {
      expect(useLeaderboardStore.getState().activeTab).toBe("my_league");
    });

    it("defaults sub-toggles to this_week / unique_classes", () => {
      const s = useLeaderboardStore.getState();
      expect(s.myLeagueSubToggle).toBe("this_week");
      expect(s.countrySubToggle).toBe("this_week");
      expect(s.collectionSubToggle).toBe("unique_classes");
    });

    it("defaults selectedCountry to null", () => {
      expect(useLeaderboardStore.getState().selectedCountry).toBeNull();
    });
  });

  describe("setActiveTab", () => {
    it("flips between the three tabs", () => {
      const { setActiveTab } = useLeaderboardStore.getState();
      setActiveTab("country");
      expect(useLeaderboardStore.getState().activeTab).toBe("country");
      setActiveTab("collection");
      expect(useLeaderboardStore.getState().activeTab).toBe("collection");
      setActiveTab("my_league");
      expect(useLeaderboardStore.getState().activeTab).toBe("my_league");
    });
  });

  describe("sub-toggles are tab-independent", () => {
    it("My League and Country can have different week toggles", () => {
      const { setMyLeagueSubToggle, setCountrySubToggle } =
        useLeaderboardStore.getState();
      setMyLeagueSubToggle("all_time");
      setCountrySubToggle("this_week");
      const s = useLeaderboardStore.getState();
      expect(s.myLeagueSubToggle).toBe("all_time");
      expect(s.countrySubToggle).toBe("this_week");
    });

    it("Collection cycles through unique_classes / rarity_score / streak_days", () => {
      const { setCollectionSubToggle } = useLeaderboardStore.getState();
      setCollectionSubToggle("rarity_score");
      expect(useLeaderboardStore.getState().collectionSubToggle).toBe(
        "rarity_score"
      );
      setCollectionSubToggle("streak_days");
      expect(useLeaderboardStore.getState().collectionSubToggle).toBe(
        "streak_days"
      );
      setCollectionSubToggle("unique_classes");
      expect(useLeaderboardStore.getState().collectionSubToggle).toBe(
        "unique_classes"
      );
    });
  });

  describe("setSelectedCountry", () => {
    it("accepts an ISO country code", () => {
      useLeaderboardStore.getState().setSelectedCountry("DE");
      expect(useLeaderboardStore.getState().selectedCountry).toBe("DE");
    });

    it("can be cleared back to null", () => {
      useLeaderboardStore.getState().setSelectedCountry("DE");
      useLeaderboardStore.getState().setSelectedCountry(null);
      expect(useLeaderboardStore.getState().selectedCountry).toBeNull();
    });
  });

  describe("reset", () => {
    it("returns all values to initial state", () => {
      const s = useLeaderboardStore.getState();
      s.setActiveTab("country");
      s.setMyLeagueSubToggle("all_time");
      s.setCollectionSubToggle("rarity_score");
      s.setSelectedCountry("PL");
      s.reset();
      const final = useLeaderboardStore.getState();
      expect(final.activeTab).toBe("my_league");
      expect(final.myLeagueSubToggle).toBe("this_week");
      expect(final.collectionSubToggle).toBe("unique_classes");
      expect(final.selectedCountry).toBeNull();
    });
  });
});
