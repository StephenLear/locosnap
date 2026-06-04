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
  SpotIdentityOverride,
  CaptureSource,
  VerificationTier,
} from "../types";

// Card v2 provenance (Phase 0.4) — server-canonical verification
// result returned by /api/identify. We carry it on the current scan
// so card-reveal + saveToHistory can persist it onto the spot row.
interface CurrentVerification {
  verified: boolean;
  tier: VerificationTier;
  riskFlags: Record<string, boolean>;
  captureSource: CaptureSource;
  exifTimestamp: string | null;
  photoAccuracyM: number | null;
}
import {
  upsertTrain,
  saveSpot,
  fetchSpots,
  uploadPhoto,
  uploadBlueprint,
  updateSpotBlueprint,
  awardWeeklyXpForSpot,
  awardXp,
  calculateXp,
  updateStreak,
  checkAndUnlockAchievements,
  fetchAchievements,
  AchievementType,
  deleteSpot,
  updateSpotIdentity,
} from "../services/supabase";
import { useAuthStore } from "./authStore";
import { RarityTier, ACHIEVEMENT_DEFINITIONS } from "../types";
import { maybePromptReview } from "../services/reviewPrompt";
import {
  notifyBlueprintReady,
  notifyAchievementUnlocked,
} from "../services/notifications";
import { track, addBreadcrumb, captureError } from "../services/analytics";

