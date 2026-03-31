# Language Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-launch language picker (EN/DE) with architecture that supports adding FR, PL, NL, CS in future builds without refactoring. All UI strings and AI-generated content (facts, specs descriptions, rarity reasons) return in the user's chosen language.

**Architecture:** A `settingsStore` (Zustand + AsyncStorage) holds the language preference. On first launch, `_layout.tsx` shows a `language-picker` screen before the main tab navigator. The chosen language is passed to every backend scan request as a `language` form field. The backend injects a language instruction into the facts, specs, and rarity prompts. Cache keys include the language so EN and DE results are stored separately.

**Tech Stack:** `expo-localization`, `i18next`, `react-i18next`, Zustand, AsyncStorage, Express.js

---

## Critical notes before starting

- **Vision/identification stays in English.** Train class names (BR 412, ICE 4, Class 390) are universal — do not ask the AI to translate them. Only facts, specs qualitative fields, and rarity reasons get translated.
- **Cache version must be bumped to v7** when language is added to cache keys. Existing v6 cache entries do not include a language segment — they will be orphaned automatically. This is correct behaviour.
- **Technical spec values stay in their standard format.** Numbers, units, and proper nouns (builder names, operators) do not need translation. Only narrative text (summary, historicalSignificance, funFacts, notableEvents, rarity reason) should be in the user's language.
- **Do not translate the `class`, `operator`, or `type` fields** returned by the vision service.

---

## Task 1: Install frontend dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install packages**

```bash
cd frontend
npx expo install expo-localization
npm install i18next react-i18next
```

**Step 2: Verify installation**

```bash
cat package.json | grep -E "i18next|expo-localization"
```

Expected: both packages appear with version numbers.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(i18n): install i18next, react-i18next, expo-localization"
```

---

## Task 2: Create settings store

**Files:**
- Create: `frontend/store/settingsStore.ts`

**Step 1: Create the store**

```typescript
// frontend/store/settingsStore.ts
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
```

**Step 2: Write tests**

Create `frontend/__tests__/settingsStore.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "en" }]),
}));

