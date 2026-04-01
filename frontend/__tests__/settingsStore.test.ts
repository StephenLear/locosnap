jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));


jest.mock("../i18n", () => ({
  __esModule: true,
  default: {
    changeLanguage: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("settingsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("defaults to en when no stored language", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().language).toBe("en");
  });

  it("loads stored language from AsyncStorage", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "locosnap_language") return Promise.resolve("de");
      return Promise.resolve(null);
    });
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().language).toBe("de");
  });

  it("persists language to AsyncStorage on setLanguage", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().setLanguage("de");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("locosnap_language", "de");
  });

  it("marks language as chosen", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().markLanguageChosen();
    expect(useSettingsStore.getState().languageChosen).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("locosnap_language_chosen", "true");
  });

  it("sets isLoading to false after initialize", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().isLoading).toBe(false);
  });
});
