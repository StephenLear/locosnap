# Leaderboard Phase 1 Identity Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the identity layer (country flag picker + spotter emoji picker + identity badge cluster) plus a one-time mandatory onboarding flow for v1.0.22, complementing the existing leaderboard.

**Architecture:** Pickers are reusable React Native components consumed by both a new onboarding screen (presented from root layout when `has_completed_identity_onboarding=false`) and a Profile-edit modal. Identity state lives in `authStore` (Zustand) with optimistic local updates + Supabase PATCH for signed-in users + AsyncStorage fallback for anonymous users. Three new columns on the Supabase `profiles` table. Anonymous-to-signed-in migration step lifts AsyncStorage values into the new profile on signup.

**Tech Stack:** React Native (Expo Router), Zustand, AsyncStorage, Supabase (PostgreSQL + RLS), TypeScript, ts-jest, expo-localization, expo-application.

**Design doc:** `docs/plans/2026-04-29-leaderboard-phase1-design.md` (committed `f16c9ac`)

**Out of scope:** Phases 2-5 (named leagues, leaderboard tabs, XP boosts, friends graph) — see `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_leaderboard_redesign.md`.

---

## Pre-flight

### Verify state

**Step 1: Confirm `main` is clean and synced with origin**

Run: `git status && git log origin/main..HEAD --oneline`
Expected: "nothing to commit, working tree clean" + empty commit log

**Step 2: Confirm tests pass on baseline**

Run: `cd frontend && npm test 2>&1 | tail -5`
Expected: all tests pass (current baseline ~55 tests)

**Step 3: Confirm backend tests still pass on baseline**

Run: `cd backend && npm test 2>&1 | tail -5`
Expected: 113/113 tests pass

---

## Task 1: Supabase migration `010_identity_layer.sql`

**Files:**
- Create: `supabase/migrations/010_identity_layer.sql`

**Step 1: Write the migration**

```sql
-- Add identity layer columns to profiles
-- See docs/plans/2026-04-29-leaderboard-phase1-design.md
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS spotter_emoji TEXT NULL,
  ADD COLUMN IF NOT EXISTS has_completed_identity_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional index for leaderboard country filter (Phase 3 will use this)
CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON profiles(country_code) WHERE country_code IS NOT NULL;

COMMENT ON COLUMN profiles.country_code IS 'ISO 3166-1 alpha-2 country code, user-selectable, default NULL';
COMMENT ON COLUMN profiles.spotter_emoji IS 'Identifier from spotterEmojis.ts (not the glyph)';
COMMENT ON COLUMN profiles.has_completed_identity_onboarding IS 'True after user completes the v1.0.22 identity onboarding flow';
```

**Step 2: Validate against staging Supabase first**

Run (in Supabase staging SQL editor): paste migration above
Expected: `ALTER TABLE` + `CREATE INDEX` + 3 `COMMENT` confirmations, no errors

**Step 3: Verify schema after migration**

Run (in Supabase SQL editor): `\d+ profiles`
Expected: three new columns visible with correct types and defaults

**Step 4: Verify existing rows are unaffected**

Run: `SELECT id, country_code, spotter_emoji, has_completed_identity_onboarding FROM profiles LIMIT 5`
Expected: existing rows have `country_code=NULL`, `spotter_emoji=NULL`, `has_completed_identity_onboarding=FALSE`

**Step 5: Commit migration file**

```bash
git add supabase/migrations/010_identity_layer.sql
git commit -m "feat(db): identity layer columns on profiles (010)"
```

**Step 6: Apply to production Supabase (manual, before frontend code reaches users)**

Through Supabase dashboard SQL editor during low-traffic window. Same SQL as Step 1. Verify with same `\d+ profiles` check. **Do NOT push frontend code that depends on these columns until production migration is applied.**

---

## Task 2: Country list data file

**Files:**
- Create: `frontend/data/countries.ts`

**Step 1: Write the failing test**

```ts
// frontend/__tests__/data/countries.test.ts
import { COUNTRIES, getCountryByCode, getDefaultCountryCodeForLocale } from '../../data/countries';

describe('countries data', () => {
  it('contains at least 195 entries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(195);
  });
  it('every entry has unique ISO code', () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('every entry has glyph and name', () => {
    COUNTRIES.forEach(c => {
      expect(c.glyph).toMatch(/^.{2,4}$/);
      expect(c.name.length).toBeGreaterThan(0);
    });
  });
  it('priority sort puts DE/PL/UK in first 5', () => {
    const top5 = COUNTRIES.slice(0, 5).map(c => c.code);
    expect(top5).toContain('DE');
    expect(top5).toContain('PL');
    expect(top5).toContain('GB');
  });
  it('getCountryByCode returns the entry', () => {
    expect(getCountryByCode('DE')?.name).toBe('Germany');
    expect(getCountryByCode('XX')).toBeUndefined();
  });
  it('getDefaultCountryCodeForLocale resolves de-DE to DE', () => {
    expect(getDefaultCountryCodeForLocale('de-DE')).toBe('DE');
    expect(getDefaultCountryCodeForLocale('pl-PL')).toBe('PL');
    expect(getDefaultCountryCodeForLocale('en-GB')).toBe('GB');
  });
  it('getDefaultCountryCodeForLocale falls back to GB on unknown', () => {
    expect(getDefaultCountryCodeForLocale('xx-YY')).toBe('GB');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/data/countries.test.ts`