describe("settingsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("defaults to en when no stored language", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().language).toBe("en");
  });

  it("loads stored language from AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === "locosnap_language") return Promise.resolve("de");
      return Promise.resolve(null);
    });
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().language).toBe("de");
  });

  it("detects German device locale and defaults to de", async () => {
    jest.mock("expo-localization", () => ({
      getLocales: jest.fn(() => [{ languageCode: "de" }]),
    }));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().initialize();
    expect(useSettingsStore.getState().language).toBe("de");
  });

  it("persists language to AsyncStorage on setLanguage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().setLanguage("de");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("locosnap_language", "de");
  });

  it("marks language as chosen", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { useSettingsStore } = require("../store/settingsStore");
    await useSettingsStore.getState().markLanguageChosen();
    expect(useSettingsStore.getState().languageChosen).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("locosnap_language_chosen", "true");
  });
});
```

**Step 3: Run tests**

```bash
cd frontend && npm test -- --testPathPattern=settingsStore
```

Expected: 5 tests pass.

**Step 4: Commit**

```bash
git add frontend/store/settingsStore.ts frontend/__tests__/settingsStore.test.ts
git commit -m "feat(i18n): add settingsStore with language preference and first-launch detection"
```

---

## Task 3: Create i18n config and translation files

**Files:**
- Create: `frontend/i18n/index.ts`
- Create: `frontend/locales/en.json`
- Create: `frontend/locales/de.json`

**Step 1: Create English translation file**

```json
// frontend/locales/en.json
{
  "tabs": {
    "scan": "Scan",
    "history": "History",
    "profile": "Profile",
    "leaderboard": "Leaderboard"
  },
  "scan": {
    "title": "LocoSnap",
    "scanButton": "Scan Train",
    "scanning": "Identifying...",
    "warmingUp": "Warming up...",
    "trialBanner": "{{remaining}} free scan left",
    "trialBanner_plural": "{{remaining}} free scans left",
    "signUpPrompt": "Create a free account to save your collection",
    "noTrainFound": "Could not identify a train. Try a clearer photo.",
    "cameraPermission": "Camera access is needed to scan trains."
  },
  "results": {
    "specs": "Specifications",
    "facts": "Facts & History",
    "rarity": "Rarity",
    "blueprint": "Blueprint",
    "maxSpeed": "Max Speed",
    "power": "Power",
    "weight": "Weight",
    "length": "Length",
    "builder": "Builder",
    "built": "Built",
    "status": "Status",
    "operator": "Operator",
    "yearIntroduced": "Introduced",
    "savePhoto": "Save to Photos",
    "share": "Share",
    "viewBlueprint": "View Blueprint",
    "generatingBlueprint": "Generating blueprint..."
  },
  "profile": {
    "title": "Profile",
    "signIn": "Sign In",
    "signOut": "Sign Out",
    "pro": "Pro",
    "free": "Free",
    "scansThisMonth": "Scans this month",
    "totalSpots": "Total spots",
    "level": "Level",
    "xp": "XP",
    "streak": "Day streak",
    "upgradeToPro": "Upgrade to Pro",
    "language": "Language",
    "settings": "Settings"
  },
  "history": {
    "title": "Collection",
    "empty": "No trains scanned yet. Get out there!",
    "scannedOn": "Scanned {{date}}"
  },
  "leaderboard": {
    "title": "Leaderboard",
    "rank": "Rank",
    "spotter": "Spotter",
    "spots": "Spots"
  },
  "auth": {
    "signInWithApple": "Sign in with Apple",
    "signInWithGoogle": "Sign in with Google",
    "signInWithEmail": "Sign in with email",
    "emailPlaceholder": "Enter your email",
    "sendMagicLink": "Send magic link",
    "checkEmail": "Check your email for a sign-in link.",
    "freeAccountPerks": "Save your collection, earn XP, climb the leaderboard."
  },
  "paywall": {
    "title": "Go Pro",
    "unlimitedScans": "Unlimited scans",
    "allBlueprintStyles": "All blueprint styles",
    "leaderboardAccess": "Leaderboard access",
    "subscribe": "Subscribe",
    "restorePurchases": "Restore purchases",
    "monthlyPrice": "{{price}} / month",
    "yearlyPrice": "{{price}} / year"
  },
  "rarity": {
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "legendary": "Legendary"
  },
  "errors": {
    "networkError": "Could not connect to LocoSnap servers. Please try again.",
    "timeout": "Request timed out. Please check your connection.",
    "highDemand": "LocoSnap is experiencing high demand. Please try again in a moment.",
    "generic": "Something went wrong. Please try again."
  },
  "languagePicker": {
    "title": "Choose your language",
    "subtitle": "You can change this later in your profile.",
    "english": "English",
    "german": "Deutsch",
    "continue": "Continue"
  }
}
```

**Step 2: Create German translation file**

```json
// frontend/locales/de.json
{
  "tabs": {
    "scan": "Scannen",
    "history": "Sammlung",
    "profile": "Profil",
    "leaderboard": "Bestenliste"
  },
  "scan": {
    "title": "LocoSnap",
    "scanButton": "Zug scannen",
    "scanning": "Wird erkannt...",
    "warmingUp": "Wird gestartet...",
    "trialBanner": "Noch {{remaining}} kostenloser Scan",
    "trialBanner_plural": "Noch {{remaining}} kostenlose Scans",
    "signUpPrompt": "Erstelle ein kostenloses Konto, um deine Sammlung zu speichern.",
    "noTrainFound": "Kein Zug erkannt. Bitte versuche es mit einem klareren Foto.",
    "cameraPermission": "Kamerazugriff wird zum Scannen von Zügen benötigt."
  },
  "results": {
    "specs": "Technische Daten",
    "facts": "Fakten & Geschichte",
    "rarity": "Seltenheit",
    "blueprint": "Blueprint",
    "maxSpeed": "Höchstgeschwindigkeit",
    "power": "Leistung",
    "weight": "Gewicht",
    "length": "Länge",
    "builder": "Hersteller",
    "built": "Gebaut",
    "status": "Status",
    "operator": "Betreiber",
    "yearIntroduced": "Eingeführt",
    "savePhoto": "In Fotos speichern",
    "share": "Teilen",
    "viewBlueprint": "Blueprint anzeigen",
    "generatingBlueprint": "Blueprint wird erstellt..."
  },
  "profile": {
    "title": "Profil",
    "signIn": "Anmelden",
    "signOut": "Abmelden",
    "pro": "Pro",
    "free": "Kostenlos",
    "scansThisMonth": "Scans diesen Monat",
    "totalSpots": "Gesamt-Spots",
    "level": "Level",
    "xp": "XP",
    "streak": "Tage-Streak",
    "upgradeToPro": "Auf Pro upgraden",
    "language": "Sprache",
    "settings": "Einstellungen"
  },
  "history": {
    "title": "Sammlung",
    "empty": "Noch keine Züge gescannt. Los geht's!",
    "scannedOn": "Gescannt am {{date}}"
  },
  "leaderboard": {
    "title": "Bestenliste",
    "rank": "Rang",
    "spotter": "Spotter",
    "spots": "Spots"
  },
  "auth": {
    "signInWithApple": "Mit Apple anmelden",
    "signInWithGoogle": "Mit Google anmelden",
    "signInWithEmail": "Mit E-Mail anmelden",
    "emailPlaceholder": "E-Mail-Adresse eingeben",
    "sendMagicLink": "Magic Link senden",
    "checkEmail": "Prüfe deine E-Mails für einen Anmelde-Link.",
    "freeAccountPerks": "Speichere deine Sammlung, sammle XP und klettere in der Bestenliste."
  },
  "paywall": {
    "title": "Pro werden",
    "unlimitedScans": "Unbegrenzte Scans",
    "allBlueprintStyles": "Alle Blueprint-Stile",
    "leaderboardAccess": "Zugang zur Bestenliste",
    "subscribe": "Abonnieren",
    "restorePurchases": "Käufe wiederherstellen",
    "monthlyPrice": "{{price}} / Monat",
    "yearlyPrice": "{{price}} / Jahr"
  },
  "rarity": {
    "common": "Häufig",
    "uncommon": "Ungewöhnlich",
    "rare": "Selten",
    "legendary": "Legendär"
  },
  "errors": {
    "networkError": "Keine Verbindung zu den LocoSnap-Servern. Bitte erneut versuchen.",
    "timeout": "Zeitüberschreitung. Bitte überprüfe deine Verbindung.",
    "highDemand": "LocoSnap ist gerade stark ausgelastet. Bitte in einem Moment erneut versuchen.",
    "generic": "Etwas ist schiefgelaufen. Bitte erneut versuchen."
  },
  "languagePicker": {
    "title": "Sprache wählen",
    "subtitle": "Du kannst dies später in deinem Profil ändern.",
    "english": "English",
    "german": "Deutsch",
    "continue": "Weiter"
  }
}
```

**Step 3: Create i18n config**

```typescript
// frontend/i18n/index.ts
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
```

**Step 4: Commit**

```bash
git add frontend/locales/ frontend/i18n/
git commit -m "feat(i18n): add EN/DE translation files and i18n config"
```

---

## Task 4: Create language picker screen

**Files:**
- Create: `frontend/app/language-picker.tsx`

**Step 1: Create the screen**

```typescript
// frontend/app/language-picker.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useSettingsStore, AppLanguage } from "../store/settingsStore";
import { colors } from "../constants/theme";
import i18n from "../i18n";

