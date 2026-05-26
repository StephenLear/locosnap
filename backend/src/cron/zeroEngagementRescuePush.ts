// ============================================================
// LocoSnap — Zero-Engagement Rescue Push (v1.0.35 Phase G)
//
// Targets a known dead-money cohort: Pro subscribers who created
// their account >3 days ago and have NEVER logged a spot (the
// "subscribed within minutes, never used the product" pattern
// surfaced in the 2026-05-17 Supabase / RevenueCat audit). Sends
// one localised push every 7 days max ("You have Pro — now scan
// your first train") to nudge them back into the product before
// the subscription lapses or they churn.
//
// Companion to the in-app ProRescuePrompt that surfaces on the
// scan screen for the same cohort — that one only fires when the
// user actually opens the app. This cron reaches them when they
// don't.
//
// Idempotency: each profile is updated with engagement_push_sent_at
// = now() right after the push send succeeds. The next cron run
// (24h later) skips anyone updated in the last 7 days.
//
// Architecture mirror: runs the same pure-helper-+-orchestrator
// split as leagueWeeklyReset.ts. The orchestrator
// (runZeroEngagementRescuePush) accepts the supabase client as a
// dependency for testability.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────

/** Account must be >= this many days old before we send. */
export const ACCOUNT_AGE_THRESHOLD_DAYS = 3;
/** Don't re-send within this many days of the last push. */
export const RESEND_COOLDOWN_DAYS = 7;
/** Per-run safety cap so a misconfigured query can't blast everyone. */
export const MAX_PUSHES_PER_RUN = 500;
/** Expo push endpoint. Stable since 2020; no version param needed. */
export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ── Types ─────────────────────────────────────────────────────

export interface CandidateRow {
  id: string;
  // profiles.language doesn't exist (caught 2026-05-26 on first manual cron
  // run — frontend stores language in AsyncStorage, never writes it back to
  // Supabase). Falling back to country_code → language mapping; future
  // v1.0.36+ may add an explicit profiles.language column with backfill.
  country_code: string | null;
  push_token: string | null;
}

// Map ISO 3166-1 alpha-2 country code to one of our supported push body
// locales. DE-speaking countries → de, PL → pl, everything else falls
// through to English. CH defaults to de (German-Swiss majority); French/
// Italian-Swiss users get the EN fallback, which is acceptable given the
// low volume relative to DE-CH.
export function countryCodeToLanguage(
  countryCode: string | null | undefined
): "en" | "de" | "pl" {
  if (!countryCode) return "en";
  const upper = countryCode.toUpperCase();
  if (upper === "DE" || upper === "AT" || upper === "CH") return "de";
  if (upper === "PL") return "pl";
  return "en";
}

export interface RescuePushBody {
  title: string;
  body: string;
}

export type RescuePushResult =
  | { status: "skipped"; reason: string }
  | {
      status: "completed";
      candidates: number;
      sent: number;
      failed: number;
      skippedNoToken: number;
    };

// ── Pure helpers (testable) ───────────────────────────────────

/**
 * Map a profile.language code to the localised push body.
 * Falls back to English for unknown languages so we never send a
 * blank message. The matched language is normalised to its base
 * tag (e.g. de-AT → de, en-GB → en).
 */
export function localisePushBody(language: string | null | undefined): RescuePushBody {
  const base = (language || "en").toLowerCase().split("-")[0];
  switch (base) {
    case "de":
      return {
        title: "Du hast Pro",
        body: "Jetzt scannst du den ersten Zug.",
      };
    case "pl":
      return {
        title: "Masz Pro",
        body: "Czas zeskanować pierwszy pociąg.",
      };
    case "en":
    default:
      return {
        title: "You have Pro",
        body: "Now scan your first train.",
      };
  }
}

/**
 * Build the Expo push message envelope. Returned shape matches the
 * Expo push API spec — sound default, low priority (this is a
 * marketing-style nudge, not a real-time alert), no data payload
 * (the user just opens the app — no deep link needed).
 */
export function buildExpoPushMessage(
  pushToken: string,
  body: RescuePushBody
): Record<string, unknown> {
  return {
    to: pushToken,
    title: body.title,
    body: body.body,
    sound: "default",
    priority: "default",
    channelId: "default",
  };
}

