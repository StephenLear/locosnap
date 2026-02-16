// ============================================================
// LocoSnap — API Configuration
// ============================================================

// Uses EXPO_PUBLIC_API_URL from .env if set, otherwise falls back to defaults
// For local development: http://localhost:3000
// For production: https://locosnap.onrender.com
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? "http://localhost:3000" : "https://locosnap.onrender.com");

// Polling interval for blueprint generation status (ms)
export const BLUEPRINT_POLL_INTERVAL = 3000;

// Max time to wait for blueprint before giving up (ms)
export const BLUEPRINT_TIMEOUT = 120000;
