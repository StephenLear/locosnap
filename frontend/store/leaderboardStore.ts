// ============================================================
// LocoSnap — Leaderboard tab state (Phase 2 E.1, updated v1.0.30)
//
// Manages the 3-tab structure (Collection / Country / This Week)
// + per-tab sub-toggles + selected country. In-memory only —
// the user defaults to Collection on each app open, exposing the
// "unique classes" metric Steph identified as her mental model
// (2026-05-09 signal: "I would think it would be by how many
// trains you spot then the different classes"). The Phase 2
// weekly-XP league system remains accessible via the renamed
// "This Week" tab (formerly "My League"), with an info-icon
// explainer modal mapping league concepts back to Steph's model.
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
  activeTab: "collection",
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
