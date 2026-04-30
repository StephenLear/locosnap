// ============================================================
// LocoSnap — Auth State Management
// ============================================================

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { Session, User } from "@supabase/supabase-js";
import { track, identifyUser, resetIdentity, addBreadcrumb } from "../services/analytics";
import { loginRevenueCat, logoutRevenueCat, syncProStatus } from "../services/purchases";
import { updateProfileIdentity } from "../services/supabase";

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
  is_pro: boolean;
  blueprint_credits: number;
  region: string | null;
  country_code: string | null;
  spotter_emoji: string | null;
  has_completed_identity_onboarding: boolean;
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
  updateUsername: (username: string) => Promise<{ success: boolean; errorKey?: string }>;
  canScan: () => boolean;
  deductBlueprintCredit: () => Promise<boolean>;
  addBlueprintCredits: (amount: number) => Promise<void>;
  updateCountryCode: (code: string) => Promise<void>;
  updateSpotterEmoji: (emojiId: string) => Promise<void>;
  markIdentityOnboardingComplete: () => Promise<void>;
}

const ANONYMOUS_COUNTRY_KEY = "locosnap_anonymous_identity_country";
const ANONYMOUS_EMOJI_KEY = "locosnap_anonymous_identity_emoji";
const IDENTITY_ONBOARDING_KEY = "locosnap_identity_onboarding_completed";

// Unauthenticated users get 6 trial scans before sign-up is required.
// Bumped from 3 to 6 on 2026-04-28 — eight independent user signals
// (Steph "3 is far too low", multiple TikTok commenters across DE+EN,
// research brief patterns A/C/D) all confirmed 3 was too tight, and the
// prompt-caching commit a3bdaa9 cut per-scan input cost ~80% giving
// the cost headroom for a more generous free tier.
export const PRE_SIGNUP_FREE_SCANS = 6;
// Free accounts get 6 lifetime scans (not monthly — no reset).
export const MAX_FREE_SCANS = 6;
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
              // Genuine sign-out — clear all user state including train history
              set({ session: null, user: null, profile: null });
              const { useTrainStore } = require("./trainStore");
              useTrainStore.getState().clearHistory();
            }
          }).catch(() => {
            // Recovery failed — clear all user state including train history
            set({ session: null, user: null, profile: null });
            const { useTrainStore } = require("./trainStore");
            useTrainStore.getState().clearHistory();
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
        emailRedirectTo: "locosnap://auth/callback",
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
    const { useTrainStore } = require("./trainStore");
    await useTrainStore.getState().clearHistory();
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

        // Lifetime scan limit — no monthly reset. daily_scans_used is now
        // a lifetime counter despite the legacy column name.
        set({ profile: data });

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

  updateUsername: async (username: string): Promise<{ success: boolean; errorKey?: string }> => {
    const { user, profile } = get();
    if (!user || !profile) {
      return { success: false, errorKey: "profile.usernameModal.errors.notSignedIn" };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ username: username.trim() })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, errorKey: "profile.usernameModal.errors.alreadyTaken" };
      }
      return { success: false, errorKey: "profile.usernameModal.errors.generic" };
    }

    if (data) set({ profile: data });
    return { success: true };
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
    // Free users: 6 lifetime scans (no monthly reset)
    return (profile?.daily_scans_used ?? 0) < MAX_FREE_SCANS;
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

  updateCountryCode: async (code: string) => {
    const { profile, session } = get();
    if (profile) {
      set({ profile: { ...profile, country_code: code } });
    }
    try {
      await AsyncStorage.setItem(ANONYMOUS_COUNTRY_KEY, code);
    } catch {
      // Non-fatal
    }
    if (session?.user?.id) {
      const { error } = await updateProfileIdentity(session.user.id, { country_code: code });
      if (error) {
        addBreadcrumb("auth", "updateCountryCode Supabase failed");
      }
    }
  },

  updateSpotterEmoji: async (emojiId: string) => {
    const { profile, session } = get();
    if (profile) {
      set({ profile: { ...profile, spotter_emoji: emojiId } });
    }
    try {
      await AsyncStorage.setItem(ANONYMOUS_EMOJI_KEY, emojiId);
    } catch {
      // Non-fatal
    }
    if (session?.user?.id) {
      const { error } = await updateProfileIdentity(session.user.id, { spotter_emoji: emojiId });
      if (error) {
        addBreadcrumb("auth", "updateSpotterEmoji Supabase failed");
      }
    }
  },

  markIdentityOnboardingComplete: async () => {
    const { profile, session } = get();
    if (profile) {
      set({ profile: { ...profile, has_completed_identity_onboarding: true } });
    }
    try {
      await AsyncStorage.setItem(IDENTITY_ONBOARDING_KEY, "true");
    } catch {
      // Non-fatal
    }
    if (session?.user?.id) {
      const { error } = await updateProfileIdentity(session.user.id, {
        has_completed_identity_onboarding: true,
      });
      if (error) {
        addBreadcrumb("auth", "markIdentityOnboardingComplete Supabase failed");
      }
    }
  },
}));
