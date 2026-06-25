# ISSUE — Blueprint generation fully broken: OpenAI retired `dall-e-3` (HTTP 400 for all users)

**Opened:** 2026-06-25
**Severity:** HIGH — blueprint generation is DOWN for every user (paying + free), has been since OpenAI retired the DALL-E models. Surfaced by tester Oula ("Blueprint Failed — Retry / Request failed with status code 400").
**Status:** OPEN — diagnosed, not fixed. No code changed 2026-06-25.

## Root cause (confirmed)
- Render runs blueprints through **OpenAI** (no `REPLICATE_API_TOKEN` set → `config.hasReplicate` is false → the DALL-E branch in `imageGen.ts` is used).
- The code hardcodes `model: "dall-e-3"` at `backend/src/services/imageGen.ts:229`.
- **OpenAI has retired the DALL-E models.** The org's Limits page (platform.openai.com/settings/organization/limits) lists, under **Image**, ONLY `gpt-image` (gpt-image-1) and `gpt-image-1-mini`. `dall-e-3` and `dall-e-2` are absent from the entire model list.
- Result: every blueprint call returns **HTTP 400 invalid-model**. The error surfaces to the app as the generic axios string "Request failed with status code 400".

## Corroborating evidence
- `/api/health` (2026-06-25): `blueprintGenAvailable: true`, `visionProvider: "Claude Vision (Anthropic)"`, `cache.entriesWithBlueprints: 0`.
- OpenAI billing: credit **$10.87**, auto-recharge ON, month-to-date spend **$0.00 / $120.00** → not a billing/quota problem, and zero blueprints have succeeded all period.
- Vision is unaffected because it runs on Claude/Anthropic — which is why train ID works but blueprints don't.

## Why it went unnoticed (the real gap)
`imageGen.ts` throws the raw axios error and the async `.catch` only stores `error.message` (the generic 400 string) + `console.error`s it — **OpenAI's actual reason** (`error.response.data.error.message`, e.g. model_not_found) is discarded, and there is **no `Sentry.captureException`** on the blueprint failure path. A universal outage was therefore invisible to monitoring until a tester reported it.

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
