import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";

export type AppLanguage = "en" | "de";

const LANGUAGE_KEY = "locosnap_language";
const LANGUAGE_CHOSEN_KEY = "locosnap_language_chosen";

// Supported languages — add new entries here as new languages ship
export const SUPPORTED_LANGUAGES: AppLanguage[] = ["en", "de"];

// Detect device locale and return closest supported language
function detectDeviceLanguage(): AppLanguage {
  const locale = Localization.getLocales()[0]?.languageCode ?? "en";
  if (locale === "de") return "de";
  return "en";
}

interface SettingsState {
  language: AppLanguage;
  languageChosen: boolean; // false = picker not yet shown
  isLoading: boolean;

  initialize: () => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  markLanguageChosen: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: "en",
  languageChosen: false,
  isLoading: true,

  initialize: async () => {
    try {
      const [storedLang, chosen] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(LANGUAGE_CHOSEN_KEY),
      ]);

      const language: AppLanguage =
        storedLang && SUPPORTED_LANGUAGES.includes(storedLang as AppLanguage)
          ? (storedLang as AppLanguage)
          : detectDeviceLanguage();

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
    } catch {
      // Non-fatal
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
