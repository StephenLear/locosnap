import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import de from "../locales/de.json";

export const LANGUAGE_RESOURCES = { en, de };

/**
 * Initialise i18n explicitly — called from _layout.tsx useEffect before
 * settingsStore.initialize(), so it never runs at module-evaluation time.
 * initImmediate: false makes the init synchronous so changeLanguage() can
 * be called immediately after without waiting for a promise.
 */
export function initI18n() {
  if (i18n.isInitialized) return;
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    lng: "en", // default — overridden immediately by settingsStore.initialize()
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    initAsync: false, // synchronous init (was initImmediate before i18next v23) — ensures i18n is ready before changeLanguage()
  });
}

export default i18n;