export default function LanguagePicker() {
  const { setLanguage, markLanguageChosen, language } = useSettingsStore();

  const handleSelect = async (lang: AppLanguage) => {
    await setLanguage(lang);
    i18n.changeLanguage(lang);
    await markLanguageChosen();
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: "https://locosnap.app/images/icon.png" }}
        style={styles.logo}
      />
      <Text style={styles.title}>Choose your language</Text>
      <Text style={styles.subtitle}>
        You can change this later in your profile.
      </Text>

      <TouchableOpacity
        style={[styles.option, language === "en" && styles.optionSelected]}
        onPress={() => handleSelect("en")}
      >
        <Text style={styles.optionText}>English</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, language === "de" && styles.optionSelected]}
        onPress={() => handleSelect("de")}
      >
        <Text style={styles.optionText}>Deutsch</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 40,
    textAlign: "center",
  },
  option: {
    width: "100%",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    alignItems: "center",
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "15",
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
  },
});
```

**Step 2: Commit**

```bash
git add frontend/app/language-picker.tsx
git commit -m "feat(i18n): add language picker screen"
```

---

## Task 5: Wire language picker into _layout.tsx

**Files:**
- Modify: `frontend/app/_layout.tsx`

**Step 1: Import and initialise**

At the top of `_layout.tsx`, add these imports after the existing imports:

```typescript
import "../i18n"; // initialise i18next
import i18n from "../i18n";
import { useSettingsStore } from "../store/settingsStore";
```

**Step 2: Update RootLayout to handle language init**

In the `RootLayout` function, add settings store reads and language initialisation:

```typescript
function RootLayout() {
  const loadHistory = useTrainStore((state) => state.loadHistory);
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();

  // Language settings
  const initSettings = useSettingsStore((state) => state.initialize);
  const language = useSettingsStore((state) => state.language);
  const languageChosen = useSettingsStore((state) => state.languageChosen);
  const settingsLoading = useSettingsStore((state) => state.isLoading);

  // ... existing useEffects ...

  useEffect(() => {
    initAnalytics();
    initPurchases();
    initialize();
    initSettings(); // add this
    loadHistory();
    // ... rest unchanged
  }, []);

  // Sync i18n language when settingsStore language changes
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  // Show language picker on first launch (before anything else)
  if (settingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!languageChosen) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <LanguagePicker />  // import from ./language-picker or render inline
      </GestureHandlerRootView>
    );
  }

  // ... rest of existing return unchanged
