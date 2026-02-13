// ============================================================
// LocoSnap — Zustand State Management
// Local-first with optional Supabase cloud sync
// ============================================================

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
  BlueprintStatus,
  BlueprintStyle,
  HistoryItem,
} from "../types";
import {
  upsertTrain,
  saveSpot,
  fetchSpots,
  uploadPhoto,
  uploadBlueprint,
  updateSpotBlueprint,
  awardXp,
  calculateXp,
  updateStreak,
  checkAndUnlockAchievements,
  fetchAchievements,
  AchievementType,
} from "../services/supabase";
import { useAuthStore } from "./authStore";
import { RarityTier, ACHIEVEMENT_DEFINITIONS } from "../types";
import {
  notifyBlueprintReady,
  notifyAchievementUnlocked,
} from "../services/notifications";
import { track, addBreadcrumb, captureError } from "../services/analytics";

const HISTORY_KEY = "locosnap_history";
const MAX_HISTORY = 50;

interface TrainState {
  // Current scan state
  isScanning: boolean;
  scanError: string | null;
  currentTrain: TrainIdentification | null;
  currentSpecs: TrainSpecs | null;
  currentFacts: TrainFacts | null;
  currentRarity: RarityInfo | null;
  blueprintStatus: BlueprintStatus | null;

  // History
  history: HistoryItem[];
  historyLoaded: boolean;

  // Cloud sync
  currentSpotId: string | null; // Supabase spot ID for current scan
  isSyncing: boolean;

  // Photo URI for upload
  currentPhotoUri: string | null;

  // Location
  currentLocation: { latitude: number; longitude: number } | null;

  // Blueprint style (Pro feature)
  selectedBlueprintStyle: BlueprintStyle;

  // Compare mode
  compareItems: [HistoryItem, HistoryItem] | null;

  // Actions
  startScan: () => void;
  setScanResults: (
    train: TrainIdentification,
    specs: TrainSpecs,
    facts: TrainFacts,
    rarity: RarityInfo
  ) => void;
  setScanError: (error: string) => void;
  setBlueprintStatus: (status: BlueprintStatus) => void;
  setPhotoUri: (uri: string) => void;
  setLocation: (location: { latitude: number; longitude: number } | null) => void;
  clearCurrentScan: () => void;
  loadHistory: () => Promise<void>;
  saveToHistory: () => Promise<void>;
  removeFromHistory: (id: string) => Promise<void>;
  viewHistoryItem: (item: HistoryItem) => void;
  setBlueprintStyle: (style: BlueprintStyle) => void;
  setCompareItems: (items: [HistoryItem, HistoryItem] | null) => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
  // Initial state
  isScanning: false,
  scanError: null,
  currentTrain: null,
  currentSpecs: null,
  currentFacts: null,
  currentRarity: null,
  blueprintStatus: null,
  history: [],
  historyLoaded: false,
  currentSpotId: null,
  isSyncing: false,
  currentPhotoUri: null,
  currentLocation: null,
  selectedBlueprintStyle: "technical",
  compareItems: null,

  startScan: () => {
    set({
      isScanning: true,
      scanError: null,
      currentTrain: null,
      currentSpecs: null,
      currentFacts: null,
      currentRarity: null,
      blueprintStatus: null,
      currentSpotId: null,
      currentPhotoUri: null,
      // Keep location — it's set before scan starts
    });
  },

  setScanResults: (train, specs, facts, rarity) => {
    set({
      isScanning: false,
      scanError: null,
      currentTrain: train,
      currentSpecs: specs,
      currentFacts: facts,
      currentRarity: rarity,
    });
  },

  setScanError: (error) => {
    set({
      isScanning: false,
      scanError: error,
    });
  },