Expected: FAIL — module not found

**Step 3: Write the data file**

```ts
// frontend/data/countries.ts
export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  glyph: string; // flag emoji
}

const PRIORITY_CODES = ['DE', 'PL', 'GB', 'AT', 'CH', 'NL', 'FR', 'IT', 'ES', 'CZ', 'SK', 'HU', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'IE', 'US'];

const ALL_COUNTRIES: Country[] = [
  { code: 'DE', name: 'Germany', glyph: '🇩🇪' },
  { code: 'PL', name: 'Poland', glyph: '🇵🇱' },
  { code: 'GB', name: 'United Kingdom', glyph: '🇬🇧' },
  // ... (full ISO list — generate from a reference source, ~195 entries)
];

// Sort: priority first (in PRIORITY_CODES order), then alphabetical
export const COUNTRIES: Country[] = (() => {
  const priority = PRIORITY_CODES
    .map(code => ALL_COUNTRIES.find(c => c.code === code))
    .filter((c): c is Country => c !== undefined);
  const rest = ALL_COUNTRIES
    .filter(c => !PRIORITY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...priority, ...rest];
})();

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code.toUpperCase());
}

export function getDefaultCountryCodeForLocale(locale: string): string {
  const region = locale.split('-')[1]?.toUpperCase();
  if (region && getCountryByCode(region)) return region;
  return 'GB';
}
```

(Engineer note: populate ALL_COUNTRIES from an ISO reference list — `world-countries` npm package or hardcode from Wikipedia.)

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/data/countries.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add frontend/data/countries.ts frontend/__tests__/data/countries.test.ts
git commit -m "feat(frontend): country list data + lookup helpers"
```

---

## Task 3: Spotter emoji set data file

**Files:**
- Create: `frontend/data/spotterEmojis.ts`
- Create: `frontend/assets/emoji-svg/` (directory for Pro-exclusive SVG icons)

**Step 1: Write the failing test**

```ts
// frontend/__tests__/data/spotterEmojis.test.ts
import { SPOTTER_EMOJIS, getEmojiById, canSelectEmoji } from '../../data/spotterEmojis';

