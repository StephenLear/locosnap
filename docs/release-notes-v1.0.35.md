# v1.0.35 release notes — EN / DE / PL

For App Store Connect "What's New in This Version" + Play Console "Release notes" fields. Same content in both stores per locale for consistency. Polish diacritics (ą/ć/ę/ł/ń/ó/ś/ż/ź) and German umlauts (ä/ö/ü/ß) verified.

**Order rule** (per `feedback_release_notes_order.md`): bug fixes first, non-financial features second, financial offers last (omitted here per `feedback_dont_duplicate_store_intro_pricing.md` — the store sheet shows intro pricing natively).

**Length:** under 500 chars each for Play Console parity. Apple's limit is 4000, so the same copy fits comfortably there too.

---

## English

```
What's new in v1.0.35:

- Better offline handling — your spots are queued locally and sync automatically when your connection returns.
- Pro subscribers expiring soon will see a renewal reminder in the app.
- Refreshed Pro paywall with clearer pricing structure and the weekly equivalent shown on the annual plan.
- Persistent home screen card showing your remaining free scans.
- Several smaller fixes and copy improvements.
```

---

## Deutsch (DE)

```
Neu in v1.0.35:

- Bessere Offline-Behandlung — deine Spots werden lokal gespeichert und automatisch synchronisiert, sobald die Verbindung zurück ist.
- Pro-Abonnenten sehen vor Ablauf eine Verlängerungserinnerung in der App.
- Überarbeiteter Pro-Bereich mit klarerer Preisstruktur und Wochenpreis beim Jahresplan.
- Neue Home-Karte mit deinen verbleibenden kostenlosen Scans.
- Mehrere kleinere Korrekturen und Textverbesserungen.
```

---

## Polski (PL)

```
Nowości w v1.0.35:

- Lepsza obsługa offline — obserwacje są zapisywane lokalnie i automatycznie synchronizowane po powrocie połączenia.
- Subskrybenci Pro otrzymują w aplikacji przypomnienie przed wygaśnięciem.
- Odświeżony ekran Pro z czytelniejszą strukturą cen i ceną tygodniową w planie rocznym.
- Nowa karta na ekranie głównym z pozostałymi darmowymi skanami.
- Kilka mniejszych poprawek i ulepszeń tekstów.
```

---

## What this v1.0.35 actually ships (for your reference, NOT for release notes)

| Phase | Feature | User-visible? |
|---|---|---|
| A | Pro paywall restructure — annual hero + per-week anchor + truthful intro copy | Yes — "Refreshed Pro paywall" line |
| B | Persistent tier-aware home Pro card replaces dismissable banners | Yes — "Persistent home screen card" line |
| C | Auto-open paywall on first rare/epic/legendary scan + scan 6/6 wall | Partial — folded into the paywall refresh |
| D | Wall-aware paywall hero + funded-by-subscriptions trust line | Partial — folded into paywall refresh |
| E | Offline write queue for saveSpot | Yes — "Better offline handling" line |
| F | Pro expiring-soon banner (replaces manual recovery emails) | Yes — "Pro subscribers expiring soon" line |
| G | Backend zero-engagement rescue push cron + migrations 016/017 | Invisible in-app (notification-only) |
| H | Dynamic softprompt intro price + version bump + docs | Folded into paywall refresh |

## Deliberately NOT mentioned

- **€1 first month intro offer** — per `feedback_dont_duplicate_store_intro_pricing.md`, the OS subscription sheet and store product listing already display intro pricing. Mentioning it in release notes is redundant and risks Apple rejecting for over-promising subscription value
- **The €1 Club tier** — deferred to v1.0.36, not in this build
- **Backend cron + migration mechanics** — internal infrastructure, not user-facing
- **Free tier scan count** — staying at 6 lifetime, no change worth mentioning

## Apple submission reminders

Per `feedback_eula_link_required.md` — verify the EULA link (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) is still present in the App Description for every localisation (EN/DE/PL) before submitting. Apple auto-rejects with 3.1.2 Business otherwise.

Per the v1.0.35 build plan — include a screenshot of the dismissable auto-open paywall (Phase C) in App Review Notes so Apple sees Apple §7 compliance up-front.

## Play submission reminders

Per `feedback_play_review_recovery.md` — Play production rollout typically starts at draft per `eas.json` `releaseStatus: draft`. Open Play Console, paste release notes per locale, click "Start rollout to Production".
