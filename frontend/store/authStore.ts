// ============================================================
// LocoSnap — Auth State Management
// ============================================================

import { create } from "zustand";
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
  region: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  continueAsGuest: () => void;
  clearGuest: () => void;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setSession: (session: Session | null) => void;
  incrementDailyScans: () => Promise<void>;
  updateRegion: (region: string | null) => Promise<void>;
  canScan: () => boolean;
}

const MAX_DAILY_SCANS = 5;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  isLoading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session, user: session.user, isGuest: false, isLoading: false });
        loginRevenueCat(session.user.id);
        get().fetchProfile();
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        const wasGuest = get().isGuest;
        set({
          session,
          user: session?.user ?? null,
          // Only clear guest if they actually signed in (got a session)
          // Don't reset isGuest to true just because session is null
          isGuest: session ? false : wasGuest,
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

  continueAsGuest: () => {
    set({ isGuest: true, isLoading: false });
    track("guest_mode");
    addBreadcrumb("auth", "Continued as guest");
  },

  clearGuest: () => {
    set({ isGuest: false });
  },

  signOut: async () => {
    track("sign_out");
    await logoutRevenueCat();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isGuest: false });
    resetIdentity();
  },

  setSession: (session) => {
    const wasGuest = get().isGuest;
    set({
      session,
      user: session?.user ?? null,
      isGuest: session ? false : wasGuest,
    });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      // Identify user for analytics
      identifyUser(user.id, {
        is_pro: data.is_pro,
        level: data.level,
        region: data.region,
      });

      // Check if daily scans need reset (past midnight)
      const resetAt = new Date(data.daily_scans_reset_at);
      const now = new Date();
      if (now.toDateString() !== resetAt.toDateString()) {
        // New day — reset scan count
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
      const isPro = await syncProStatus(user.id);
      if (isPro !== data.is_pro) {
        // RevenueCat disagrees with DB — update local state
        const currentProfile = get().profile;
        if (currentProfile) {
          set({ profile: { ...currentProfile, is_pro: isPro } });
        }
      }
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

  canScan: () => {
    const { profile, isGuest } = get();
    // Guests can always scan (stored locally)
    if (isGuest) return true;
    // Pro users have unlimited scans
    if (profile?.is_pro) return true;
    // Free users: check daily limit
    return (profile?.daily_scans_used ?? 0) < MAX_DAILY_SCANS;
  },
}));