describe('spotterEmojis data', () => {
  it('has at least 10 free entries', () => {
    expect(SPOTTER_EMOJIS.filter(e => !e.isPro).length).toBeGreaterThanOrEqual(10);
  });
  it('has at least 20 Pro entries', () => {
    expect(SPOTTER_EMOJIS.filter(e => e.isPro).length).toBeGreaterThanOrEqual(20);
  });
  it('every id is unique', () => {
    const ids = SPOTTER_EMOJIS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Unicode entries have valid glyph', () => {
    SPOTTER_EMOJIS
      .filter(e => e.source === 'unicode')
      .forEach(e => {
        expect(e.glyph).toBeTruthy();
        expect(e.glyph!.length).toBeGreaterThan(0);
      });
  });
  it('SVG entries have asset path', () => {
    SPOTTER_EMOJIS
      .filter(e => e.source === 'svg')
      .forEach(e => {
        expect(e.svgAsset).toMatch(/^.+\.svg$/);
      });
  });
  it('every entry has label', () => {
    SPOTTER_EMOJIS.forEach(e => {
      expect(e.label.length).toBeGreaterThan(0);
    });
  });
  it('getEmojiById returns the entry', () => {
    expect(getEmojiById('train_steam')?.label).toBeTruthy();
    expect(getEmojiById('nonexistent')).toBeUndefined();
  });
  it('canSelectEmoji: free emoji is always selectable', () => {
    const free = SPOTTER_EMOJIS.find(e => !e.isPro)!;
    expect(canSelectEmoji(free.id, false)).toBe(true);
    expect(canSelectEmoji(free.id, true)).toBe(true);
  });
  it('canSelectEmoji: Pro emoji is only selectable for Pro users', () => {
    const pro = SPOTTER_EMOJIS.find(e => e.isPro)!;
    expect(canSelectEmoji(pro.id, false)).toBe(false);
    expect(canSelectEmoji(pro.id, true)).toBe(true);
  });
  it('canSelectEmoji: unknown id returns false', () => {
    expect(canSelectEmoji('nonexistent', true)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/data/spotterEmojis.test.ts`
Expected: FAIL — module not found

**Step 3: Write the data file**

```ts
// frontend/data/spotterEmojis.ts
export interface SpotterEmoji {
  id: string;
  label: string;
  isPro: boolean;
  source: 'unicode' | 'svg';
  glyph?: string;
  svgAsset?: string;
}

export const SPOTTER_EMOJIS: SpotterEmoji[] = [
  // Free tier (~10) — Unicode train iconography
  { id: 'train_steam', label: 'Steam locomotive', isPro: false, source: 'unicode', glyph: '🚂' },
  { id: 'train_diesel', label: 'Diesel train', isPro: false, source: 'unicode', glyph: '🚆' },
  { id: 'train_metro', label: 'Metro', isPro: false, source: 'unicode', glyph: '🚇' },
  { id: 'tram', label: 'Tram', isPro: false, source: 'unicode', glyph: '🚊' },
  { id: 'station', label: 'Station', isPro: false, source: 'unicode', glyph: '🚉' },
  { id: 'tracks', label: 'Tracks', isPro: false, source: 'unicode', glyph: '🛤️' },
  { id: 'ticket', label: 'Ticket', isPro: false, source: 'unicode', glyph: '🎫' },
  { id: 'high_speed', label: 'High-speed train', isPro: false, source: 'unicode', glyph: '🚄' },
  { id: 'monorail', label: 'Monorail', isPro: false, source: 'unicode', glyph: '🚝' },
  { id: 'railway_car', label: 'Railway car', isPro: false, source: 'unicode', glyph: '🚃' },

  // Pro tier (~20) — Mix of Unicode + custom SVG for railway-specific symbols
  { id: 'pro_signal_box', label: 'Signal box', isPro: true, source: 'svg', svgAsset: 'emoji-svg/signal-box.svg' },
  { id: 'pro_semaphore', label: 'Semaphore signal', isPro: true, source: 'svg', svgAsset: 'emoji-svg/semaphore.svg' },
  { id: 'pro_signal_lights', label: 'Signal lights', isPro: true, source: 'svg', svgAsset: 'emoji-svg/signal-lights.svg' },
  { id: 'pro_pantograph', label: 'Pantograph', isPro: true, source: 'svg', svgAsset: 'emoji-svg/pantograph.svg' },
  { id: 'pro_overhead_line', label: 'Overhead line', isPro: true, source: 'svg', svgAsset: 'emoji-svg/overhead-line.svg' },
  { id: 'pro_buffer_stop', label: 'Buffer stop', isPro: true, source: 'svg', svgAsset: 'emoji-svg/buffer-stop.svg' },
  { id: 'pro_turnout', label: 'Turnout (points)', isPro: true, source: 'svg', svgAsset: 'emoji-svg/turnout.svg' },
  { id: 'pro_water_crane', label: 'Water crane', isPro: true, source: 'svg', svgAsset: 'emoji-svg/water-crane.svg' },
  { id: 'pro_roundhouse', label: 'Roundhouse', isPro: true, source: 'svg', svgAsset: 'emoji-svg/roundhouse.svg' },
  { id: 'pro_turntable', label: 'Turntable', isPro: true, source: 'svg', svgAsset: 'emoji-svg/turntable.svg' },
  { id: 'pro_coal_tender', label: 'Coal tender', isPro: true, source: 'svg', svgAsset: 'emoji-svg/coal-tender.svg' },
  { id: 'pro_ice_4', label: 'ICE 4', isPro: true, source: 'svg', svgAsset: 'emoji-svg/ice-4.svg' },
  { id: 'pro_vectron', label: 'Vectron', isPro: true, source: 'svg', svgAsset: 'emoji-svg/vectron.svg' },
  { id: 'pro_class_91', label: 'Class 91', isPro: true, source: 'svg', svgAsset: 'emoji-svg/class-91.svg' },
  { id: 'pro_en57', label: 'EN57', isPro: true, source: 'svg', svgAsset: 'emoji-svg/en57.svg' },
  { id: 'pro_steam_drg52', label: 'DRG 52 Kriegslok', isPro: true, source: 'svg', svgAsset: 'emoji-svg/drg52.svg' },
  { id: 'pro_uk_signal_box', label: 'UK signal box', isPro: true, source: 'unicode', glyph: '🚥' },
  { id: 'pro_compass', label: 'Compass', isPro: true, source: 'unicode', glyph: '🧭' },
  { id: 'pro_camera', label: 'Camera', isPro: true, source: 'unicode', glyph: '📷' },
  { id: 'pro_clipboard', label: 'Spotter clipboard', isPro: true, source: 'unicode', glyph: '📋' },
];

export function getEmojiById(id: string): SpotterEmoji | undefined {
  return SPOTTER_EMOJIS.find(e => e.id === id);
}

export function canSelectEmoji(id: string, isPro: boolean): boolean {
  const emoji = getEmojiById(id);
  if (!emoji) return false;
  if (!emoji.isPro) return true;
  return isPro;
}
```

(Engineer note: the SVG assets need to be created/sourced separately — this is a 2h asset-curation task before final emoji set ships. Placeholder SVG files in `frontend/assets/emoji-svg/` are sufficient for code-side completion.)

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/data/spotterEmojis.test.ts`
Expected: 10 tests PASS

**Step 5: Commit**

```bash
git add frontend/data/spotterEmojis.ts frontend/__tests__/data/spotterEmojis.test.ts frontend/assets/emoji-svg/
git commit -m "feat(frontend): spotter emoji set (free + Pro tiers)"
```

---

## Task 4: Extend `Profile` interface in `authStore.ts`

**Files:**
- Modify: `frontend/store/authStore.ts:12-25`

**Step 1: Write the failing test**

```ts
// frontend/__tests__/authStore.identity.test.ts
import { Profile } from '../store/authStore';

describe('Profile interface — identity fields', () => {
  it('has country_code, spotter_emoji, has_completed_identity_onboarding', () => {
    const sample: Profile = {
      id: 'x', username: null, avatar_url: null, level: 1, xp: 0,
      streak_current: 0, streak_best: 0, last_spot_date: null,
      daily_scans_used: 0, is_pro: false, blueprint_credits: 0, region: null,
      country_code: 'DE',
      spotter_emoji: 'train_steam',
      has_completed_identity_onboarding: true,
    };
    expect(sample.country_code).toBe('DE');
    expect(sample.spotter_emoji).toBe('train_steam');
    expect(sample.has_completed_identity_onboarding).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/authStore.identity.test.ts`
Expected: FAIL — TypeScript errors on missing fields

**Step 3: Modify `authStore.ts` Profile interface**

Add three fields to `Profile` (after `region`):

```ts
export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak_current: number;
  streak_best: number;
  last_spot_date: string | null;
  daily_scans_used: number;
  is_pro: boolean;
  blueprint_credits: number;
  region: string | null;
  country_code: string | null;
  spotter_emoji: string | null;
  has_completed_identity_onboarding: boolean;
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/authStore.identity.test.ts`
Expected: 1 test PASS

**Step 5: Commit**

```bash
git add frontend/store/authStore.ts frontend/__tests__/authStore.identity.test.ts
git commit -m "feat(frontend): extend Profile with identity fields"
```

---

## Task 5: Add `updateProfileIdentity` Supabase helper

**Files:**
- Modify: `frontend/services/supabase.ts`

**Step 1: Write the failing test**

```ts
// frontend/__tests__/services.identity.test.ts
import { updateProfileIdentity } from '../services/supabase';

jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn().mockReturnValue({ update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) }
}));

describe('updateProfileIdentity', () => {
  it('PATCHes the new columns by user id', async () => {
    const result = await updateProfileIdentity('user-1', { country_code: 'DE', spotter_emoji: 'train_steam' });
    expect(result.error).toBeNull();
  });
  it('handles partial updates (only country_code)', async () => {
    const result = await updateProfileIdentity('user-1', { country_code: 'PL' });
    expect(result.error).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/services.identity.test.ts`
Expected: FAIL — function not exported

**Step 3: Add helper to `services/supabase.ts`**

```ts
export interface IdentityUpdates {
  country_code?: string;
  spotter_emoji?: string;
  has_completed_identity_onboarding?: boolean;
}

export async function updateProfileIdentity(userId: string, updates: IdentityUpdates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  return { data, error };
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/services.identity.test.ts`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add frontend/services/supabase.ts frontend/__tests__/services.identity.test.ts
git commit -m "feat(frontend): updateProfileIdentity Supabase helper"
```

---

## Task 6: Add three identity actions to `authStore.ts`

**Files:**
- Modify: `frontend/store/authStore.ts` (interface + implementation)

**Step 1: Write the failing tests**

```ts
// frontend/__tests__/authStore.actions.test.ts
import { useAuthStore } from '../store/authStore';

describe('authStore identity actions', () => {
  beforeEach(() => {
    useAuthStore.setState({ profile: null, session: null, user: null });
  });

  it('updateCountryCode optimistically updates Zustand', async () => {
    useAuthStore.setState({ profile: makeProfile({ country_code: null }), session: makeSession() });
    await useAuthStore.getState().updateCountryCode('DE');
    expect(useAuthStore.getState().profile?.country_code).toBe('DE');
  });

  it('updateSpotterEmoji optimistically updates Zustand', async () => {
    useAuthStore.setState({ profile: makeProfile({ spotter_emoji: null }), session: makeSession() });
    await useAuthStore.getState().updateSpotterEmoji('train_steam');
    expect(useAuthStore.getState().profile?.spotter_emoji).toBe('train_steam');
  });

  it('markIdentityOnboardingComplete sets the flag', async () => {
    useAuthStore.setState({ profile: makeProfile({ has_completed_identity_onboarding: false }), session: makeSession() });
    await useAuthStore.getState().markIdentityOnboardingComplete();
    expect(useAuthStore.getState().profile?.has_completed_identity_onboarding).toBe(true);
  });

  it('updateCountryCode falls back to AsyncStorage when no session', async () => {
    useAuthStore.setState({ profile: null, session: null });
    await useAuthStore.getState().updateCountryCode('PL');
    // Verify AsyncStorage write — mock implementation needed
  });
});
```

(Engineer note: include `makeProfile` and `makeSession` test fixture helpers at top of test file.)

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx jest __tests__/authStore.actions.test.ts`
Expected: FAIL — actions not defined

**Step 3: Add to `AuthState` interface and implementation**

```ts
// In AuthState interface
updateCountryCode: (code: string) => Promise<void>;
updateSpotterEmoji: (emojiId: string) => Promise<void>;
markIdentityOnboardingComplete: () => Promise<void>;

// In create() block
updateCountryCode: async (code: string) => {
  const { profile, session } = get();
  if (profile) {
    set({ profile: { ...profile, country_code: code } });
  }
  await AsyncStorage.setItem('locosnap_anonymous_identity_country', code);
  if (session?.user?.id) {
    const { error } = await updateProfileIdentity(session.user.id, { country_code: code });
    if (error) {
      addBreadcrumb('updateCountryCode Supabase failed', { error });
      // Revert handled via retry-queue (existing pattern)
    }
  }
},

updateSpotterEmoji: async (emojiId: string) => {
  const { profile, session } = get();
  if (profile) {
    set({ profile: { ...profile, spotter_emoji: emojiId } });
  }
  await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', emojiId);
  if (session?.user?.id) {
    const { error } = await updateProfileIdentity(session.user.id, { spotter_emoji: emojiId });
    if (error) {
      addBreadcrumb('updateSpotterEmoji Supabase failed', { error });
    }
  }
},

markIdentityOnboardingComplete: async () => {
  const { profile, session } = get();
  if (profile) {
    set({ profile: { ...profile, has_completed_identity_onboarding: true } });
  }
  await AsyncStorage.setItem('locosnap_identity_onboarding_completed', 'true');
  if (session?.user?.id) {
    const { error } = await updateProfileIdentity(session.user.id, { has_completed_identity_onboarding: true });
    if (error) {
      addBreadcrumb('markIdentityOnboardingComplete Supabase failed', { error });
    }
  }
},
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx jest __tests__/authStore.actions.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add frontend/store/authStore.ts frontend/__tests__/authStore.actions.test.ts
git commit -m "feat(frontend): authStore identity actions (country/emoji/onboarding)"
```

---

## Task 7: `CountryFlagPicker` component (compact + full modes)

**Files:**
- Create: `frontend/components/CountryFlagPicker.tsx`

**Step 1: Write component (no unit tests — visual component, manual QA)**

```tsx
// frontend/components/CountryFlagPicker.tsx
import { useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable } from 'react-native';
import { COUNTRIES, getCountryByCode, Country } from '../data/countries';
import { theme } from '../constants/theme';

interface Props {
  selectedCode: string | null;
  mode: 'compact' | 'full';
  onSelect: (code: string) => void;
}

export function CountryFlagPicker({ selectedCode, mode, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [internalMode, setInternalMode] = useState(mode);

  const selected = selectedCode ? getCountryByCode(selectedCode) : undefined;
  const filtered = search.trim() === ''
    ? COUNTRIES
    : COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase() === search.toLowerCase());

  if (internalMode === 'compact') {
    return (
      <View style={{ alignItems: 'center', padding: 24 }}>
        {selected && (
          <Text style={{ fontSize: 80 }}>{selected.glyph}</Text>
        )}
        <Text style={{ fontSize: 18, color: theme.colors.text, marginTop: 12 }}>
          {selected?.name ?? 'No country selected'}
        </Text>
        <Pressable onPress={() => setInternalMode('full')}>
          <Text style={{ color: theme.colors.primary, marginTop: 12 }}>Change country</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search country..."
        style={{ padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text }}
      />
      <FlatList
        data={filtered}
        keyExtractor={c => c.code}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item.code)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
          >
            <Text style={{ fontSize: 32, marginRight: 12 }}>{item.glyph}</Text>
            <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>{item.name}</Text>
            {selectedCode === item.code && <Text style={{ color: theme.colors.primary }}>✓</Text>}
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.muted }}>No countries match "{search}"</Text>
          </View>
        )}
      />
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/CountryFlagPicker.tsx
git commit -m "feat(frontend): CountryFlagPicker component (compact + full modes)"
```

---

## Task 8: `EmojiPicker` component with Pro lock

**Files:**
- Create: `frontend/components/EmojiPicker.tsx`

**Step 1: Write component**

```tsx
// frontend/components/EmojiPicker.tsx
import { View, Text, FlatList, Pressable, Image } from 'react-native';
import { SPOTTER_EMOJIS, canSelectEmoji, SpotterEmoji } from '../data/spotterEmojis';
import { theme } from '../constants/theme';

interface Props {
  selectedId: string | null;
  isPro: boolean;
  onSelect: (id: string) => void;
  onProLockTapped: () => void;
}

export function EmojiPicker({ selectedId, isPro, onSelect, onProLockTapped }: Props) {
  return (
    <FlatList
      data={SPOTTER_EMOJIS}
      keyExtractor={e => e.id}
      numColumns={5}
      renderItem={({ item }) => {
        const selectable = canSelectEmoji(item.id, isPro);
        const isSelected = selectedId === item.id;
        const isLocked = item.isPro && !isPro;

        return (
          <Pressable
            onPress={() => {
              if (isLocked) onProLockTapped();
              else if (selectable) onSelect(item.id);
            }}
            style={{
              flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
              margin: 4, borderRadius: 8,
              backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
              opacity: isLocked ? 0.4 : 1,
            }}
          >
            {item.source === 'unicode' && <Text style={{ fontSize: 32 }}>{item.glyph}</Text>}
            {item.source === 'svg' && (
              <Image source={{ uri: `asset:/${item.svgAsset}` }} style={{ width: 32, height: 32 }} />
            )}
            {isLocked && (
              <Text style={{ position: 'absolute', top: 4, right: 4, fontSize: 12 }}>🔒</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/EmojiPicker.tsx
git commit -m "feat(frontend): EmojiPicker component with Pro lock"
```

---

## Task 9: `IdentityBadge` display component

**Files:**
- Create: `frontend/components/IdentityBadge.tsx`

**Step 1: Write component**

```tsx
// frontend/components/IdentityBadge.tsx
import { View, Text, Image } from 'react-native';
import { getCountryByCode } from '../data/countries';
import { getEmojiById } from '../data/spotterEmojis';
import { theme } from '../constants/theme';

interface Props {
  countryCode: string | null;
  emojiId: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function IdentityBadge({ countryCode, emojiId, size = 'md' }: Props) {
  const country = countryCode ? getCountryByCode(countryCode) : undefined;
  const emoji = emojiId ? getEmojiById(emojiId) : undefined;

  const flagSize = size === 'sm' ? 14 : size === 'md' ? 18 : 24;
  const emojiSize = size === 'sm' ? 16 : size === 'md' ? 22 : 28;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {country && <Text style={{ fontSize: flagSize }}>{country.glyph}</Text>}
      {emoji?.source === 'unicode' && <Text style={{ fontSize: emojiSize }}>{emoji.glyph}</Text>}
      {emoji?.source === 'svg' && (
        <Image source={{ uri: `asset:/${emoji.svgAsset}` }} style={{ width: emojiSize, height: emojiSize }} />
      )}
    </View>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/IdentityBadge.tsx
git commit -m "feat(frontend): IdentityBadge display component"
```

---

## Task 10: `onboarding-identity.tsx` screen — multi-step flow

**Files:**
- Create: `frontend/app/onboarding-identity.tsx`

**Step 1: Write the screen with step state machine**

Implement a 3-step (signed-in) or 4-step (anonymous) flow as described in the design doc. Reuses CountryFlagPicker, EmojiPicker. Uses Expo Router for screen modal.

State machine:
- `step: 1 | 2 | 3 | 4`
- Step 1: Welcome (single CTA → step 2)
- Step 2: Country flag picker (compact mode initially, can expand to full)
- Step 3: Emoji picker
- Step 4 (anonymous only): Email signup or "Continue without account"

On final step CTA: call `markIdentityOnboardingComplete()` then `router.replace('/(tabs)/')`.

If signed-in user, skip step 4. If anonymous and they tap "Send code", route to existing `/sign-in?mode=signup` with onboarding-completion flag passed in params.

(Engineer note: see design doc Section 1 for full UX copy. Use existing `/sign-in.tsx` patterns for OTP. i18n strings added in Task 14.)

**Step 2: Commit**

```bash
git add frontend/app/onboarding-identity.tsx
git commit -m "feat(frontend): onboarding-identity screen (3-4 step flow)"
```

---

## Task 11: `_layout.tsx` redirect logic

**Files:**
- Modify: `frontend/app/_layout.tsx`

**Step 1: Write the failing test**

```ts
// frontend/__tests__/onboardingGate.test.ts
import { shouldShowOnboarding } from '../app/_layout-helpers';

describe('shouldShowOnboarding', () => {
  it('returns true for signed-in user with has_completed_identity_onboarding=false', () => {
    expect(shouldShowOnboarding({ profile: { has_completed_identity_onboarding: false } as any, anonymousFlag: null })).toBe(true);
  });
  it('returns false for signed-in user with has_completed_identity_onboarding=true', () => {
    expect(shouldShowOnboarding({ profile: { has_completed_identity_onboarding: true } as any, anonymousFlag: null })).toBe(false);
  });
  it('returns true for anonymous user with no flag', () => {
    expect(shouldShowOnboarding({ profile: null, anonymousFlag: null })).toBe(true);
  });
  it('returns false for anonymous user with flag set', () => {
    expect(shouldShowOnboarding({ profile: null, anonymousFlag: 'true' })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/onboardingGate.test.ts`
Expected: FAIL — module not found

**Step 3: Extract the gate logic into a testable helper**

Create `frontend/app/_layout-helpers.ts`:

```ts
import { Profile } from '../store/authStore';

interface GateInput {
  profile: Profile | null;
  anonymousFlag: string | null;
}

export function shouldShowOnboarding({ profile, anonymousFlag }: GateInput): boolean {
  if (profile) return !profile.has_completed_identity_onboarding;
  return anonymousFlag !== 'true';
}
```

Then in `_layout.tsx`, after auth init:

```ts
useEffect(() => {
  (async () => {
    const flag = await AsyncStorage.getItem('locosnap_identity_onboarding_completed');
    const profile = useAuthStore.getState().profile;
    if (shouldShowOnboarding({ profile, anonymousFlag: flag })) {
      router.push('/onboarding-identity');
    }
  })();
}, [profile?.id]);
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/onboardingGate.test.ts`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add frontend/app/_layout-helpers.ts frontend/app/_layout.tsx frontend/__tests__/onboardingGate.test.ts
git commit -m "feat(frontend): onboarding gate logic in root layout"
```

---

## Task 12: `profile.tsx` — add identity badge cluster + edit modal

**Files:**
- Modify: `frontend/app/(tabs)/profile.tsx`

**Step 1: Add IdentityBadge cluster above existing username controls**

Tappable area opens a Modal containing CountryFlagPicker (compact) and EmojiPicker side by side, with Save / Cancel buttons. On Save, call `updateCountryCode` and `updateSpotterEmoji` from authStore.

For anonymous users, also show an "Add account" link in the modal that routes to `/sign-in?mode=signup`.

**Step 2: Commit**

```bash
git add frontend/app/(tabs)/profile.tsx
git commit -m "feat(frontend): identity badge cluster + edit modal on Profile"
```

---

## Task 13: `leaderboard.tsx` — render flag + emoji on rows

**Files:**
- Modify: `frontend/app/(tabs)/leaderboard.tsx`

**Step 1: Update leaderboard fetch query**

The leaderboard fetch needs to include `country_code, spotter_emoji` in the SELECT. Check the existing leaderboard data path — likely `services/supabase.ts` or a Supabase RPC. Add the columns.

**Step 2: Update each row's render to include `<IdentityBadge size="sm" />`**

Pass row's `country_code` and `spotter_emoji` to the component. Place it next to the username.

**Step 3: Commit**

```bash
git add frontend/app/(tabs)/leaderboard.tsx frontend/services/supabase.ts
git commit -m "feat(frontend): flag + emoji on leaderboard rows"
```

---

## Task 14: i18n EN + DE copy for onboarding

**Files:**
- Modify: `frontend/i18n/en.json`
- Modify: `frontend/i18n/de.json`

**Step 1: Add strings**

```json
{
  "onboarding_welcome_title": "Set up your spotter identity",
  "onboarding_welcome_body": "We've added country flags, achievements, and a new leaderboard. Set up your identity in 30 seconds.",
  "onboarding_country_title": "Pick your country",
  "onboarding_country_subtitle": "Looks right? Confirm.",
  "onboarding_country_change": "Change country",
  "onboarding_emoji_title": "Pick your spotter emoji",
  "onboarding_emoji_pro_locked": "Subscribe to unlock",
  "onboarding_email_title": "Save your spots and join the leaderboard",
  "onboarding_email_subtitle": "We'll email you a code. No password needed.",
  "onboarding_email_continue": "Continue without account",
  "onboarding_done_cta": "Done",
  "onboarding_continue_cta": "Continue"
}
```

DE translations — equivalent strings.

**Step 2: Commit**

```bash
git add frontend/i18n/en.json frontend/i18n/de.json
git commit -m "i18n: onboarding identity copy (EN + DE)"
```

---

## Task 15: Anonymous → signed-in migration logic

**Files:**
- Modify: `frontend/store/authStore.ts` (in `signInWithMagicLink` post-success block)

**Step 1: Write the failing test**

```ts
// frontend/__tests__/anonymousMigration.test.ts
import { migrateAnonymousIdentity } from '../store/authStore-helpers';

describe('migrateAnonymousIdentity', () => {
  it('returns updates from AsyncStorage when profile has NULLs', async () => {
    // Mock AsyncStorage with country=DE, emoji=train_steam
    const updates = await migrateAnonymousIdentity({
      profile: { country_code: null, spotter_emoji: null } as any,
    });
    expect(updates).toEqual({ country_code: 'DE', spotter_emoji: 'train_steam' });
  });
  it('returns null updates when AsyncStorage is empty', async () => {
    const updates = await migrateAnonymousIdentity({ profile: { country_code: null, spotter_emoji: null } as any });
    expect(updates).toBeNull();
  });
  it('skips migration when profile already has values', async () => {
    const updates = await migrateAnonymousIdentity({ profile: { country_code: 'PL', spotter_emoji: 'train_diesel' } as any });
    expect(updates).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest __tests__/anonymousMigration.test.ts`
Expected: FAIL — function not defined

**Step 3: Add migration helper**

In `frontend/store/authStore-helpers.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile } from './authStore';

export async function migrateAnonymousIdentity({ profile }: { profile: Profile | null }) {
  if (!profile) return null;
  if (profile.country_code !== null && profile.spotter_emoji !== null) return null;

  const country = await AsyncStorage.getItem('locosnap_anonymous_identity_country');
  const emoji = await AsyncStorage.getItem('locosnap_anonymous_identity_emoji');

  if (!country && !emoji) return null;

  const updates: Record<string, string> = {};
  if (country && profile.country_code === null) updates.country_code = country;
  if (emoji && profile.spotter_emoji === null) updates.spotter_emoji = emoji;
  return Object.keys(updates).length > 0 ? updates : null;
}
```

In `authStore.ts` post-OTP-success block, call the helper and PATCH if it returns updates. Then clear the AsyncStorage keys.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest __tests__/anonymousMigration.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add frontend/store/authStore-helpers.ts frontend/store/authStore.ts frontend/__tests__/anonymousMigration.test.ts
git commit -m "feat(frontend): anonymous-to-signed-in identity migration"
```

---

## Task 16: Run full frontend test suite

**Step 1: Run all tests**

Run: `cd frontend && npm test`
Expected: ~80 tests PASS (existing 55 + new ~25)

**Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

**Step 3: If anything fails, debug before proceeding**

---

## Task 17: Manual QA on real device

Walk through the 6 manual QA flows from the design doc Section 5:

1. Anonymous → email-skip path
2. Anonymous → email-submit path (OTP completion)
3. Existing signed-in user
4. Pro user picks Pro emoji
5. Free user attempts Pro emoji (paywall upsell)
6. Edit flow post-onboarding

If any flow fails, fix and re-run tests.

---

## Task 18: Apply migration to production Supabase

**Step 1: Confirm staging migration validated** (already done in Task 1 step 6)

**Step 2: Apply same migration to production Supabase via dashboard**

Run via Supabase dashboard SQL editor during low-traffic window. Same SQL as Task 1 step 1.

**Step 3: Verify**

Run: `\d+ profiles` in production SQL editor.
Expected: three new columns visible.

**Step 4: Smoke test from app**

Open app on dev device pointing at production Supabase, walk through onboarding, verify columns populated for the test user.

---

## Task 19: Push commits + announce build trigger

**Step 1: Push all commits to origin/main**

Run: `git push origin main`
Expected: all Task 1-15 commits land on origin/main

**Step 2: Confirm with user that EAS build for v1.0.22 is approved**

Per `feedback_build_approval.md`, do NOT trigger build without explicit user confirmation in this session.

**Step 3: Trigger EAS build (only with user approval)**

Run: `cd frontend && eas build --platform all --profile production`

**Step 4: Monitor build through EAS dashboard**

Once complete, retrieve APK/IPA links and submit via `eas submit`.

---

## Risks and gotchas

- **Migration needs to apply to prod Supabase BEFORE the app code that reads/writes the columns ships.** Otherwise any signed-in user on v1.0.22 will get NULL/error on first identity write. Apply migration first, then push, then trigger EAS build.
- **SVG emoji assets are placeholder.** The 16 Pro-exclusive SVG icons need real designs before public release. Asset curation is a parallel ~2h task — track separately.
- **Existing leaderboard query** must be updated to include identity columns (Task 13 step 1). If it's a Supabase RPC rather than a direct query, the RPC needs an update too.
- **Onboarding gate fires on every `profile?.id` change** — make sure it only fires once per session via a debounce or session-scoped flag, otherwise users will see the onboarding modal stack up.
- **Anonymous migration in `signInWithMagicLink`** — must run BEFORE the Zustand state syncs from Supabase, or the AsyncStorage values will be overwritten by the NULL values from the fresh profile. Order matters.

---

## Success criteria

- [ ] All ~80 frontend tests pass
- [ ] TypeScript clean
- [ ] Migration applied to production Supabase
- [ ] All 6 manual QA flows pass on real device
- [ ] Code merged to main, pushed to origin
- [ ] User has approved EAS build trigger
- [ ] EAS build complete and submitted to stores

After all six items, Phase 1 is shipped.
