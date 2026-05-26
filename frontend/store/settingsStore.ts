import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../i18n";

export type AppLanguage = "en" | "de" | "pl";

const LANGUAGE_KEY = "locosnap_language";
const LANGUAGE_CHOSEN_KEY = "locosnap_language_chosen";

// Supported languages — add new entries here as new languages ship.
// Must stay in sync with VALID_LANGUAGES in backend/src/routes/identify.ts
// and LANGUAGE_INSTRUCTIONS in backend/src/config/languageInstructions.ts.
//
// NOTE on device-locale auto-detection: do NOT reintroduce `expo-localization`
// here. v1.0.8 crashed at startup on Samsung S24 / Android 16 / Finnish locale
// devices BEFORE Sentry could initialise (invisible to monitoring). The package
// was uninstalled in v1.0.11. First launch defaults to "en"; the language
// picker is the safe path. If we ever revisit auto-detection, do it via
// `Intl.DateTimeFormat().resolvedOptions().locale` (already used elsewhere in
// the codebase for country resolution) — NOT via expo-localization.
export const SUPPORTED_LANGUAGES: AppLanguage[] = ["en", "de", "pl"];


interface SettingsState {
  language: AppLanguage;
  languageChosen: boolean; // false = picker not yet shown
  isLoading: boolean;

  initialize: () => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  markLanguageChosen: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: "en",
  languageChosen: false,
  isLoading: true,

  initialize: async () => {
    if (!get().isLoading) return;   // already initialised or in progress
    try {
      const [storedLang, chosen] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(LANGUAGE_CHOSEN_KEY),
      ]);

      const language: AppLanguage =
        storedLang && SUPPORTED_LANGUAGES.includes(storedLang as AppLanguage)
          ? (storedLang as AppLanguage)
          : "en";

      await i18n.changeLanguage(language);
      set({
        language,
        languageChosen: chosen === "true",
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setLanguage: async (lang: AppLanguage) => {
    set({ language: lang });
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      await i18n.changeLanguage(lang);
    } catch {
      // Non-fatal
    }

    // v1.0.35 migration 017 — sync language choice to profiles for
    // server-side consumers (rescue push cron, future welcome emails).
    // Best-effort: signed-in users only, never blocks the local update,
    // never throws. Lazy imports break the otherwise-circular dep chain
    // (authStore imports settingsStore indirectly via _layout.tsx init).
    try {
      const { useAuthStore } = require("./authStore");
      const { updateProfileIdentity } = require("../services/supabase");
      const userId = useAuthStore.getState().session?.user?.id;
      if (userId) {
        updateProfileIdentity(userId, { language: lang }).catch(() => {});
      }
    } catch {
      // Non-fatal — local state already updated, Supabase will pick up
      // the change on next fetchProfile divergence check (authStore).
    }
  },

  markLanguageChosen: async () => {
    set({ languageChosen: true });
    try {
      await AsyncStorage.setItem(LANGUAGE_CHOSEN_KEY, "true");
    } catch {
      // Non-fatal
    }
  },
}));
