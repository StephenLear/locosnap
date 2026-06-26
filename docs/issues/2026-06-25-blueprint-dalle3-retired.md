# ISSUE — Blueprint generation fully broken: OpenAI retired `dall-e-3` (HTTP 400 for all users)

**Opened:** 2026-06-25
**Severity:** HIGH — blueprint generation is DOWN for every user (paying + free), has been since OpenAI retired the DALL-E models. The 2026-06-25 report (Oula, "Blueprint Failed — Retry / Request failed with status code 400") was the one that finally got root-caused — but it was NOT the first signal. See "Prior reports (missed)" below: blueprint failures were reported at least 3-4 times across 3 testers (Christian, Oula ×2, Leon) since ~late April / late May and each was triaged as a transient cause (timeout, deploy restart, Redis 404 lag) without anyone checking the actual OpenAI error.
**Status:** RESOLVED 2026-06-26 — migrated to `gpt-image-1` (quality `medium`), base64→Supabase Storage, real-error capture + Sentry. Deployed to Render (commit `2a8e6da`) and **VERIFIED LIVE**: a real scan produced a BR 232 / DB Cargo blueprint in the technical-navy style at the correct portrait aspect ratio. Blueprint generation is working again for all users. (Note: garbled fine annotation text is the long-standing image-model lettering limitation, not introduced by this change.)

## Root cause (confirmed)
- Render runs blueprints through **OpenAI** (no `REPLICATE_API_TOKEN` set → `config.hasReplicate` is false → the DALL-E branch in `imageGen.ts` is used).
- The code hardcodes `model: "dall-e-3"` at `backend/src/services/imageGen.ts:229`.
- **OpenAI has retired the DALL-E models.** The org's Limits page (platform.openai.com/settings/organization/limits) lists, under **Image**, ONLY `gpt-image` (gpt-image-1) and `gpt-image-1-mini`. `dall-e-3` and `dall-e-2` are absent from the entire model list.
- Result: every blueprint call returns **HTTP 400 invalid-model**. The error surfaces to the app as the generic axios string "Request failed with status code 400".

## Corroborating evidence
- `/api/health` (2026-06-25): `blueprintGenAvailable: true`, `visionProvider: "Claude Vision (Anthropic)"`, `cache.entriesWithBlueprints: 0`.
- OpenAI billing: credit **$10.87**, auto-recharge ON, month-to-date spend **$0.00 / $120.00** → not a billing/quota problem, and zero blueprints have succeeded all period.
- Vision is unaffected because it runs on Claude/Anthropic — which is why train ID works but blueprints don't.