```

**Important:** Import `LanguagePicker` from `./language-picker` at the top, or extract the picker into an inline component. The key point is it renders before `AuthGate` and the main Stack.

**Step 3: Register the screen in the Stack**

Add this to the `<Stack>` block so Expo Router knows about the screen (even though it's rendered outside the Stack — this prevents a 404 warning):

```typescript
<Stack.Screen name="language-picker" options={{ headerShown: false }} />
```

**Step 4: Run the app and verify**

- Fresh install (clear AsyncStorage): language picker appears first
- Select "Deutsch": app loads in German, i18n language is "de"
- Select "English": app loads in English
- Kill and reopen: picker does NOT appear again
- Language preference persists

**Step 5: Commit**

```bash
git add frontend/app/_layout.tsx
git commit -m "feat(i18n): wire language picker into root layout — shows on first launch only"
```

---

## Task 6: Replace hardcoded UI strings with translations

**Files to update** (work through each one):
- `frontend/app/(tabs)/index.tsx` — scan screen
- `frontend/app/(tabs)/history.tsx` — history screen
- `frontend/app/(tabs)/profile.tsx` — profile screen
- `frontend/app/(tabs)/_layout.tsx` — tab labels
- `frontend/app/results.tsx` — results screen
- `frontend/app/sign-in.tsx` — auth screen
- `frontend/app/paywall.tsx` — paywall screen

**Pattern for each file:**

At the top of every component file, add:

```typescript
import { useTranslation } from "react-i18next";

// Inside the component:
const { t } = useTranslation();

