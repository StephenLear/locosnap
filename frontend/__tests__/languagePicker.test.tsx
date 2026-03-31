// ============================================================
// LocoSnap — Language Picker Logic Tests
// Tests the store interactions triggered by the language picker screen.
// Component rendering is not tested here (requires jest-expo / RNTL).
// ============================================================

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

describe("language picker screen interactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Re-apply mocks after resetModules
    jest.doMock("@react-native-async-storage/async-storage", () => ({
      getItem: jest.fn().mockResolvedValue(null),
      setItem: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock("expo-localization", () => ({
      getLocales: jest.fn(() => [{ languageCode: "en" }]),
    }));
    jest.doMock("../i18n", () => ({
      __esModule: true,
      default: {
        changeLanguage: jest.fn().mockResolvedValue(undefined),
      },
    }));
  });

  it("renders English and Deutsch buttons (store accepts both language codes)", () => {
    // Verify both valid language codes are accepted by the store type
    const { SUPPORTED_LANGUAGES } = require("../store/settingsStore");
    expect(SUPPORTED_LANGUAGES).toContain("en");
    expect(SUPPORTED_LANGUAGES).toContain("de");
  });

  it("pressing English calls setLanguage('en') and markLanguageChosen()", async () => {
    const { useSettingsStore } = require("../store/settingsStore");
    const i18n = require("../i18n").default;

    await useSettingsStore.getState().setLanguage("en");
    await useSettingsStore.getState().markLanguageChosen();

    expect(useSettingsStore.getState().language).toBe("en");
    expect(useSettingsStore.getState().languageChosen).toBe(true);
    expect(i18n.changeLanguage).toHaveBeenCalledWith("en");
  });

  it("pressing Deutsch calls setLanguage('de') and markLanguageChosen()", async () => {
    const { useSettingsStore } = require("../store/settingsStore");
    const i18n = require("../i18n").default;

    await useSettingsStore.getState().setLanguage("de");
    await useSettingsStore.getState().markLanguageChosen();

    expect(useSettingsStore.getState().language).toBe("de");
    expect(useSettingsStore.getState().languageChosen).toBe(true);
    expect(i18n.changeLanguage).toHaveBeenCalledWith("de");
  });
});
