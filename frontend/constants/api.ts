// ============================================================
// LocoSnap — API Configuration
// ============================================================

// Change this to your deployed backend URL
// For local development: http://localhost:3000
// For production: https://your-locosnap-api.onrender.com
export const API_BASE_URL = __DEV__
  ? "http://localhost:3000"
  : "https://your-locosnap-api.onrender.com";

// Polling interval for blueprint generation status (ms)
export const BLUEPRINT_POLL_INTERVAL = 3000;

// Max time to wait for blueprint before giving up (ms)
export const BLUEPRINT_TIMEOUT = 120000;
