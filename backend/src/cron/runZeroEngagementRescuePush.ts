// ============================================================
// Render cron entrypoint —
// `node dist/cron/runZeroEngagementRescuePush.js`
//
// Schedule on Render: `0 9 * * *` (daily at 09:00 UTC — ~10/11 AM
// in DE/PL, ~9 AM in UK; a reasonable foreground time without
// being intrusive). Reads supabase service-role config from env
// and invokes runZeroEngagementRescuePush.
//
// Exits 0 on success or empty-queue skip; exits 1 on misconfig so
// Render auto-retries.
// ============================================================

import { getSupabase } from "../config/supabase";
import { runZeroEngagementRescuePush } from "./zeroEngagementRescuePush";

async function main() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("[rescue-push-cron] Supabase not configured — aborting");
    process.exit(1);
  }

  console.log("[rescue-push-cron] starting");
  const summary = await runZeroEngagementRescuePush(supabase);
  console.log(`[rescue-push-cron] result: ${JSON.stringify(summary)}`);

  if (summary.status === "skipped") {
    // Query-level failure is logged but not treated as cron failure —
    // we don't want Render to retry-loop on a transient Supabase blip.
    process.exit(0);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[rescue-push-cron] uncaught error", err);
  process.exit(1);
});