## Prior reports (MISSED — this was not new on 2026-06-25)
Blueprint-generation failures were reported repeatedly before the 06-25 root-cause and each was diagnosed as a different transient cause, never as a provider/model problem:
- **Christian (≈v1.0.25):** ÖBB 4020 blueprint timed out at 135s → diagnosed as slow generation → `BLUEPRINT_TIMEOUT` bumped 120→240s (`6ae31c3`). (A genuine timeout is distinct from a 400, which returns instantly — but it's the same feature failing.)
- **Oula (R5, 2026-05-31 straw poll):** "blueprint generation times out, 3 tries — **same a month ago and today**" (i.e. also ≈late April) → re-opened the "hang" tracker, no fix shipped.
- **Leon (2026-06-01):** "Blueprint Failed — Retry / Couldn't reach LocoSnap servers" → diagnosed as deploy-restart collateral + Global-Redis 404 read-your-writes lag → write-through fix (`4967e4a`). The 06-01 tester-feedback note itself called this "3rd report (Christian + Oula + Leon) of blueprint-gen unreliability."
- **Oula again (2026-06-25):** explicit "Request failed with status code 400" → finally traced to the retired `dall-e-3`.

The decisive missed signal: **month-to-date June OpenAI spend was $0.00** on 06-25 — i.e. ZERO blueprints succeeded in all of June, yet failures were being patched as transient infra throughout June. The feature was a total outage, not an intermittent one.

## Why it went unnoticed (the real gap)
Two compounding failures:
1. **No observability:** `imageGen.ts` throws the raw axios error, the async `.catch` only stored `error.message` (the generic 400 string) + `console.error`, **OpenAI's actual reason** (`error.response.data.error.message`, e.g. model_not_found) was discarded, and there was **no `Sentry.captureException`** on the blueprint path. A universal outage was invisible to monitoring.
2. **Triage process:** when users DID report it (4×), each report was attributed to a plausible transient cause (timeout → restart → 404) and "fixed" at that layer, without ever checking the provider's real error or noticing that $0 image spend meant *nothing* was generating. Provider-error-first / model-first triage would have caught this on the first or second report. (Both fixes shipped 2026-06-26: the Sentry capture closes #1; the lesson closes #2.)

## Fix plan (decided 2026-06-25 — user picked the model tier next)
Migrate the OpenAI path from `dall-e-3` to **`gpt-image-1`**. NOT a drop-in rename — required changes:
1. `model`: `"dall-e-3"` → `"gpt-image-1"` (or `gpt-image-1-mini`).
2. `size`: `"1024x1792"` → **`"1024x1536"`** (gpt-image-1 only supports 1024x1024 / 1024x1536 / 1536x1024 / auto; the old portrait size is invalid → would 400).
3. `quality`: `"hd"` → **`"medium"`** (gpt-image-1 uses low/medium/high/auto; "hd" is invalid → would 400). [Confirm final tier with user — leaning medium ~$0.04–0.06/image.]
4. **Remove** the `style: "natural"|"vivid"` param (gpt-image-1 has no style param → unknown-param 400).
5. **Response handling:** gpt-image-1 returns **`data[0].b64_json` (base64), NOT a URL.** The current code reads `data[0].url` → would be undefined → "No image URL in OpenAI response". Must decode the base64 and **upload to Supabase Storage** (new `blueprints` bucket, service-key write), then store the public URL in `task.imageUrl` / `spots.blueprint_url`.
   - Bonus: this also fixes a latent bug — the old DALL-E/Replicate hosted URLs expired (~1h), so previously-saved blueprints would have rotted. Supabase-hosted URLs are stable.
6. **Observability fix (do regardless):** capture `error.response.data.error` into `task.error` + logs, and add `Sentry.captureException` on the blueprint-failure path so this is never a black box again.

## Verify gpt-image-1 API before coding
Confirm against current OpenAI docs (the irony of fixing a wrong-model bug with wrong params): endpoint `/v1/images/generations`, allowed `size` / `quality` enums, base64-only return, no `style`/`response_format`. Then `tsc` + run the 268 backend tests, deploy to Render, and have Oula (and a normal scan) retry.

## Alternative considered
Switch blueprints to **Replicate SDXL** — the code branch already exists and returns URLs (matches the current flow), and the STYLE_PROMPTS (negativePrompt/guidanceScale) were built for SDXL. Rejected for now because it needs a new funded Replicate account + token on Render AND the pinned SDXL version hash (`7762fd07…`, ~2023) may be deprecated. gpt-image-1 reuses the already-funded OpenAI account.

## Files
- `backend/src/services/imageGen.ts` — the fix (model, size, quality, style removal, base64→Storage upload, error capture)
- `backend/src/config/supabase.ts` — service client for the Storage upload
- `backend/src/services/imageGen.ts` STYLE_PROMPTS — `dalleStyle` field becomes unused after removing `style`

## What shipped in code (2026-06-26)
- `imageGen.ts`: OpenAI branch now calls `model: "gpt-image-1"`, `size: "1024x1536"`, `quality: "medium"`, no `style` param.
- Response handling: reads `data[0].b64_json`, decodes, and uploads to the Supabase Storage `blueprints` bucket via a new `uploadBlueprintToStorage(taskId, base64)` helper; stores the returned public URL in `task.imageUrl`.
- Observability: new `describeImageGenError()` surfaces OpenAI's real `error.response.data.error.message` (instead of the generic axios 400); the background `.catch` now calls `captureServerError(...)` so blueprint failures hit Sentry.
- Removed the now-dead `dalleStyle` field from `StyleConfig` + all four style objects.
- Tests: `imageGen.test.ts` rewritten to mock the base64 response + Supabase Storage; asserts the gpt-image-1 params (model/size/quality, no style), the Storage upload + public URL, and the error path returns OpenAI's real reason. Suite: 270 pass (was 268).

## Remaining before live — ALL DONE
1. ~~Create the Supabase Storage bucket `blueprints` (public).~~ **DONE — already existed + PUBLIC** (project `vfzudbnmtwgirlrfoxpq`).
2. ~~Deploy to Render.~~ **DONE — commit `2a8e6da` pushed → Render auto-deploy.**
3. ~~Verify a real scan.~~ **DONE — BR 232 / DB Cargo blueprint generated + rendered in-app 2026-06-26.**

## Follow-ups (not blocking)
- Reply to Oula: blueprint outage fixed app-wide; Dr16 working; still need their Dr19 photo/angle to tune the Dv12 misread.
- Optional: revisit quality tier (`medium` ~$0.04-0.06/image) once cost data accrues; `high` available if blueprint sharpness matters more than cost.