  setBlueprintStatus: (status) => {
    set({ blueprintStatus: status });

    // When blueprint completes, upload to Supabase Storage and update spot
    if (status.status === "completed" && status.imageUrl) {
      const state = get();
      if (state.currentTrain) {
        // Re-save to local history with blueprint URL
        get().saveToHistory();

        // Send local push notification
        notifyBlueprintReady(state.currentTrain.class).catch(() => {});

        // Upload blueprint to cloud if authenticated
        const auth = useAuthStore.getState();
        if (auth.user && state.currentSpotId && status.imageUrl) {
          uploadBlueprint(auth.user.id, status.imageUrl, state.currentSpotId)
            .then((publicUrl) => {
              if (publicUrl && state.currentSpotId) {
                updateSpotBlueprint(state.currentSpotId, publicUrl);
              }
            })
            .catch((err) =>
              console.warn("Blueprint cloud upload failed:", err)
            );
        }
      }
    }
  },

  setPhotoUri: (uri) => {
    set({ currentPhotoUri: uri });
  },

  setLocation: (location) => {
    set({ currentLocation: location });
  },

  clearCurrentScan: () => {
    set({
      isScanning: false,
      scanError: null,
      currentTrain: null,
      currentSpecs: null,
      currentFacts: null,
      currentRarity: null,
      blueprintStatus: null,
      currentSpotId: null,
      currentPhotoUri: null,
      currentLocation: null,
    });
  },

