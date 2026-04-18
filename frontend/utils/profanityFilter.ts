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

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => lower.includes(word));
}

export interface ValidationResult {
  valid: boolean;
  // i18n key (under profile.usernameModal.errors) — translated by the caller.
  reasonKey?: string;
}

export function isValidUsername(username: string): ValidationResult {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return { valid: false, reasonKey: "profile.usernameModal.errors.empty" };
  }

  if (trimmed.length < 3) {
    return { valid: false, reasonKey: "profile.usernameModal.errors.tooShort" };
  }

  if (trimmed.length > 20) {
    return { valid: false, reasonKey: "profile.usernameModal.errors.tooLong" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, reasonKey: "profile.usernameModal.errors.invalidChars" };
  }

  if (containsProfanity(trimmed)) {
    return { valid: false, reasonKey: "profile.usernameModal.errors.notAllowed" };
  }

  return { valid: true };
}
