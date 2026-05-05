// ============================================================
// Render cron entrypoint — `node dist/cron/runLeagueWeeklyReset.js`
//
// Schedule on Render: `59 23 * * 0` (Sunday 23:59 UTC).
// Reads supabase service-role config from env and invokes
// runLeagueWeeklyReset for the current week. Exits 0 on success or
// idempotent skip; exits 1 on failure (Render auto-retries).
// ============================================================

import { getSupabase } from "../config/supabase";
import { runLeagueWeeklyReset } from "./leagueWeeklyReset";
import { weekStartUtc } from "../services/leagues";

async function main() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("[league-cron] Supabase not configured — aborting");
    process.exit(1);
  }

  const weekStart = weekStartUtc(new Date());
  console.log(`[league-cron] starting reset for week ${weekStart.toISOString()}`);

  const summary = await runLeagueWeeklyReset(supabase, weekStart);
  console.log(`[league-cron] result: ${JSON.stringify(summary)}`);

  if (summary.status === "failed") {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[league-cron] uncaught error", err);
  process.exit(1);
});
