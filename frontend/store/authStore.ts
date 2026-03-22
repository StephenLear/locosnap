// ============================================================
// LocoSnap — Auth State Management
// ============================================================

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { Session, User } from "@supabase/supabase-js";
import { track, identifyUser, resetIdentity, addBreadcrumb } from "../services/analytics";
import { loginRevenueCat, logoutRevenueCat, syncProStatus } from "../services/purchases";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  streak_current: number;
  streak_best: number;
  last_spot_date: string | null;
  daily_scans_used: number;
  daily_scans_reset_at: string;
  is_pro: boolean;
  blueprint_credits: number;
  region: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  preSignupScansUsed: number; // Scans used before account creation (AsyncStorage)

  // Actions
  initialize: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setSession: (session: Session | null) => void;
  incrementDailyScans: () => Promise<void>;
  incrementPreSignupScans: () => Promise<void>;
  updateRegion: (region: string | null) => Promise<void>;
  canScan: () => boolean;
  deductBlueprintCredit: () => Promise<boolean>;
  addBlueprintCredits: (amount: number) => Promise<void>;
}

// Unauthenticated users get 3 trial scans before sign-up is required
export const PRE_SIGNUP_FREE_SCANS = 3;
// Free accounts get 10 scans per month
export const MAX_MONTHLY_SCANS = 10;
const PRE_SIGNUP_SCANS_KEY = "locosnap_presignup_scans";

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  preSignupScansUsed: 0,

  initialize: async () => {
    try {
      // Load pre-signup scan count from AsyncStorage
      const storedScans = await AsyncStorage.getItem(PRE_SIGNUP_SCANS_KEY);
      const preSignupScansUsed = storedScans ? parseInt(storedScans, 10) : 0;
      set({ preSignupScansUsed: isNaN(preSignupScansUsed) ? 0 : preSignupScansUsed });

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user, isLoading: false });
        loginRevenueCat(session.user.id);
        get().fetchProfile();
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED" && session) {
          // Silent token refresh — update session without disrupting state
          set({ session, user: session.user });
          return;
        }

        if (event === "SIGNED_OUT" && !session) {
          // Could be a silent token refresh failure on Android — try to recover
          supabase.auth.refreshSession().then(({ data }) => {
            if (data.session) {
              // Recovery successful — restore session silently
              set({ session: data.session, user: data.session.user });
              get().fetchProfile().catch(() => {});
            } else {
              // Genuine sign-out — clear state
              set({ profile: null });
            }
          }).catch(() => {
            // Recovery failed — clear state
            set({ profile: null });
          });
          return;
        }

        set({
          session,
          user: session?.user ?? null,
        });
        if (session) {
          loginRevenueCat(session.user.id);
          get().fetchProfile();
        } else {
          set({ profile: null });
        }
      });
    } catch {
      set({ isLoading: false });
    }
  },

  signInWithApple: async () => {
    // Apple Sign-In uses Supabase's built-in Apple OAuth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    track("sign_in", { method: "apple" });
    addBreadcrumb("auth", "Signed in with Apple");
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    track("sign_in", { method: "google" });
    addBreadcrumb("auth", "Signed in with Google");
  },

  signInWithMagicLink: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
    track("sign_in", { method: "magic_link" });
    addBreadcrumb("auth", "Magic link sent");
  },

  signOut: async () => {
    track("sign_out");
    await logoutRevenueCat();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
    resetIdentity();
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        // Identify user for analytics
        identifyUser(user.id, {
          is_pro: data.is_pro,
          blueprint_credits: data.blueprint_credits ?? 0,
          level: data.level,
          region: data.region,
        });

        // Check if monthly scans need reset (new calendar month)
        const resetAt = new Date(data.daily_scans_reset_at);
        const now = new Date();
        const isNewMonth =
          now.getMonth() !== resetAt.getMonth() ||
          now.getFullYear() !== resetAt.getFullYear();
        if (isNewMonth) {
          // New month — reset scan count
          const { data: updated } = await supabase
            .from("profiles")
            .update({
              daily_scans_used: 0,
              daily_scans_reset_at: now.toISOString(),
            })
            .eq("id", user.id)
            .select()
            .single();

          set({ profile: updated || data });
        } else {
          set({ profile: data });
        }

        // Sync Pro status with RevenueCat entitlements
        // Only upgrade to Pro if RevenueCat confirms it — never downgrade a manually-granted Pro
        try {
          const isPro = await syncProStatus(user.id);
          if (isPro && !data.is_pro) {
            const currentProfile = get().profile;
            if (currentProfile) {
              set({ profile: { ...currentProfile, is_pro: true } });
            }
          }
        } catch {
          // RevenueCat sync failure — not fatal, keep existing Pro status
        }
      }
    } catch {
      // Profile fetch failure — not fatal
    }
  },

  incrementDailyScans: async () => {
    const { user, profile } = get();
    if (!user || !profile) return;

    const newCount = profile.daily_scans_used + 1;

    const { data } = await supabase
      .from("profiles")
      .update({ daily_scans_used: newCount })
      .eq("id", user.id)
      .select()
      .single();

    if (data) set({ profile: data });
  },

  updateRegion: async (region: string | null) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    const { data } = await supabase
      .from("profiles")
      .update({ region })
      .eq("id", user.id)
      .select()
      .single();

    if (data) set({ profile: data });
  },

  incrementPreSignupScans: async () => {
    const newCount = get().preSignupScansUsed + 1;
    set({ preSignupScansUsed: newCount });
    try {
      await AsyncStorage.setItem(PRE_SIGNUP_SCANS_KEY, String(newCount));
    } catch {
      // Non-fatal
    }
  },

  canScan: () => {
    const { session, profile, preSignupScansUsed } = get();
    // Not signed in: allow up to PRE_SIGNUP_FREE_SCANS trial scans
    if (!session) return preSignupScansUsed < PRE_SIGNUP_FREE_SCANS;
    // Pro users have unlimited scans
    if (profile?.is_pro) return true;
    // Free users: check monthly limit
    return (profile?.daily_scans_used ?? 0) < MAX_MONTHLY_SCANS;
  },

  deductBlueprintCredit: async () => {
    const { user, profile } = get();
    if (!user || !profile || profile.blueprint_credits <= 0) return false;

    const newCredits = profile.blueprint_credits - 1;
    const { data } = await supabase
      .from("profiles")
      .update({ blueprint_credits: newCredits })
      .eq("id", user.id)
      .select()
      .single();

    if (data) {
      set({ profile: data });
      track("blueprint_credit_used", { remaining: newCredits });
      return true;
    }
    return false;
  },

  addBlueprintCredits: async (amount: number) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    const newCredits = profile.blueprint_credits + amount;
    const { data } = await supabase
      .from("profiles")
      .update({ blueprint_credits: newCredits })
      .eq("id", user.id)
      .select()
      .single();

    if (data) {
      set({ profile: data });
      track("blueprint_credits_added", { amount, total: newCredits });
    }
  },
}));
