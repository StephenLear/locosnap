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
  HistoryItem,
} from "../types";
import {
  upsertTrain,
  saveSpot,
  fetchSpots,
  uploadPhoto,
  uploadBlueprint,
  updateSpotBlueprint,
} from "../services/supabase";
import { useAuthStore } from "./authStore";

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
  clearCurrentScan: () => void;
  loadHistory: () => Promise<void>;
  saveToHistory: () => Promise<void>;
  removeFromHistory: (id: string) => Promise<void>;
  viewHistoryItem: (item: HistoryItem) => void;
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
}));
