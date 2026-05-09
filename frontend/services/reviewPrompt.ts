// Triggers expo-store-review's native rating prompt at well-defined
// "wow moments" in the user's collection journey. Layers a 90-day local
// throttle on top of iOS's native 365-day rate limit, so we don't burn
// three prompts in one good week.
//
// Allowed triggers:
//   legendary_scan          — first time a user sees a Legendary card
//   achievement_silver_gold — silver or gold tier achievement unlocked
//   streak_7d               — daily-streak counter hits 7
//   unique_classes_50       — 50th unique class scanned

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

export type ReviewTrigger =
  | "legendary_scan"
  | "achievement_silver_gold"
  | "streak_7d"
  | "unique_classes_50";

const ALLOWED_TRIGGERS: readonly ReviewTrigger[] = [
  "legendary_scan",
  "achievement_silver_gold",
  "streak_7d",
  "unique_classes_50",
] as const;

const STORAGE_KEY = "last_review_prompt_at";
const THROTTLE_MS = 90 * 24 * 60 * 60 * 1000;
const MIN_SCAN_COUNT = 3;

export interface MaybePromptReviewArgs {
  trigger: ReviewTrigger | string;
  scanCount: number;
}

export async function maybePromptReview(
  args: MaybePromptReviewArgs
): Promise<void> {
  if (!ALLOWED_TRIGGERS.includes(args.trigger as ReviewTrigger)) return;
  if (args.scanCount < MIN_SCAN_COUNT) return;

  const available = await StoreReview.isAvailableAsync();
  if (!available) return;

  const lastRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (lastRaw) {
    const last = parseInt(lastRaw, 10);
    if (!Number.isNaN(last) && Date.now() - last < THROTTLE_MS) return;
  }

  try {
    await StoreReview.requestReview();
    await AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch (err) {
    console.warn("[reviewPrompt] requestReview failed", err);
  }
}
