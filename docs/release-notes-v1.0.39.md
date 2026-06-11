# v1.0.39 release notes — EN / DE / PL

For App Store Connect "What's New in This Version" + Play Console "Release notes" fields. Same content in both stores per locale for consistency. Polish diacritics (ą/ć/ę/ł/ń/ó/ś/ż/ź) and German umlauts (ä/ö/ü/ß) verified.

**Order rule** (per `feedback_release_notes_order.md`): bug fixes first, non-financial features second, financial offers last (none in this build).

**Length:** under 500 chars each for Play Console parity. Apple's limit is 4000, so the same copy fits comfortably there too.

**Locale note:** the "Baureihe" line appears only in the German notes — the change is invisible in other locales.

---

## English

```
What's new in v1.0.39:

- Fixed pending payments showing as failed — you'll now see a "payment processing" notice while your payment clears.
- Fixed the collection occasionally showing too few spots after time away — plus pull-to-refresh on your profile.
- New: make your collection public and browse other spotters' collections from the leaderboard — classes, rarity and blueprints only, never locations or photos.
```

---

## Deutsch (DE)

```
Neu in v1.0.39:

- Ausstehende Zahlungen erscheinen nicht mehr als fehlgeschlagen — du siehst stattdessen einen Hinweis zur Zahlungsverarbeitung.
- Behoben: Die Sammlung zeigte manchmal zu wenige Spots — plus Ziehen zum Aktualisieren im Profil.
- Neu: Mach deine Sammlung öffentlich und entdecke Sammlungen anderer Spotter über die Bestenliste — nur Klassen, Seltenheit und Blueprints, nie Standorte oder Fotos.
- Klassen heißen auf Deutsch jetzt "Baureihe" (z. B. Baureihe 218 statt BR 218).
```

---

## Polski (PL)

```
Nowości w v1.0.39:

- Oczekujące płatności nie są już oznaczane jako nieudane — zobaczysz komunikat, że płatność jest przetwarzana.
- Naprawiono: kolekcja czasami pokazywała za mało obserwacji — dodano też odświeżanie profilu przeciągnięciem.
- Nowość: udostępnij swoją kolekcję publicznie i przeglądaj kolekcje innych spotterów z rankingu — tylko klasy, rzadkość i blueprinty, nigdy lokalizacje ani zdjęcia.
```

---

## What v1.0.39 actually ships (for your reference, NOT for release notes)

| Item | Feature | User-visible? |
|---|---|---|
| Social Phase 1 | Opt-in public collections: `is_public` toggle, pressable leaderboard rows, `/spotter/[id]` grid screen | Yes — "make your collection public" line |
| PAYMENT_PENDING | RevenueCat deferred payments return `"pending"`, paywall shows "payment processing" Alert | Yes — pending-payments line |
| Profile stats | `loadHistory` session-refresh-and-retry + pull-to-refresh on Profile | Yes — "too few spots" line |
| DE Baureihe | `localiseClassName` DE-only display transform | Yes (DE only) — Baureihe line |

## Deliberately NOT mentioned

- **Migration 020 dependency** — the Social feature silently shows "private" everywhere until `020_social_public_profiles.sql` is applied to prod. Internal mechanics, not user-facing — but see submission reminders below.
- **Backend correction-layer fixes** (Class 59, Dosto, EN57 rarity, operator canonicalisation) — already live on Render, not part of this app build.
- **Pricing/intro offers** — per `feedback_dont_duplicate_store_intro_pricing.md`, the store sheets display these natively.

## Pre-submission reminders

- **Apply migration 020 FIRST** — the public-collection toggle writes `profiles.is_public`; until 020 is applied the toggle cannot persist and every public view shows "private". Do not start store rollout before 020 is live in prod (Supabase SQL editor + its verification block).
- Migration 021 (operator retro-fix) is NOT required for this build — separate, destructive, needs its own walkthrough.

## Apple submission reminders

Per `feedback_eula_link_required.md` — verify the EULA link (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) is still present in the App Description for every localisation (EN/DE/PL) before submitting. Apple auto-rejects with 3.1.2 Business otherwise.

App Review Notes: the spotter screen shows only opt-in public data (classes, rarity, blueprint images) — no user photos, no location. Worth one line in review notes if Apple asks about user-generated content.

## Play submission reminders

Per `eas.json` `releaseStatus: draft` — open Play Console, paste release notes per locale, click "Start rollout to Production".
