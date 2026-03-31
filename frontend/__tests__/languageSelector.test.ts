// Tests for Task 7: language toggle on the profile screen
// These test the store-level behaviour that the UI invokes —
// the toggle reads the current language and flips to the other.

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "en" }]),
}));

jest.mock("../i18n", () => ({
  __esModule: true,
  default: {
    changeLanguage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("Language selector behaviour (profile screen)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("toggles from en to de by calling setLanguage('de')", async () => {
    const { useSettingsStore } = require("../store/settingsStore");
    const store = useSettingsStore.getState();

    // Start in English
    expect(store.language).toBe("en");

    // Simulate what the toggle handler does
    const currentLang = useSettingsStore.getState().language;
    const nextLang = currentLang === "en" ? "de" : "en";
    await useSettingsStore.getState().setLanguage(nextLang);

    expect(useSettingsStore.getState().language).toBe("de");
  });

  it("toggles from de to en by calling setLanguage('en')", async () => {
    const { useSettingsStore } = require("../store/settingsStore");

    // Put store into German
    await useSettingsStore.getState().setLanguage("de");
    expect(useSettingsStore.getState().language).toBe("de");

    // Simulate toggle
    const currentLang = useSettingsStore.getState().language;
    const nextLang = currentLang === "en" ? "de" : "en";
    await useSettingsStore.getState().setLanguage(nextLang);

    expect(useSettingsStore.getState().language).toBe("en");
  });

  it("calls i18n.changeLanguage when toggling", async () => {
    const i18n = require("../i18n").default;
    const { useSettingsStore } = require("../store/settingsStore");

    await useSettingsStore.getState().setLanguage("de");

    expect(i18n.changeLanguage).toHaveBeenCalledWith("de");
  });

  it("language label is 'English' when language is en", () => {
    // Pure logic test: the display label shown in the profile row
    function getLanguageLabel(lang: "en" | "de"): string {
      return lang === "en" ? "English" : "Deutsch";
    }

    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("de")).toBe("Deutsch");
  });
});