const HISTORY_KEY = "locosnap_history";
// v1.0.31 — bumped 200 → 1000 after Steph (210 spots / 85 unique classes)
// hit the 200 cap and her oldest entries fell off the local view. Memory
// cost ~2 MB AsyncStorage at 1000 spots × ~2 KB each — negligible. True
// infinite-scroll pagination deferred to v1.0.32+ when a real user
// actually hits 1000.
const MAX_HISTORY = 1000;

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

  // Card v2 provenance — populated by handleScan before identifyTrain,
  // updated with the server-canonical verification when the response lands.
  currentVerification: CurrentVerification | null;

  // Phase 2 leaderboard XP delta from the most recent saveScan call.
  // Surfaces in card-reveal as "+45 XP toward Bronze League". null when
  // the server returned 0 (non-VERIFIED, repeat scan reduced to 0, or
  // migration 013 not yet applied).
  lastLeagueXpDelta: number | null;

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
  setVerification: (verification: CurrentVerification | null) => void;
  clearCurrentScan: () => void;
  loadHistory: () => Promise<void>;
  saveToHistory: () => Promise<void>;
  removeFromHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  viewHistoryItem: (item: HistoryItem) => void;
  setBlueprintStyle: (style: BlueprintStyle) => void;
  setCompareItems: (items: [HistoryItem, HistoryItem] | null) => void;
  // Manual card-edit (v1.0.38): apply/clear a per-spot identity override
  // locally (the Supabase write happens in the caller) so the UI updates
  // without a re-fetch.
  setHistoryIdentityOverride: (
    id: string,
    override: SpotIdentityOverride | null
  ) => Promise<void>;
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
  currentVerification: null,
  lastLeagueXpDelta: null,
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
      currentVerification: null,
      lastLeagueXpDelta: null,
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

  setVerification: (verification) => {
    set({ currentVerification: verification });
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
      currentVerification: null,
    });
  },

  loadHistory: async () => {
    const auth = useAuthStore.getState();

    // Always read local first — cheap and gives us local-only entries
    // (failed-to-persist scans, offline saves) to preserve when we merge
    // the cloud snapshot in.
    let local: HistoryItem[] = [];
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      if (stored) local = JSON.parse(stored);
    } catch {
      console.warn("Failed to load local history");
    }

    if (!auth.user) {
      set({ history: local, historyLoaded: true });
      return;
    }

    // Authenticated: pull cloud and merge with local-only entries.
    // Cloud is the source of truth for anything that's been persisted;
    // local-only entries (id is a Date.now() timestamp string, length < 32,
    // never reached the cloud) are kept so failed-persist scans don't
    // disappear from the user's view on next refresh. The 2026-05-10
    // verification_tier silent-data-loss bug exposed how dangerous a
    // pure cloud-replace strategy is when persistence quietly fails.
    set({ isSyncing: true });
    try {
      const cloudSpots = await fetchSpots(auth.user.id, MAX_HISTORY);

      // Local-only = id doesn't look like a UUID (UUIDs are 36 chars
      // with dashes). Excludes anything we know reached the cloud.
      const isLocalOnlyId = (id: string) =>
        id.length < 32 || !id.includes("-");

      // Don't surface a local-only entry if cloud already has the same
      // class+operator within 5 minutes of the local spottedAt — that's
      // the same scan, cloud version wins.
      const FIVE_MIN = 5 * 60 * 1000;
      const cloudMatches = (item: HistoryItem) =>
        cloudSpots.some(
          (c) =>
            c.train.class === item.train.class &&
            c.train.operator === item.train.operator &&
            Math.abs(
              new Date(c.spottedAt).getTime() -
                new Date(item.spottedAt).getTime()
            ) < FIVE_MIN
        );

      const localOnly = local.filter(
        (h) => isLocalOnlyId(h.id) && !cloudMatches(h)
      );

      // Cloud first (newest), then local-only entries that didn't make
      // it to the cloud yet — preserves the "scan happened" record even
      // when the persistence layer is broken.
      const merged = [...cloudSpots, ...localOnly].slice(0, MAX_HISTORY);
      set({ history: merged, historyLoaded: true });
    } catch (err) {
      console.warn("Cloud history load failed, falling back to local");
      captureError(err as Error, { op: "loadHistory.fetchSpots" });
      set({ history: local, historyLoaded: true });
    } finally {
      set({ isSyncing: false });
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

    // Card v2 P0.4 — pull verification + raw provenance through to the
    // HistoryItem and the Supabase row. currentVerification is null on
    // older clients (no provenance sent) and on web (no EXIF access).
    const v = state.currentVerification;

    const item: HistoryItem = {
      id: state.currentSpotId || Date.now().toString(),
      train: state.currentTrain,
      specs: state.currentSpecs,
      facts: state.currentFacts,
      rarity: state.currentRarity,
      blueprintUrl: state.blueprintStatus?.imageUrl || null,
      photoUri: state.currentPhotoUri,
      spottedAt: new Date().toISOString(),
      latitude: state.currentLocation?.latitude || null,
      longitude: state.currentLocation?.longitude || null,
      captureSource: v?.captureSource,
      exifTimestamp: v?.exifTimestamp,
      verified: v?.verified,
      verificationTier: v?.tier,
      photoAccuracyM: v?.photoAccuracyM,
      riskFlags: v?.riskFlags,
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

        // 3. Save the spot record (Card v2 — provenance fields written
        // when currentVerification is populated; otherwise fall back
        // to migration-009 defaults).
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
          captureSource: v?.captureSource,
          exifTimestamp: v?.exifTimestamp,
          verified: v?.verified,
          verificationTier: v?.tier,
          photoAccuracyM: v?.photoAccuracyM,
          riskFlags: v?.riskFlags,
        });

        if (spotId) {
          set({ currentSpotId: spotId });
          // Update history item with cloud ID and permanent photo URL
          const updated = newHistory.map((h) =>
            h.id === item.id ? { ...h, id: spotId, photoUri: photoUrl || h.photoUri } : h
          );
          set({ history: updated });

          // Increment daily scans
          auth.incrementDailyScans();

          // ── Phase 2 leaderboard: award weekly League XP (C.8) ──
          // Server-side computation via SECURITY DEFINER RPC. Returns
          // null when migration 013 isn't yet applied (function does
          // not exist) — that's expected during the staging window.
          // Failure-tolerant: never blocks the scan-save flow.
          try {
            const leagueResult = await awardWeeklyXpForSpot(spotId);
            if (leagueResult && leagueResult.finalXp > 0) {
              set({ lastLeagueXpDelta: leagueResult.finalXp });
            } else {
              set({ lastLeagueXpDelta: null });
            }
          } catch {
            set({ lastLeagueXpDelta: null });
          }

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

            const SILVER_GOLD: ReadonlySet<AchievementType> = new Set<AchievementType>([
              "unique_century",
              "unique_master",
              "five_hundred_club",
              "thousand_spots",
              "streak_thirty",
              "streak_hundred",
              "legendary_five",
              "heritage_master",
            ]);

            for (const type of newAchievements) {
              const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.type === type);
              if (def) {
                track("achievement_unlocked", { achievement: def.name, type });
                notifyAchievementUnlocked(def.name, def.description).catch(() => {});
              }

              const scanCount = allHistory.length;
              if (SILVER_GOLD.has(type)) {
                maybePromptReview({ trigger: "achievement_silver_gold", scanCount });
              } else if (type === "seven_day_streak") {
                maybePromptReview({ trigger: "streak_7d", scanCount });
              } else if (type === "ten_unique") {
                maybePromptReview({ trigger: "unique_classes_50", scanCount });
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

    // Cloud sync: delete from Supabase too. Without this, on app
    // restart `loadHistory` would call `fetchSpots` and pull the row
    // back, making deletion appear ineffective. Reported by Toastbrot82
    // 2026-04-28: "Ich hab ein Zug gelöscht ... wieder da" after a
    // close-and-reopen cycle. id format: Supabase UUID for synced
    // spots, fallback Date.now() string for unsynced local-only spots
    // (skip the delete call for those — they have no cloud row).
    const auth = useAuthStore.getState();
    if (auth.user && id && id.length >= 32) {
      try {
        await deleteSpot(id);
      } catch (err) {
        console.warn("Failed to delete spot from Supabase:", err);
        // Local deletion stays — user-side history is correct.
        // The cloud row will resurface on next loadHistory but we
        // surfaced the error.
      }
    }
  },

  clearHistory: async () => {
    set({ history: [], historyLoaded: false });
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {
      console.warn("Failed to clear history");
    }
  },

  setHistoryIdentityOverride: async (id, override) => {
    const state = get();
    const newHistory = state.history.map((h) =>
      h.id === id ? { ...h, identityOverride: override } : h
    );
    set({ history: newHistory });

    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      console.warn("Failed to persist identity override locally");
    }

    // Cloud write: only for synced spots (Supabase UUID id, length >= 32).
    // Local-only unsynced spots (Date.now() string ids) have no cloud row.
    // Mirrors the id-length guard in removeFromHistory.
    const auth = useAuthStore.getState();
    if (auth.user && id && id.length >= 32) {
      await updateSpotIdentity(id, override);
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
      currentPhotoUri: item.photoUri || null,
    });
  },

  setBlueprintStyle: (style) => {
    set({ selectedBlueprintStyle: style });
  },

  setCompareItems: (items) => {
    set({ compareItems: items });
  },
}));
