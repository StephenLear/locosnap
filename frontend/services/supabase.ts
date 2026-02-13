// ============================================================
// LocoSnap — Supabase Service Layer
// CRUD operations for spots, trains, and storage
// ============================================================

import { supabase } from "../config/supabase";
import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
  HistoryItem,
} from "../types";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

// ── Types ───────────────────────────────────────────────────

interface SpotRecord {
  id: string;
  user_id: string;
  train_id: string | null;
  photo_url: string | null;
  blueprint_url: string | null;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  is_first_spot: boolean;
  spotted_at: string;
  created_at: string;
  // Joined data
  train?: TrainRecord;
}

interface TrainRecord {
  id: string;
  class: string;
  name: string | null;
  operator: string;
  type: string;
  designation: string;
  rarity_tier: string;
  specs: TrainSpecs;
  facts: TrainFacts;
}

// ── Train upsert ────────────────────────────────────────────

/**
 * Find or create a train record. Returns the train ID.
 */
export async function upsertTrain(
  train: TrainIdentification,
  specs: TrainSpecs,
  facts: TrainFacts,
  rarity: RarityInfo
): Promise<string | null> {
  // Check if this train class + operator already exists
  const { data: existing } = await supabase
    .from("trains")
    .select("id")
    .eq("class", train.class)
    .eq("operator", train.operator)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new train record
  const { data, error } = await supabase
    .from("trains")
    .insert({
      class: train.class,
      name: train.name,
      operator: train.operator,
      type: train.type,
      designation: train.designation,
      rarity_tier: rarity.tier,
      specs,
      facts,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to upsert train:", error.message);
    return null;
  }

  return data.id;
}

// ── Spots CRUD ──────────────────────────────────────────────

/**
 * Save a new spot to Supabase.
 */
export async function saveSpot(params: {
  userId: string;
  trainId: string | null;
  train: TrainIdentification;
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  photoUrl: string | null;
  blueprintUrl: string | null;
  confidence: number;
  latitude?: number;
  longitude?: number;
}): Promise<string | null> {
  // Check for first-ever spot of this train by this user
  let isFirstSpot = false;
  if (params.trainId) {
    const { count } = await supabase
      .from("spots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .eq("train_id", params.trainId);

    isFirstSpot = (count ?? 0) === 0;
  }

  const { data, error } = await supabase
    .from("spots")
    .insert({
      user_id: params.userId,
      train_id: params.trainId,
      photo_url: params.photoUrl,
      blueprint_url: params.blueprintUrl,
      confidence: params.confidence,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      is_first_spot: isFirstSpot,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Failed to save spot:", error.message);
    return null;
  }

  return data.id;
}

/**
 * Fetch all spots for a user, most recent first.
 */
export async function fetchSpots(
  userId: string,
  limit: number = 50
): Promise<HistoryItem[]> {
  const { data, error } = await supabase
    .from("spots")
    .select(`
      id,
      photo_url,
      blueprint_url,
      confidence,
      spotted_at,
      created_at,
      train:trains (
        id,
        class,
        name,
        operator,
        type,
        designation,
        rarity_tier,
        specs,
        facts
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch spots:", error.message);
    return [];
  }

  // Map Supabase records to HistoryItem format
  return (data || []).map((spot: any) => {
    const train = spot.train;
    return {
      id: spot.id,
      train: {
        class: train?.class || "Unknown",
        name: train?.name || null,
        operator: train?.operator || "Unknown",
        type: train?.type || "Unknown",
        designation: train?.designation || "",
        yearBuilt: null,
        confidence: spot.confidence,
        color: "",
        description: "",
      },
      specs: train?.specs || {},
      facts: train?.facts || { summary: "", funFacts: [], notableEvents: [] },
      rarity: {
        tier: train?.rarity_tier || "common",
        reason: "",
        productionCount: null,
        survivingCount: null,
      },
      blueprintUrl: spot.blueprint_url,
      spottedAt: spot.created_at,
    } as HistoryItem;
  });
}

/**
 * Delete a spot by ID (user must own it — RLS enforces this).
 */
export async function deleteSpot(spotId: string): Promise<boolean> {
  const { error } = await supabase
    .from("spots")
    .delete()
    .eq("id", spotId);

  if (error) {
    console.warn("Failed to delete spot:", error.message);
    return false;
  }

  return true;
}

/**
 * Update a spot's blueprint URL (after async generation completes).
 */
export async function updateSpotBlueprint(
  spotId: string,
  blueprintUrl: string
): Promise<boolean> {
  const { error } = await supabase
    .from("spots")
    .update({ blueprint_url: blueprintUrl })
    .eq("id", spotId);

  if (error) {
    console.warn("Failed to update blueprint:", error.message);
    return false;
  }

  return true;
}

// ── Storage uploads ─────────────────────────────────────────

/**
 * Upload a photo from a local URI to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadPhoto(
  userId: string,
  localUri: string,
  spotId: string
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const filePath = `${userId}/${spotId}.jpg`;

    const { error } = await supabase.storage
      .from("spot-photos")
      .upload(filePath, decode(base64), {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.warn("Failed to upload photo:", error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("spot-photos")
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.warn("Photo upload error:", (error as Error).message);
    return null;
  }
}

/**
 * Upload a blueprint image URL to Supabase Storage.
 * Downloads from the remote URL, then uploads to the bucket.
 * Returns the public URL.
 */
export async function uploadBlueprint(
  userId: string,
  remoteUrl: string,
  spotId: string
): Promise<string | null> {
  try {
    // Download to temp file first
    const tempPath = `${FileSystem.cacheDirectory}blueprint_${spotId}.png`;
    const download = await FileSystem.downloadAsync(remoteUrl, tempPath);

    if (download.status !== 200) {
      console.warn("Failed to download blueprint for upload");
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(tempPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const filePath = `${userId}/${spotId}.png`;

    const { error } = await supabase.storage
      .from("blueprints")
      .upload(filePath, decode(base64), {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.warn("Failed to upload blueprint:", error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("blueprints")
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.warn("Blueprint upload error:", (error as Error).message);
    return null;
  }
}

// ── Leaderboard ─────────────────────────────────────────────

export interface LeaderboardEntry {
  username: string;
  level: number;
  totalSpots: number;
  uniqueTrains: number;
  rareCount: number;
}

/**
 * Fetch the top spotters leaderboard.
 */
export async function fetchLeaderboard(
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .limit(limit);

  if (error) {
    console.warn("Failed to fetch leaderboard:", error.message);
    return [];
  }

  return (data || []).map((entry: any) => ({
    username: entry.username || "Anonymous Spotter",
    level: entry.level || 1,
    totalSpots: entry.total_spots || 0,
    uniqueTrains: entry.unique_trains || 0,
    rareCount: entry.rare_count || 0,
  }));
}
