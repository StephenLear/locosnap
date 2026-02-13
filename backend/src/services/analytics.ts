// ============================================================
// LocoSnap Backend — Analytics & Error Tracking
// Thin wrapper around PostHog (server events) + Sentry (errors).
// All operations are non-blocking and fail silently.
// ============================================================

import * as Sentry from "@sentry/node";
import { PostHog } from "posthog-node";
import { config } from "../config/env";

// ── State ───────────────────────────────────────────────────

let posthog: PostHog | null = null;

// ── Initialization ──────────────────────────────────────────

export function initAnalytics() {
  // Sentry
  if (config.hasSentry) {
    try {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.nodeEnv,
        tracesSampleRate: 0.2,
      });
      console.log("[ANALYTICS] Sentry initialized");
    } catch {
      console.warn("[ANALYTICS] Sentry init failed");
    }
  } else {
    console.log("[ANALYTICS] Sentry: disabled (no DSN)");
  }

  // PostHog
  if (config.hasPostHog) {
    try {
      posthog = new PostHog(config.posthogApiKey, {
        host: config.posthogHost,
        flushInterval: 30000,
        flushAt: 20,
      });
      console.log("[ANALYTICS] PostHog initialized");
    } catch {
      console.warn("[ANALYTICS] PostHog init failed");
    }
  } else {
    console.log("[ANALYTICS] PostHog: disabled (no API key)");
  }
}

// ── Server Event Tracking ───────────────────────────────────

export function trackServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, any>
) {
  try {
    posthog?.capture({
      distinctId,
      event,
      properties,
    });
  } catch {}
}

// ── Error Capture ───────────────────────────────────────────

export function captureServerError(
  error: Error,
  extras?: Record<string, any>
) {
  try {
    if (extras) {
      Sentry.withScope((scope) => {
        scope.setExtras(extras);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch {}
}

// ── Flush ───────────────────────────────────────────────────

export async function flushAnalytics() {
  try {
    await posthog?.flush();
    await Sentry.flush(2000);
  } catch {}
}

// Re-export Sentry for Express handlers
export { Sentry };
