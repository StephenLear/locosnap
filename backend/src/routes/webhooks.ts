// ============================================================
// LocoSnap — RevenueCat Webhook Handler
// POST /api/webhooks/revenuecat
//
// Receives subscription lifecycle events from RevenueCat and
// updates profiles.is_pro accordingly.
// ============================================================

import { Router, Request, Response } from "express";
import { config } from "../config/env";
import { getSupabase } from "../config/supabase";
import { trackServerEvent, captureServerError } from "../services/analytics";

const router = Router();

// ── Event types that grant/revoke Pro ────────────────────────

const PRO_GRANT_EVENTS = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
];

const PRO_REVOKE_EVENTS = [
  "EXPIRATION",
  "BILLING_ISSUE",
];

// CANCELLATION is intentionally excluded — user keeps access
// until the current period ends (EXPIRATION handles revocation).

// ── Webhook endpoint ─────────────────────────────────────────

router.post(
  "/revenuecat",
  async (req: Request, res: Response): Promise<void> => {
    // 1. Verify webhook secret
    const authHeader = req.headers.authorization;

    if (config.hasRevenueCat) {
      if (authHeader !== `Bearer ${config.revenuecatWebhookSecret}`) {
        console.warn("[WEBHOOK] Invalid authorization header");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    try {
      const { event } = req.body;

      if (!event) {
        res.status(400).json({ error: "Missing event payload" });
        return;
      }

      const eventType: string = event.type;
      const appUserId: string = event.app_user_id;
      const productId: string = event.product_id || "";
      const eventId: string = event.id || "";

      console.log(
        `[WEBHOOK] RevenueCat event: ${eventType} for user ${appUserId}`
      );

      const supabase = getSupabase();
      if (!supabase) {
        console.warn("[WEBHOOK] Supabase not configured — skipping");
        res.status(200).json({ status: "ok" });
        return;
      }

      // 2. Log the event for audit trail
      await supabase.from("subscription_events").insert({
        user_id: appUserId,
        event_type: eventType,
        product_id: productId,
        rc_event_id: eventId,
        raw_payload: req.body,
      });

      // 3. Update is_pro based on event type
      let newProStatus: boolean | null = null;

      if (PRO_GRANT_EVENTS.includes(eventType)) {
        newProStatus = true;
      } else if (PRO_REVOKE_EVENTS.includes(eventType)) {
        newProStatus = false;
      }

      if (newProStatus !== null) {
        const { error } = await supabase
          .from("profiles")
          .update({ is_pro: newProStatus })
          .eq("id", appUserId);

        if (error) {
          console.error(
            `[WEBHOOK] Failed to update is_pro for ${appUserId}:`,
            error.message
          );
          captureServerError(new Error(error.message), {
            context: "webhook_update_pro",
            userId: appUserId,
            eventType,
          });
        } else {
          console.log(
            `[WEBHOOK] Updated is_pro=${newProStatus} for ${appUserId}`
          );
        }
      }

      // 4. Track for analytics
      trackServerEvent("subscription_event", appUserId, {
        event_type: eventType,
        product_id: productId,
        new_pro_status: newProStatus,
      });

      res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("[WEBHOOK] Error processing event:", error);
      captureServerError(error as Error, { context: "revenuecat_webhook" });
      // Always return 200 to prevent RevenueCat from retrying indefinitely
      res.status(200).json({ status: "error_logged" });
    }
  }
);

export default router;
