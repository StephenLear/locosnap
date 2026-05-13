// ============================================================
// LocoSnap — Supabase Client (Frontend)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { secureStorageAdapter } from "./secureStorage";

// These come from EXPO_PUBLIC_ env vars (set in eas.json for production builds)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[SUPABASE] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — auth will not work");
}

// Auth tokens live in SecureStore (iOS Keychain / Android Keystore),
// not AsyncStorage — refresh tokens persist 60 days and AsyncStorage
// is readable on rooted/jailbroken devices. The adapter handles the
// 2 KB-per-value iOS limit via chunking and migrates any existing
// AsyncStorage session on first read.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
