// ============================================================
// CarSnap — API Configuration
// ============================================================

// Change this to your deployed backend URL
// For local development: http://localhost:3000
// For production: https://your-carsnap-api.onrender.com
export const API_BASE_URL = __DEV__
  ? "http://localhost:3000"
  : "https://your-carsnap-api.onrender.com";

// Polling interval for infographic generation status (ms)
export const INFOGRAPHIC_POLL_INTERVAL = 3000;

// Max time to wait for infographic before giving up (ms)
export const INFOGRAPHIC_TIMEOUT = 120000;
