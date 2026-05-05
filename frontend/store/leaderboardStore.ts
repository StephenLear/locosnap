// ============================================================
// LocoSnap — Leaderboard tab state (Phase 2 E.1)
//
// Manages the 3-tab structure (My League / Country / Collection)
// + per-tab sub-toggles + selected country. In-memory only —
// the user defaults to My League on each app open, which lines
// up with the Phase 2 narrative goal of "league is the home tab".
// ============================================================

import { create } from "zustand";

export type LeaderboardTab = "my_league" | "country" | "collection";

export type WeekToggle = "this_week" | "all_time";

export type CollectionToggle = "unique_classes" | "rarity_score" | "streak_days";

interface LeaderboardState {
  activeTab: LeaderboardTab;
  myLeagueSubToggle: WeekToggle;
  countrySubToggle: WeekToggle;
  collectionSubToggle: CollectionToggle;
  selectedCountry: string | null;

  setActiveTab: (tab: LeaderboardTab) => void;
  setMyLeagueSubToggle: (value: WeekToggle) => void;
  setCountrySubToggle: (value: WeekToggle) => void;
  setCollectionSubToggle: (value: CollectionToggle) => void;
  setSelectedCountry: (code: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<
  LeaderboardState,
  | "setActiveTab"
  | "setMyLeagueSubToggle"
  | "setCountrySubToggle"
  | "setCollectionSubToggle"
  | "setSelectedCountry"
  | "reset"
> = {
  activeTab: "my_league",
  myLeagueSubToggle: "this_week",
  countrySubToggle: "this_week",
  collectionSubToggle: "unique_classes",
  selectedCountry: null,
};

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  ...INITIAL_STATE,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setMyLeagueSubToggle: (value) => set({ myLeagueSubToggle: value }),
  setCountrySubToggle: (value) => set({ countrySubToggle: value }),
  setCollectionSubToggle: (value) => set({ collectionSubToggle: value }),
  setSelectedCountry: (code) => set({ selectedCountry: code }),

  reset: () => set({ ...INITIAL_STATE }),
}));
