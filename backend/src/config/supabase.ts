// ============================================================
// LocoSnap — Supabase Client (Backend / Service Role)
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./env";

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!config.hasSupabase) return null;

  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return supabase;
}