// Replace every hardcoded string:
// Before: <Text>Scan Train</Text>
// After:  <Text>{t("scan.scanButton")}</Text>
```

**Step 1: Update tab labels in `(tabs)/_layout.tsx`**

Find the tab bar labels and replace with `t()`. This file uses a different pattern — tab labels are often set in `tabBarLabel` props.

**Step 2: Update scan screen**

Replace all user-visible strings. Key ones:
- Scan button label
- Warming up / scanning status text
- Trial banner
- Error messages
- Camera permission text

**Step 3: Update results screen**

Replace spec labels (Max Speed, Power, Weight, etc.), section headings (Specifications, Facts & History), and action buttons (Save to Photos, Share, View Blueprint).

**Step 4: Update profile, history, leaderboard, sign-in, paywall**

Work through each screen. If a string is not in the translation files yet, add it to both `en.json` and `de.json` before using it.

**Step 5: Commit after each screen**

```bash
git add frontend/app/(tabs)/index.tsx
git commit -m "feat(i18n): translate scan screen strings"
# repeat for each screen
```

**Note:** Do not translate: class names (BR 412), operator names (Deutsche Bahn), numeric values, unit symbols (km/h, kW). Only translate labels, headings, buttons, and static UI copy.

---

## Task 7: Add language setting to profile screen

**Files:**
- Modify: `frontend/app/(tabs)/profile.tsx`

**Step 1: Add language selector UI**

In the profile settings section, add a language row that opens a modal or inline picker to change language. When changed, call `setLanguage()` from `settingsStore` and `i18n.changeLanguage()`.

```typescript
const { language, setLanguage } = useSettingsStore();

// In render:
<TouchableOpacity onPress={() => showLanguagePicker()}>
  <Text>{t("profile.language")}</Text>
  <Text>{language === "de" ? "Deutsch" : "English"}</Text>
</TouchableOpacity>
```

The simplest implementation is an `Alert.alert` with two options. A full modal is not needed for 1.0.8.

**Step 2: Commit**

```bash
git add frontend/app/(tabs)/profile.tsx
git commit -m "feat(i18n): add language selector in profile settings"
```

---

## Task 8: Pass language to backend API calls

**Files:**
- Modify: `frontend/services/api.ts`

**Step 1: Update `identifyTrain` signature**

```typescript
export async function identifyTrain(
  imageUri: string,
  blueprintStyle: BlueprintStyle = "technical",
  generateBlueprint: boolean = false,
  language: string = "en"   // add this param
): Promise<IdentifyResponse> {
```

**Step 2: Add language to FormData in both web and native functions**

In `identifyTrainWeb`:
```typescript
formData.append("language", language);
```

In `identifyTrainNative`:
```typescript
formData.append("language", language);
```

**Step 3: Update all callers of `identifyTrain`**

Find every place in the frontend that calls `identifyTrain` and pass the current language from `settingsStore`:

```typescript
const language = useSettingsStore.getState().language;
const result = await identifyTrain(imageUri, blueprintStyle, generateBlueprint, language);
```

**Step 4: Commit**

```bash
git add frontend/services/api.ts frontend/app/(tabs)/index.tsx
git commit -m "feat(i18n): pass language param to backend identify calls"
```

---

## Task 9: Backend — accept language param in identify route

**Files:**
- Modify: `backend/src/routes/identify.ts`

**Step 1: Extract language from request body**

After the `blueprintStyle` extraction (around line 108), add:

```typescript
const VALID_LANGUAGES = ["en", "de", "fr", "nl", "pl", "cs"];
const requestedLanguage = req.body?.language as string;
const language: string =
  requestedLanguage && VALID_LANGUAGES.includes(requestedLanguage)
    ? requestedLanguage
    : "en";
```

**Step 2: Pass language to all service calls**

Update `getTrainFacts`, `getTrainSpecs`, `classifyRarity`, and `getCachedTrainData` / `setCachedTrainData` calls to include `language`:

```typescript
// Cache check
const cached = await getCachedTrainData(train, blueprintStyle, language);

// AI pipeline
const [specsResult, factsResult] = await Promise.allSettled([
  getTrainSpecs(train, language),
  getTrainFacts(train, language),
]);

rarity = await classifyRarity(train, specs, language);

// Cache write
setCachedTrainData(train, specs, facts, rarity, language).catch(...)
```

**Step 3: Write test**

In `backend/src/__tests__/identify.test.ts`, add a test that passes `language: "de"` and verify it is accepted without error. Also test that an invalid language falls back to `"en"`.

**Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern=identify
```

**Step 5: Commit**

```bash
git add backend/src/routes/identify.ts backend/src/__tests__/identify.test.ts
git commit -m "feat(i18n): extract and validate language param in identify route"
```

---

## Task 10: Backend — add language to facts prompt

**Files:**
- Modify: `backend/src/services/trainFacts.ts`

**Step 1: Update `FACTS_PROMPT` to accept language**

```typescript
const FACTS_PROMPT = (train: TrainIdentification, verifiedYear?: string, language: string = "en") =>
  `You are a railway historian and trainspotting enthusiast. Provide fascinating facts and history for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).
