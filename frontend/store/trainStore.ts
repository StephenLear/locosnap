// ============================================================
// LocoSnap — Zustand State Management
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

  startScan: () => {
    set({
      isScanning: true,
      scanError: null,
      currentTrain: null,
      currentSpecs: null,
      currentFacts: null,
      currentRarity: null,
      blueprintStatus: null,
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

    // Auto-save to history when blueprint completes
    if (status.status === "completed" && status.imageUrl) {
      const state = get();
      if (state.currentTrain) {
        get().saveToHistory();
      }
    }
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
    });
  },

  loadHistory: async () => {
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
    if (!state.currentTrain || !state.currentSpecs || !state.currentFacts || !state.currentRarity) {
      return;
    }

    const item: HistoryItem = {
      id: Date.now().toString(),
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

    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      console.warn("Failed to save history");
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
    });
  },
}));