  loadHistory: async () => {
    const auth = useAuthStore.getState();

    // If authenticated, try loading from Supabase first
    if (auth.user) {
      try {
        set({ isSyncing: true });
        const cloudSpots = await fetchSpots(auth.user.id, MAX_HISTORY);
        if (cloudSpots.length > 0) {
          set({ history: cloudSpots, historyLoaded: true, isSyncing: false });
          return;
        }
      } catch {
        console.warn("Cloud history load failed, falling back to local");
      } finally {
        set({ isSyncing: false });
      }
    }

    // Fallback: load from AsyncStorage (guests + offline)
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      if (stored) {
        const history: HistoryItem[] = JSON.parse(stored);
        set({ history, historyLoaded: true });
      } else {
        set({ historyLoaded: true });
      }
    } catch {
      console.warn("Failed to load history");
      set({ historyLoaded: true });
    }
  },

  saveToHistory: async () => {
    const state = get();
    if (
      !state.currentTrain ||
      !state.currentSpecs ||
      !state.currentFacts ||
      !state.currentRarity
    ) {
      return;
    }

    const item: HistoryItem = {
      id: state.currentSpotId || Date.now().toString(),
      train: state.currentTrain,
      specs: state.currentSpecs,
      facts: state.currentFacts,
      rarity: state.currentRarity,
      blueprintUrl: state.blueprintStatus?.imageUrl || null,
      spottedAt: new Date().toISOString(),
      latitude: state.currentLocation?.latitude || null,
      longitude: state.currentLocation?.longitude || null,
    };

    // Check for duplicates (same train spotted recently)
    const isDuplicate = state.history.some(
      (h) =>
        h.train.class === item.train.class &&
        h.train.operator === item.train.operator &&
        Date.now() - new Date(h.spottedAt).getTime() < 60000
    );

    if (isDuplicate) return;

    const newHistory = [item, ...state.history].slice(0, MAX_HISTORY);
    set({ history: newHistory });

    // Save to AsyncStorage (always — local backup)
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      console.warn("Failed to save history");
    }

    // Cloud sync: save to Supabase if authenticated
    const auth = useAuthStore.getState();
    if (auth.user && !state.currentSpotId) {
      set({ isSyncing: true });

      try {
        // 1. Upsert the train record
        const trainId = await upsertTrain(
          state.currentTrain,
          state.currentSpecs,
          state.currentFacts,
          state.currentRarity
        );

        // 2. Upload user's photo
        let photoUrl: string | null = null;
        const tempSpotId = Date.now().toString();
        if (state.currentPhotoUri) {
          photoUrl = await uploadPhoto(
            auth.user.id,
            state.currentPhotoUri,
            tempSpotId
          );
        }

        // 3. Save the spot record
        const spotId = await saveSpot({
          userId: auth.user.id,
          trainId,
          train: state.currentTrain,
          specs: state.currentSpecs,
          facts: state.currentFacts,
          rarity: state.currentRarity,
          photoUrl,
          blueprintUrl: state.blueprintStatus?.imageUrl || null,
          confidence: state.currentTrain.confidence,
          latitude: state.currentLocation?.latitude,
          longitude: state.currentLocation?.longitude,
        });

        if (spotId) {
          set({ currentSpotId: spotId });
          // Update history item with cloud ID
          const updated = newHistory.map((h) =>
            h.id === item.id ? { ...h, id: spotId } : h
          );
          set({ history: updated });

          // Increment daily scans
          auth.incrementDailyScans();

          // ── Gamification: XP + streak + achievements ──
          const rarityTier = (state.currentRarity?.tier || "common") as RarityTier;
          const isFirstOfClass = newHistory.filter(
            (h) =>
              h.train.class === state.currentTrain!.class &&
              h.train.operator === state.currentTrain!.operator
          ).length === 1;

          // Award XP
          const xpAmount = calculateXp(rarityTier, isFirstOfClass);
          const xpResult = await awardXp(auth.user.id, xpAmount);
          if (xpResult) {
            // Update profile in auth store with new XP/level
            auth.fetchProfile();
          }

          // Update streak
          const streakResult = await updateStreak(auth.user.id);
          if (streakResult) {
            auth.fetchProfile();
          }

          // Check achievements
          const allHistory = get().history;
          const uniqueClassSet = new Set(
            allHistory.map((h) => `${h.train.class}::${h.train.operator}`)
          );
          const rarityTiers: Record<string, number> = {};
          let steamCount = 0;
          let hasLegendary = false;
          for (const h of allHistory) {
            const t = h.rarity?.tier || "common";
            rarityTiers[t] = (rarityTiers[t] || 0) + 1;
            if (t === "legendary") hasLegendary = true;
            if (h.train.type?.toLowerCase() === "steam") steamCount++;
          }

          // Load existing achievements to avoid duplicate checks
          const existing = await fetchAchievements(auth.user.id);
          const existingSet = new Set(existing.map((a) => a.type)) as Set<AchievementType>;

          const newAchievements = await checkAndUnlockAchievements({
            userId: auth.user.id,
            totalSpots: allHistory.length,
            uniqueClasses: uniqueClassSet.size,
            streakCurrent: streakResult?.current ?? 0,
            hasLegendary,
            steamCount,
            rarityTiers,
            existingAchievements: existingSet,
          });

          if (newAchievements.length > 0) {
            console.log("[GAMIFICATION] New achievements unlocked:", newAchievements);
            // Send push notification for each new achievement
            for (const type of newAchievements) {
              const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.type === type);
              if (def) {
                track("achievement_unlocked", { achievement: def.name, type });
                notifyAchievementUnlocked(def.name, def.description).catch(() => {});
              }
            }
          }
        }
      } catch (err) {
        console.warn("Cloud sync failed:", (err as Error).message);
      } finally {
        set({ isSyncing: false });
      }
    }
  },

  removeFromHistory: async (id) => {
    const state = get();
    const newHistory = state.history.filter((h) => h.id !== id);
    set({ history: newHistory });

    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      console.warn("Failed to update history");
    }
  },

  viewHistoryItem: (item) => {
    set({
      currentTrain: item.train,
      currentSpecs: item.specs,
      currentFacts: item.facts,
      currentRarity: item.rarity,
      blueprintStatus: item.blueprintUrl
        ? {
            taskId: "history",
            status: "completed",
            imageUrl: item.blueprintUrl,
            error: null,
          }
        : null,
      isScanning: false,
      scanError: null,
      currentSpotId: null,
      currentPhotoUri: null,
    });
  },

  setBlueprintStyle: (style) => {
    set({ selectedBlueprintStyle: style });
  },

  setCompareItems: (items) => {
    set({ compareItems: items });
  },
}));
