// ============================================================
// LocoSnap — Auth State Management
// ============================================================

import { create } from "zustand";
import { supabase } from "../config/supabase";
import { Session, User } from "@supabase/supabase-js";

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
        get().fetchProfile();
      } else {
        set({ isLoading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          isGuest: !session,
        });
        if (session) {
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
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
  },

  signInWithMagicLink: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  },

  continueAsGuest: () => {
    set({ isGuest: true, isLoading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isGuest: false });
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isGuest: !session,
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