${verifiedYear ? `\nVERIFIED FACT — use this exactly, do not contradict it: This class entered service in ${verifiedYear}.\n` : ""}
${language !== "en" ? `\nIMPORTANT: Respond entirely in ${language === "de" ? "German (Deutsch)" : language}. All text fields must be in ${language === "de" ? "German" : language}. Do not mix languages.\n` : ""}
Respond with ONLY valid JSON...`
```

**Step 2: Update `getTrainFacts` function signature**

```typescript
export async function getTrainFacts(
  train: TrainIdentification,
  language: string = "en"
): Promise<TrainFacts>
```

Pass `language` into the `FACTS_PROMPT()` call wherever it is used inside the function.

**Step 3: Commit**

```bash
git add backend/src/services/trainFacts.ts
git commit -m "feat(i18n): add language instruction to facts prompt"
```

---

## Task 11: Backend — add language to specs and rarity prompts

**Files:**
- Modify: `backend/src/services/trainSpecs.ts`
- Modify: `backend/src/services/rarity.ts`

**Step 1: Update trainSpecs.ts**

Add `language` param to `getTrainSpecs`. Add this to the prompt — but only for narrative fields, not numeric specs:

```
${language !== "en" ? `\nIMPORTANT: The "status" field (e.g. "In service", "Withdrawn") and any descriptive text must be in ${language === "de" ? "German (Deutsch)" : language}. All numeric values, unit symbols, builder names, and operator names must remain unchanged.\n` : ""}
```

Note: specs are mostly numbers and proper nouns. The only field that needs translation is `status` (e.g. "In service" -> "Im Einsatz", "Withdrawn" -> "Außer Dienst gestellt").

**Step 2: Update rarity.ts**

Add `language` param to `classifyRarity`. Add to the prompt:

```
${language !== "en" ? `\nIMPORTANT: The "reason" field must be written in ${language === "de" ? "German (Deutsch)" : language}. The "tier" field must remain in English (common/uncommon/rare/legendary) as it is used programmatically.\n` : ""}
```

**Step 3: Commit**

```bash
git add backend/src/services/trainSpecs.ts backend/src/services/rarity.ts
git commit -m "feat(i18n): add language instruction to specs and rarity prompts"
```

---

## Task 12: Backend — update cache key to include language

**Files:**
- Modify: `backend/src/services/trainCache.ts`

**Step 1: Update cache key format**

Find the cache key generation (currently `"class::operator"`) and update to include language:

```typescript
// Before:
const key = `traindata:${train.class.toLowerCase()}::${train.operator.toLowerCase()}`;

// After:
function buildCacheKey(train: TrainIdentification, language: string = "en"): string {
  return `traindata:${train.class.toLowerCase()}::${train.operator.toLowerCase()}::${language}`;
}
```

**Step 2: Update all functions that use the cache key**

- `getCachedTrainData(train, blueprintStyle, language)` — add `language` param, use `buildCacheKey`
- `setCachedTrainData(train, specs, facts, rarity, language)` — add `language` param
- `setCachedBlueprint(train, url, style, language)` — add `language` param

**Step 3: Bump cache version to v7**

Find the cache version constant and increment it:

```typescript
// Before:
const CACHE_VERSION = "v6";

// After:
const CACHE_VERSION = "v7";
```

