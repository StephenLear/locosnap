// ============================================================
// CarSnap — Zustand State Management
// ============================================================

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CarIdentification,
  CarSpecs,
  AggregatedReviews,
  InfographicStatus,
  HistoryItem,
} from "../types";

const HISTORY_KEY = "carsnap_history";
const MAX_HISTORY = 50;

interface CarState {
  // Current scan state
  isScanning: boolean;
  scanError: string | null;
  currentCar: CarIdentification | null;
  currentSpecs: CarSpecs | null;
  currentReviews: AggregatedReviews | null;
  infographicStatus: InfographicStatus | null;

  // History
  history: HistoryItem[];
  historyLoaded: boolean;

  // Actions
  startScan: () => void;
  setScanResults: (
    car: CarIdentification,
    specs: CarSpecs,
    reviews: AggregatedReviews
  ) => void;
  setScanError: (error: string) => void;
  setInfographicStatus: (status: InfographicStatus) => void;
  clearCurrentScan: () => void;
  loadHistory: () => Promise<void>;
  saveToHistory: () => Promise<void>;
  removeFromHistory: (id: string) => Promise<void>;
  viewHistoryItem: (item: HistoryItem) => void;
}

export const useCarStore = create<CarState>((set, get) => ({
  // Initial state
  isScanning: false,
  scanError: null,
  currentCar: null,
  currentSpecs: null,
  currentReviews: null,
  infographicStatus: null,
  history: [],
  historyLoaded: false,

  startScan: () => {
    set({
      isScanning: true,
      scanError: null,
      currentCar: null,
      currentSpecs: null,
      currentReviews: null,
      infographicStatus: null,
    });
  },

  setScanResults: (car, specs, reviews) => {
    set({
      isScanning: false,
      scanError: null,
      currentCar: car,
      currentSpecs: specs,
      currentReviews: reviews,
    });
  },

  setScanError: (error) => {
    set({
      isScanning: false,
      scanError: error,
    });
  },

  setInfographicStatus: (status) => {
    set({ infographicStatus: status });

    // Auto-save to history when infographic completes
    if (status.status === "completed" && status.imageUrl) {
      const state = get();
      if (state.currentCar) {
        get().saveToHistory();
      }
    }
  },

  clearCurrentScan: () => {
    set({
      isScanning: false,
      scanError: null,
      currentCar: null,
      currentSpecs: null,
      currentReviews: null,
      infographicStatus: null,
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
    if (!state.currentCar || !state.currentSpecs || !state.currentReviews) {
      return;
    }

    const item: HistoryItem = {
      id: Date.now().toString(),
      car: state.currentCar,
      specs: state.currentSpecs,
      reviews: state.currentReviews,
      infographicUrl: state.infographicStatus?.imageUrl || null,
      scannedAt: new Date().toISOString(),
    };

    // Check for duplicates (same car scanned recently)
    const isDuplicate = state.history.some(
      (h) =>
        h.car.make === item.car.make &&
        h.car.model === item.car.model &&
        h.car.year === item.car.year &&
        Date.now() - new Date(h.scannedAt).getTime() < 60000
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
      currentCar: item.car,
      currentSpecs: item.specs,
      currentReviews: item.reviews,
      infographicStatus: item.infographicUrl
        ? {
            taskId: "history",
            status: "completed",
            imageUrl: item.infographicUrl,
            error: null,
          }
        : null,
      isScanning: false,
      scanError: null,
    });
  },
}));
