# LocoSnap v1.0.33 — Release Notes

Per [feedback_release_notes_order.md](memory:feedback_release_notes_order.md): bug fixes first, non-financial features second, financial offers last.

**Note:** intro offer pricing is NOT mentioned in release notes — Apple App Store and Google Play already display the intro price prominently within the OS-level subscription UI / product listing, so re-stating "from £1/month" in release notes is duplicative. See [feedback_dont_duplicate_store_intro_pricing.md](memory:feedback_dont_duplicate_store_intro_pricing.md).

Both App Store + Play Store use the same per-locale text. Char counts noted at bottom of each block — Play caps at 500 per language, Apple at 4000.

---

## English (`en`)

```
- Add your country flag to your profile — see country leaderboards and how you stack up.
- Clearer view when you've used all your free scans.
```

_Char count: ~163 / 500 (Play) / 4000 (Apple)_

---

## German (`de`)

```
- Im Profil kannst du jetzt deine Landesflagge hinzufügen — sieh, wie du auf den Länder-Bestenlisten abschneidest.
- Klarere Anzeige, wenn deine kostenlosen Scans aufgebraucht sind.
```

_Char count: ~188 / 500 (Play) / 4000 (Apple)_

---

## Polish (`pl`)

```
- Możesz teraz dodać flagę swojego kraju do profilu — zobacz, jak wypadasz w rankingach krajowych.
- Czytelniejsza informacja, gdy wykorzystasz wszystkie darmowe skany.
```

_Char count: ~169 / 500 (Play) / 4000 (Apple)_

---

## Where to paste

**App Store Connect** (per locale):
- App Store Connect → My Apps → LocoSnap → 1.0.33 (Prepare for Submission) → **What's New in This Version** → paste per-locale string

**Google Play Console** (per language):
- Play Console → LocoSnap → Production → Create new release → **Release notes** → paste per-language string inside the `<en-GB>...</en-GB>` / `<de-DE>...</de-DE>` / `<pl-PL>...</pl-PL>` blocks (or use the per-locale UI tabs)

---

## What's actually in v1.0.33 (build manifest)

| Commit | Item | User-visible? |
|---|---|---|
| `cb8b1ea` (2026-05-17) | Country-flag backfill banner on Profile tab | YES — first bullet |
| `55e9f83` (2026-05-19) | PaywallSoftPrompt camera-screen mirror + scan_6 lockout variant | YES — second bullet (lockout clarity); camera-screen Pro prompts are background presence, not announced |
| `d8b1ab3` (2026-05-19) | scan_2 leads with intro pricing copy (£1/€1/5,19 zł/month) | YES — third bullet |
| `7d2917f` (2026-05-19) | iOS permission strings DE+PL localised | Not announced — only iOS DE/PL users on first install see the change, doesn't justify a bullet |
| `41107af` (2026-05-19) | Version bump 1.0.32 → 1.0.33 | n/a |

Backend changes shipped to Render between v1.0.32 and v1.0.33 (T3 No. 563 fix `bd4d4bc`, SW1001 fix `56cd3e0`) flow to all installed clients automatically — they're not tied to the app version and don't belong in app-store release notes.

---

## Notes for review submission

- **No price claims in release notes** — the OS-level subscription UI (Apple's StoreKit sheet, Play's billing sheet) and the store product listing both already display the intro offer prominently. Re-stating it in release notes adds noise, burns Play's 500-char-per-language budget, and creates a possible duplicate-price-claim review trigger. The in-app `scan_2` soft prompt advertises "from £1/€1/5,19 zł month" at the right moment (before the user reaches the store flow) — that's the appropriate surface for the offer copy.
- No EULA / Terms of Use link changes needed — already in app description per [feedback_eula_link_required.md](memory:feedback_eula_link_required.md).

---

_Generated 2026-05-19 during the v1.0.33 build trigger session. Builds currently running:_
- _iOS: `086df856-dc6a-49cc-8517-02c4e802c3ad`_
- _Android: `a13cf59b-e21c-4a73-9e14-b70ad5061e0f`_
