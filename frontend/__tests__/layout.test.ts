// Tests for the language-gate logic wired into _layout.tsx.
// We test the store state conditions that drive the redirect — not the
// React component itself (no @testing-library/react-native installed).

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
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

describe("language gate — _layout.tsx redirect conditions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("shows redirect when isLoading is false and languageChosen is false", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    // Neither language nor chosen flag stored — first-launch user
    AsyncStorage.getItem.mockResolvedValue(null);

    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();

    const { isLoading, languageChosen } = useSettingsStore.getState();

    expect(isLoading).toBe(false);
    expect(languageChosen).toBe(false);
    // Both conditions true => _layout.tsx must render <Redirect to="/language-picker">
    expect(!isLoading && !languageChosen).toBe(true);
  });

  it("skips redirect when languageChosen is true after markLanguageChosen", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockImplementation((key: string) => {
      if (key === "locosnap_language_chosen") return Promise.resolve("true");
      return Promise.resolve(null);
    });
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();

    const { isLoading, languageChosen } = useSettingsStore.getState();

    expect(isLoading).toBe(false);
    expect(languageChosen).toBe(true);
    // languageChosen true => _layout.tsx must NOT redirect
    expect(!isLoading && !languageChosen).toBe(false);
  });

  it("blocks rendering while isLoading is true (initial store state)", () => {
    jest.resetModules();
    const { useSettingsStore } = require("../store/settingsStore");

    // Store initialises with isLoading: true before initialize() is called
    const { isLoading } = useSettingsStore.getState();
    expect(isLoading).toBe(true);
  });
});
