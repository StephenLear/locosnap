import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import de from "../locales/de.json";

export const LANGUAGE_RESOURCES = { en, de };

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: "en", // default — overridden at app start from settingsStore
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React handles XSS
  },
  compatibilityJSON: "v3",
});

export default i18n;