/**
 * Decide whether a candidate row is sendable. Pulled out of the
 * orchestrator so we can test the gating logic in isolation.
 */
export function isSendable(row: CandidateRow): boolean {
  if (!row.push_token) return false;
  if (typeof row.push_token !== "string") return false;
  // Expo tokens always start with ExponentPushToken[...] or
  // ExpoPushToken[...] — reject anything that doesn't to avoid
  // sending to garbage values stored from buggy older clients.
  return (
    row.push_token.startsWith("ExponentPushToken[") ||
    row.push_token.startsWith("ExpoPushToken[")
  );
}

// ── Orchestrator ──────────────────────────────────────────────

export async function runZeroEngagementRescuePush(
  supabase: SupabaseClient,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch
): Promise<RescuePushResult> {
  const accountCutoff = new Date(
    now.getTime() - ACCOUNT_AGE_THRESHOLD_DAYS * 86400 * 1000
  ).toISOString();
  const resendCutoff = new Date(
    now.getTime() - RESEND_COOLDOWN_DAYS * 86400 * 1000
  ).toISOString();

  // Query candidates. The .or() composes:
  //   engagement_push_sent_at IS NULL
  //   OR engagement_push_sent_at < (now - 7d)
  const { data: candidates, error: queryError } = await supabase
    .from("profiles")
    .select("id, country_code, push_token")
    .eq("is_pro", true)
    .is("last_spot_date", null)
    .lt("created_at", accountCutoff)
    .or(`engagement_push_sent_at.is.null,engagement_push_sent_at.lt.${resendCutoff}`)
    .limit(MAX_PUSHES_PER_RUN);

  if (queryError) {
    console.error("[rescue-push] candidate query failed:", queryError.message);
    return { status: "skipped", reason: `query_failed: ${queryError.message}` };
  }

  if (!candidates || candidates.length === 0) {
    return {
      status: "completed",
      candidates: 0,
      sent: 0,
      failed: 0,
      skippedNoToken: 0,
    };
  }

  let sent = 0;
  let failed = 0;
  let skippedNoToken = 0;

  for (const row of candidates as CandidateRow[]) {
    if (!isSendable(row)) {
      skippedNoToken += 1;
      continue;
    }

    const body = localisePushBody(countryCodeToLanguage(row.country_code));
    const message = buildExpoPushMessage(row.push_token!, body);

    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          "content-type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!res.ok) {
        console.warn(
          `[rescue-push] expo push failed for ${row.id}: HTTP ${res.status}`
        );
        failed += 1;
        continue;
      }

      // Even on HTTP 200 Expo can return ticket-level errors in the
      // response body. Conservative: only count as "sent" when both
      // HTTP and ticket are clean. Other states (DeviceNotRegistered,
      // MessageTooBig, etc.) get logged but not retried — Expo's own
      // receipts flow would handle those if we cared, but for a
      // marketing nudge the cost of skipping is low.
      const json = (await res.json()) as {
        data?: { status?: string; message?: string };
      };
      const status = json?.data?.status;
      if (status && status !== "ok") {
        console.warn(
          `[rescue-push] expo ticket non-ok for ${row.id}: ${status} ${json?.data?.message ?? ""}`
        );
        failed += 1;
        continue;
      }

      // Mark the send so the next run respects the cooldown
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ engagement_push_sent_at: now.toISOString() })
        .eq("id", row.id);
      if (updErr) {
        console.warn(
          `[rescue-push] failed to mark sent for ${row.id}: ${updErr.message}`
        );
        // Push went out, but stamp didn't land — next run will skip
        // this user only if engagement_push_sent_at happens to update
        // via a separate path. Worst case: one extra push 24h later.
      }
      sent += 1;
    } catch (e) {
      console.warn(
        `[rescue-push] threw for ${row.id}: ${(e as Error).message}`
      );
      failed += 1;
    }
  }

  return {
    status: "completed",
    candidates: candidates.length,
    sent,
    failed,
    skippedNoToken,
  };
}
