// ============================================================
// LocoSnap — Design System / Theme Constants
// ============================================================

export const colors = {
  // Primary palette
  background: "#0a0f1a",
  surface: "#131b2e",
  surfaceLight: "#1a2540",
  surfaceHighlight: "#223052",

  // Accent colors — teal/blue scanner palette (matches app icon)
  primary: "#0066FF", // Blue
  primaryLight: "#338AFF",
  accent: "#00D4AA", // Teal (scanner accent)
  accentLight: "#33DDBB",
  accentDim: "#00D4AA", // Alias for backward compat
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  // Borders
  border: "#1e293b",
  borderLight: "#334155",
};

export const fonts = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    hero: 32,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
