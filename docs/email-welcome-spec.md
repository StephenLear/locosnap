# Welcome Email — Implementation Spec

**Status:** SHIPPED to branch 2026-05-18 (hybrid: spec copy + branded HTML wrapper with logo). Not yet deployed — pending push + Render env vars + Supabase Auth webhook config. Backfill to ~470 existing non-Pro users deferred to a separate session.

**Origin:** Research session 2026-05-18. Triggered by user observation that LocoSnap sends zero email today. Research agent surveyed comparable freemium identification apps (Merlin, PictureThis, Pl@ntNet, Shazam, Duolingo, Strava) and found that the standard B2B "4-email, no selling until email 4" template is wrong for consumer mobile — Day 0 is when ~50% of paid conversions happen, and comparable apps run sparse event-triggered sends, not scheduled drips. Full research findings live in the 2026-05-18 handover.

This spec covers the **first** of an eventual 3–4 event-triggered emails. Future emails (first-scan / scan 5-of-6 / 7-day-dormant) are not specified here.

---

## Approved copy

**Subject line:** `Welcome to LocoSnap / Willkommen / Witaj`

**Order:** DE → EN → PL (DE first = #1 market; EN middle as universal bridge; PL last = #2 market).

**Body — verbatim, no edits:**

```
Hi,

willkommen bei LocoSnap — du bist im Club.

Worum es geht: Zug fotografieren, die App erkennt ihn, du baust deine Sammlung auf. Klassen, Baujahre, Strecken — alles drin.

Eine Sache vorweg: keine Werbung, keine Pop-ups, keine verkauften Daten. Ich baue die App allein, neben der Arbeit. Pro ist das, was es am Leben hält.

3 kostenlose Scans zum Loslegen. Wenn du mehr willst: Pro startet bei 1 € im ersten Monat — am günstigsten im Jahresabo, unbegrenzt scannen, jederzeit kündbar. Viel Spaß.

Stephen

---

Hi,

welcome to LocoSnap — you're in the club.

Quick rundown: snap a train, the app identifies it, you build a collection. Classes, build years, routes — all in there.

One thing up front: no ads, no pop-ups, no sold data. I build this on my own, around a day job. Pro is what keeps it alive.

3 free scans to get going. Want more? Pro starts at €1 for the first month — best value on the annual plan, unlimited scans, cancel anytime. Have fun.

Stephen

---

Cześć,

witaj w LocoSnap — jesteś w klubie.

Krótko: robisz zdjęcie pociągu, aplikacja go rozpoznaje, ty budujesz kolekcję. Serie, rok produkcji, trasy — wszystko w środku.

Jedna rzecz na start: zero reklam, zero pop-upów, zero sprzedaży danych. Robię to sam, obok pracy. Pro to to, co trzyma to przy życiu.

3 darmowe skany na rozgrzewkę. Chcesz więcej? Pro od 4,49 zł za pierwszy miesiąc — najtaniej w abonamencie rocznym, skanowanie bez limitu, anuluj kiedy chcesz. Baw się dobrze.

Stephen
```

**Choices baked in (do not change without user sign-off):**

- "In the club" warm hook in all three languages
- Honest "I build this alone, around a day job" — frames Pro as keeping-the-lights-on, not a sales pitch
- No CTA button — feels personal, not marketing. They're already in the app
- Signed "Stephen" — not "Team LocoSnap"
- 6-scan limit mentioned explicitly — sets honest expectations Day 0 so the paywall later isn't a surprise

---

## Backend audit (as of 2026-05-18)

What exists and is reusable:
- Render cron capability — `runLeagueWeeklyReset` runs Sundays 23:59 UTC (proven pattern)
- RevenueCat webhook handler at `backend/src/routes/webhooks.ts` (proven webhook pattern to copy)
- Resend DNS verified on `locosnap.app`; `noreply@locosnap.app` configured per architecture doc § 10

What is missing (everything code-side):
- No `resend` SDK in `backend/package.json`
- No `RESEND_API_KEY` in `backend/src/config/env.ts` or `backend/.env.example`
- No email service file in `backend/src/services/`
- No Supabase Auth (`user.created`) webhook handler
- Email is on `auth.users.email` only — NOT duplicated to the `profiles` table. Backend must read it from the webhook payload OR via service-role query on `auth.users`

---

## Smallest path to ship

Four pieces of work. Estimate ~90 lines of code plus two config touches.

1. **`backend/src/services/email.ts`** — thin Resend wrapper exporting `sendWelcomeEmail(email: string)`. Hardcodes the approved tri-lingual body. No locale logic (intentional — single email for all languages). ~30 lines.

2. **`backend/src/routes/webhooks.ts`** — extend with `POST /api/webhooks/supabase` handler for `user.created` events. Verify Supabase webhook secret. Extract email from payload. Call `sendWelcomeEmail`. Follow the existing RevenueCat handler pattern. ~40 lines.

3. **Supabase dashboard config** — Auth → Hooks → add webhook pointing at `https://<render-url>/api/webhooks/supabase` for `user.created` event. Dashboard click, no code.

4. **Env vars** — `RESEND_API_KEY` and `SUPABASE_WEBHOOK_SECRET` added on Render. Mirror to `backend/.env.example` (without values) and `backend/src/config/env.ts`.

No schema change. No frontend change. No new cron. No new migration.

---

## Open questions — resolved during impl

1. **From address.** Resolved → `Stephen from LocoSnap <noreply@locosnap.app>`. Display name is personal; address remains `noreply@` so the brand owns deliverability. Replies routed via Reply-To instead.

2. **Reply-to.** Resolved → `hello@locosnap.app` (forwards to founder inbox via ImprovMX). Welcome is the highest-intent moment for inbound feedback — confirmed by user 2026-05-18.

3. **Send latency.** Implementation awaits the Resend send inside the webhook handler. Resend's `emails.send()` returns once the request is enqueued (not when delivered), so latency is single-digit ms in practice. Re-evaluate if signup latency becomes an issue at scale.

4. **Failure handling.** Resolved → Sentry capture on failure; webhook always returns 200 to prevent Supabase retry storms. Same pattern as the RevenueCat webhook.

5. **Testing.** Test signup with a real personal email is the verification step after deploy. Track in handover.

## Format decision — hybrid, not plain text

Original spec called for plain text. User chose hybrid (spec copy verbatim + branded HTML wrapper with logo at top, language separators, footer reply prompt) in the 2026-05-18 impl session. Plain-text fallback is provided in the same email for clients that strip HTML.

---

## Verification checklist before declaring done

- [ ] Resend send confirmed in Resend dashboard with delivery status `delivered`
- [ ] Test inbox received the email; tri-lingual body intact, umlauts correct (`schön`, `Spaß`, `für`), Polish diacritics correct (`Cześć`, `że`, `pociągu`)
- [ ] Subject line renders correctly in Gmail / Apple Mail / Outlook
- [ ] Sentry capture verified for a forced failure (e.g. invalid email format)
- [ ] Supabase webhook retry behaviour tested (kill the Render service, sign up, restart — verify the retry fires)
- [ ] `backend/.env.example` updated
- [ ] `backend/src/config/env.ts` updated with new env keys
- [ ] `docs/ARCHITECTURE.md` § 10 updated to reflect Resend is now wired into the app (not just infrastructure)
- [ ] `docs/CHANGELOG.md` entry added
- [ ] Push-or-hold decision stated explicitly per CLAUDE.md backend rule

---

## Out of scope (for this spec)

- The other 3 emails in the eventual sequence (first-scan / scan 5-of-6 / 7-day-dormant) — design after this one is live and we have open-rate data from Resend
- ~~HTML formatting / branded email template — start with plain text; visual polish is a future iteration~~ → reversed during impl. HTML wrapper with logo shipped; plain-text is the fallback body, not the primary.
- Locale-aware sends — explicit decision to use one tri-lingual email for all users regardless of country
- Unsubscribe link — Resend handles this automatically via list-unsubscribe header for transactional sends; if we extend to marketing sends later, revisit
- Backfilling existing users — this welcome email only fires for NEW signups going forward
