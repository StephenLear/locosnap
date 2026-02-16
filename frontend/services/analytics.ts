// ============================================================
// LocoSnap — Analytics & Error Tracking Service
// Thin wrapper around PostHog (analytics) + Sentry (errors).
// All operations are non-blocking and fail silently.
// If API keys are missing, everything degrades gracefully.
// ============================================================

import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";

// ── Config (from EXPO_PUBLIC_ env vars) ─────────────────────

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "";
const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";

// ── State ───────────────────────────────────────────────────

let posthog: PostHog | null = null;
let initialized = false;

// ── Initialization ──────────────────────────────────────────

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  // PostHog
  if (POSTHOG_API_KEY) {
    try {
      posthog = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST,
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

  // Sentry
  if (SENTRY_DSN) {
    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.2,
        enableAutoSessionTracking: true,
        environment: __DEV__ ? "development" : "production",
        beforeSend(event) {
          // Strip UUIDs from URLs to avoid PII in breadcrumbs
          if (event.request?.url) {
            event.request.url = event.request.url.replace(
              /\/[a-f0-9-]{36}/g,
              "/<uuid>"
            );
          }
          return event;
        },
      });
      console.log("[ANALYTICS] Sentry initialized");
    } catch {
      console.warn("[ANALYTICS] Sentry init failed");
    }
  } else {
    console.log("[ANALYTICS] Sentry: disabled (no DSN)");
  }
}

// ── Event Tracking (PostHog) ────────────────────────────────

export function track(event: string, properties?: Record<string, any>) {
  try {
    posthog?.capture(event, properties);
    Sentry.addBreadcrumb({
      category: "event",
      message: event,
      data: properties,
      level: "info",
    });
  } catch {
    // Never let analytics break the app
  }
}

// ── Screen Tracking ─────────────────────────────────────────

export function trackScreen(screenName: string) {
  try {
    posthog?.screen(screenName);
    Sentry.addBreadcrumb({
      category: "navigation",
      message: `Screen: ${screenName}`,
      level: "info",
    });
  } catch {}
}

// ── User Identity ───────────────────────────────────────────

export function identifyUser(
  userId: string,
  traits: {
    is_pro?: boolean;
    level?: number;
    region?: string | null;
  }
) {
  try {
    posthog?.identify(userId, traits);
    Sentry.setUser({ id: userId });
  } catch {}
}

export function resetIdentity() {
  try {
    posthog?.reset();
    Sentry.setUser(null);
  } catch {}
}

// ── Sentry Breadcrumbs ──────────────────────────────────────

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>
) {
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: "info",
    });
  } catch {}
}

// ── Error Capture ───────────────────────────────────────────

export function captureError(
  error: Error,
  context?: Record<string, any>
) {
  try {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setExtras(context);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch {}
}

// ── Sentry Error Boundary wrapper ───────────────────────────

export const ErrorBoundary = Sentry.ErrorBoundary;
export const wrap = Sentry.wrap;

// ── Flush on app background ─────────────────────────────────

export async function flush() {
  try {
    await posthog?.flush();
    await Sentry.flush();
  } catch {}
}