This orphans all existing v6 entries (which don't have a language segment). First scan of every class will be a cache miss — this is expected and correct.

**Step 4: Update callers in identify.ts**

`identify.ts` calls `getCachedTrainData`, `setCachedTrainData`, and `setCachedBlueprint` — update all three to pass `language`.

**Step 5: Run all backend tests**

```bash
cd backend && npm test
```

Expected: all 53 tests pass. If cache-related tests fail, update them to pass `language` params.

**Step 6: Commit**

```bash
git add backend/src/services/trainCache.ts backend/src/routes/identify.ts
git commit -m "feat(i18n): include language in cache keys, bump cache to v7"
```

---

## Task 13: Deploy backend and verify end-to-end

**Step 1: Push backend to Render**

```bash
git push
```

Render auto-deploys on push to main. Wait ~2 minutes for deploy to complete.

**Step 2: Verify via health endpoint**

```bash
curl https://locosnap.onrender.com/api/health
```

Expected: 200 OK with `"cacheVersion": "v7"` (if health endpoint exposes this).

**Step 3: End-to-end test — German scan**

Using the app set to German (DE):
1. Scan a train
2. Verify: facts summary is in German, rarity reason is in German, specs status field is in German
3. Verify: class name, operator, numeric values are unchanged (still in standard format)
4. Scan the same train again
5. Verify: result returns from cache (cache hit) and is still in German

**Step 4: End-to-end test — English scan**

Set app language back to English:
1. Scan the same train
2. Verify: results are in English
3. Verify: a second cache entry was created (separate from the German one) — the same train now has two cache entries: one for `::en` and one for `::de`

---

## Task 14: German QA checklist

Before shipping v1.0.8, have a native German speaker verify:

- [ ] All tab labels correct in German
- [ ] Scan screen buttons and status messages correct
- [ ] Error messages are natural German (not machine-translated)
- [ ] AI-generated facts for ICE 4 (BR 412) are fluent German
- [ ] AI-generated facts for ICE 3 are fluent German
- [ ] AI-generated facts for S-Bahn 481 are fluent German
- [ ] Rarity reasons are fluent German
- [ ] Language picker screen copy is correct
- [ ] Profile language label and selector work correctly
- [ ] No English strings leaking through in German mode

---

## Adding more languages in future (FR, PL, NL, CS)

When ready to add a new language:
1. Add `"fr"` (or relevant code) to `SUPPORTED_LANGUAGES` in `settingsStore.ts`
2. Add `"fr"` to `VALID_LANGUAGES` in `identify.ts`
3. Create `frontend/locales/fr.json` (copy `en.json`, translate all values)
4. Add `fr: { translation: fr }` to the `i18n/index.ts` resources
5. Add the language option to the picker in `language-picker.tsx` and the profile selector
6. Update AI prompt language instructions to handle `"fr"` -> `"French (Francais)"`, etc.
7. No cache version bump needed — the `::fr` suffix is automatically a new cache namespace

---

## Summary of files touched

| File | Change |
|------|--------|
| `frontend/store/settingsStore.ts` | New — language preference store |
| `frontend/i18n/index.ts` | New — i18n config |
| `frontend/locales/en.json` | New — English translations |
| `frontend/locales/de.json` | New — German translations |
| `frontend/app/language-picker.tsx` | New — first-launch picker screen |
| `frontend/app/_layout.tsx` | Modified — init settings, show picker on first launch |
| `frontend/app/(tabs)/index.tsx` | Modified — translate scan screen |
| `frontend/app/(tabs)/history.tsx` | Modified — translate history screen |
| `frontend/app/(tabs)/profile.tsx` | Modified — translate profile, add language selector |
| `frontend/app/(tabs)/_layout.tsx` | Modified — translate tab labels |
| `frontend/app/results.tsx` | Modified — translate results labels |
| `frontend/app/sign-in.tsx` | Modified — translate auth screen |
| `frontend/app/paywall.tsx` | Modified — translate paywall |
| `frontend/services/api.ts` | Modified — pass language param |
| `frontend/__tests__/settingsStore.test.ts` | New — settings store tests |
| `backend/src/routes/identify.ts` | Modified — extract language, pass to services and cache |
| `backend/src/services/trainFacts.ts` | Modified — language instruction in prompt |
| `backend/src/services/trainSpecs.ts` | Modified — language instruction for status field |
| `backend/src/services/rarity.ts` | Modified — language instruction for reason field |
| `backend/src/services/trainCache.ts` | Modified — language in cache key, bump to v7 |
| `docs/ARCHITECTURE.md` | Update — document language support, cache v7 |
