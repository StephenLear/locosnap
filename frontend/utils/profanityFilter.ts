// ============================================================
// LocoSnap — Username Validation & Profanity Filter
// Validates usernames for the leaderboard and profile screen
// ============================================================

// Common profanity blocklist (lowercase, checked as substrings)
const BLOCKED_WORDS: string[] = [
  "anal", "anus", "arse", "ass", "ballsack", "bastard", "bitch", "bloody",
  "blowjob", "bollock", "boner", "boob", "bugger", "bum", "butt", "clitoris",
  "cock", "coon", "crap", "cunt", "damn", "dick", "dildo", "dyke", "fag",
  "feck", "fellate", "fuck", "goddamn", "homo", "jerk", "jizz", "knob",
  "labia", "minge", "muff", "nazi", "nigga", "nigger", "nob", "penis",
  "piss", "poop", "porn", "prick", "pube", "pussy", "queer", "rape",
  "scrotum", "sex", "shit", "slut", "smeg", "spunk", "tit", "tosser",
  "turd", "twat", "vagina", "wank", "whore", "wtf",
];

/**
 * Check if a string contains profanity (case-insensitive substring match).
 */
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => lower.includes(word));
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a username for the leaderboard.
 * Rules:
 * - 3-20 characters
 * - Alphanumeric and underscores only
 * - No profanity
 * - Not empty/whitespace
 */
export function isValidUsername(username: string): ValidationResult {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return { valid: false, reason: "Username cannot be empty" };
  }

  if (trimmed.length < 3) {
    return { valid: false, reason: "Username must be at least 3 characters" };
  }

  if (trimmed.length > 20) {
    return { valid: false, reason: "Username must be 20 characters or less" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, reason: "Letters, numbers, and underscores only" };
  }

  if (containsProfanity(trimmed)) {
    return { valid: false, reason: "That username is not allowed" };
  }

  return { valid: true };
}
