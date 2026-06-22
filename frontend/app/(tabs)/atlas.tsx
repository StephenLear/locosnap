// ============================================================
// LocoSnap — Spotting Atlas (Phase 2; formerly "Train Radar")
//
// Communal, privacy-safe spot heatmap. Renders the aggregate
// cells from the get_spot_heatmap RPC (migration 022) as
// rarity-coloured circles on a native map. Cells are coarse grid
// centres (k>=2 distinct users) — NEVER a raw spot location or a
// user id. Areas with rarer finds glow hotter.
//
// Rendering note: PROVIDER_DEFAULT = Apple Maps on iOS (no key),
// Google Maps on Android (needs android.config.googleMaps.apiKey).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, {
  Circle,
  Marker,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { colors } from "../../constants/theme";
import { fetchSpotHeatmap } from "../../services/supabase";
import { useAuthStore } from "../../store/authStore";
import { HeatmapCell, RarityTier } from "../../types";

// Mirrors the rarity palette used across history/results/cards.
const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

// Defensive: top_rarity comes from the DB (cast to RarityTier). If a row
// ever carries a null/unexpected tier, fall back to the common colour so we
// never build an invalid color string (e.g. "undefined" + alpha), which can
// crash rn-maps' Circle on Android — and wouldn't show up in Expo Go.
function rarityColor(tier: RarityTier): string {
  return rarityColors[tier] ?? rarityColors.common;
}

const RARITY_ORDER: RarityTier[] = [
  "legendary",
  "epic",
  "rare",
  "uncommon",
  "common",
];

// Germany-centred default view (primary market). User can pan/zoom freely.
const INITIAL_REGION: Region = {
  latitude: 51.1,
  longitude: 10.4,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

// Two coarseness levels. Matches the validated RPC grids (0.1 deg ~11 km
// communal view; 0.25 deg ~25 km wider regional view).
const GRID_FINE = 0.1;
const GRID_COARSE = 0.25;

// Dark Google-Maps style (Android only; Apple Maps follows the forced dark
// userInterfaceStyle so it needs no custom style). Trimmed to essentials.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0a0f1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1a" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#131b2e" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

/** Circle radius (metres) for a cell: scales gently with spot density and
 *  is capped at half the grid size so neighbouring cells don't overlap. */
function cellRadius(cell: HeatmapCell, grid: number): number {
  const halfCellM = grid * 111_000 * 0.5;
  return Math.min(2_500 + cell.spotCount * 200, halfCellM);
}

/** More spots in a cell -> more opaque fill (the "heat"). */
function cellFillAlpha(spotCount: number): string {
  const a = Math.min(0.2 + spotCount * 0.01, 0.6);
  // hex alpha byte
  const byte = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  return byte;
}

export default function AtlasScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // The Atlas is gated behind sign-in: the heatmap is communal collection data,
  // and the get_spot_heatmap RPC is authenticated-only. Signed-out users get
  // a sign-in prompt (which also drives sign-ups) rather than the map.
  const user = useAuthStore((s) => s.user);
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to the coarser grid: with verified-only data the map is currently
  // thin, and 0.25° aggregates more spots per cell (denser first impression).
  // Users can switch to the finer 0.1° view via the toggle.
  const [grid, setGrid] = useState(GRID_COARSE);
  const [selected, setSelected] = useState<HeatmapCell | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  // Marker custom views must be "tracked" while they first render, or Android
  // snapshots them empty and falls back to the default red pin. Track briefly
  // after each data load, then stop (perf) once the dots have drawn.
  const [tracksChanges, setTracksChanges] = useState(true);

  const load = useCallback(async (g: number) => {
    setLoading(true);
    const data = await fetchSpotHeatmap(g, 2);
    setCells(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Don't hit the auth-only RPC when signed out (it would just 401 → []).
    if (!user) {
      setLoading(false);
      return;
    }
    load(grid);
  }, [grid, load, user]);

  useEffect(() => {
    if (cells.length === 0) return;
    setTracksChanges(true);
    const id = setTimeout(() => setTracksChanges(false), 1500);
    return () => clearTimeout(id);
  }, [cells]);

  const onSelectCell = useCallback(
    async (cell: HeatmapCell) => {
      setSelected(cell);
      setSelectedPlace(null);
      // Resolve a place name from the COARSE cell centre (never the user's
      // location). We use BigDataCloud's keyless reverse-geocode rather than
      // expo-location's reverseGeocodeAsync, which relies on the device
      // geocoder and returns nothing on many Android devices. Best-effort:
      // any failure falls back to the "This area" label.
      try {
        const lang = (i18n.language || "en").slice(0, 2);
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${cell.lat}&longitude=${cell.lng}&localityLanguage=${lang}`
        );
        if (res.ok) {
          const d = await res.json();
          const name =
            d.city || d.locality || d.principalSubdivision || d.countryName;
          if (name) setSelectedPlace(name);
        }
      } catch {
        // Network/geocode failure — the info card still shows the stats.
      }
    },
    [i18n.language]
  );

  // ── Signed-out gate ──────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.gate}>
          <Ionicons name="map" size={44} color={colors.accent} />
          <Text style={styles.gateTitle}>{t("atlas.signInTitle")}</Text>
          <Text style={styles.gateBody}>{t("atlas.signInBody")}</Text>
          <View style={styles.gateButtons}>
            <TouchableOpacity
              style={[styles.gateBtn, styles.gateBtnPrimary]}
              onPress={() => router.push("/sign-in?mode=login")}
            >
              <Ionicons name="log-in-outline" size={18} color={colors.accent} />
              <Text style={styles.gateBtnTextPrimary}>{t("atlas.logIn")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.gateBtn, styles.gateBtnSecondary]}
              onPress={() => router.push("/sign-in?mode=signup")}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.gateBtnTextSecondary}>{t("atlas.signUp")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        customMapStyle={Platform.OS === "android" ? DARK_MAP_STYLE : undefined}
        onPress={() => {
          setSelected(null);
          setSelectedPlace(null);
        }}
      >
        {cells.map((cell, i) => {
          const key = `${cell.lat}_${cell.lng}_${i}`;
          return (
            <Circle
              key={key}
              center={{ latitude: cell.lat, longitude: cell.lng }}
              radius={cellRadius(cell, grid)}
              strokeColor={rarityColor(cell.topRarity)}
              strokeWidth={2}
              fillColor={`${rarityColor(cell.topRarity)}${cellFillAlpha(
                cell.spotCount
              )}`}
              zIndex={cell.spotCount}
            />
          );
        })}
        {/* Rarity-coloured centre dot per cell — Circle isn't tappable in
            rn-maps 1.20, so this dot is the tap target. A *visible* custom
            view is required: a transparent one falls back to the default red
            pin on Android. The padded wrapper enlarges the tap area. */}
        {cells.map((cell, i) => (
          <Marker
            key={`dot_${cell.lat}_${cell.lng}_${i}`}
            coordinate={{ latitude: cell.lat, longitude: cell.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksChanges}
            onPress={() => onSelectCell(cell)}
          >
            <View style={styles.cellHit}>
              <View
                style={[
                  styles.cellDot,
                  { backgroundColor: rarityColor(cell.topRarity) },
                ]}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.headerCard}>
          <Ionicons name="map" size={16} color={colors.accent} />
          <Text style={styles.headerSubtitle}>{t("atlas.subtitle")}</Text>
        </View>

        {/* Grid (detail) toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              grid === GRID_FINE && styles.toggleBtnActive,
            ]}
            onPress={() => setGrid(GRID_FINE)}
          >
            <Text
              style={[
                styles.toggleText,
                grid === GRID_FINE && styles.toggleTextActive,
              ]}
            >
              {t("atlas.gridFine")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              grid === GRID_COARSE && styles.toggleBtnActive,
            ]}
            onPress={() => setGrid(GRID_COARSE)}
          >
            <Text
              style={[
                styles.toggleText,
                grid === GRID_COARSE && styles.toggleTextActive,
              ]}
            >
              {t("atlas.gridCoarse")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {/* Empty (no cells and not loading) */}
      {!loading && cells.length === 0 && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t("atlas.empty")}</Text>
          </View>
        </View>
      )}

      {/* Legend (hidden while the info card is open to avoid overlap) */}
      {!loading && cells.length > 0 && !selected && (
        <View style={styles.legend} pointerEvents="none">
          {RARITY_ORDER.map((tier) => (
            <View key={tier} style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: rarityColors[tier] }]}
              />
              <Text style={styles.legendText}>{t(`rarity.${tier}`)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Selected-cell info card */}
      {selected && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons
              name="location"
              size={18}
              color={rarityColor(selected.topRarity)}
            />
            <Text style={styles.infoPlace}>
              {selectedPlace || t("atlas.thisArea")}
            </Text>
          </View>
          <View style={styles.infoStats}>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>{selected.spotCount}</Text>
              <Text style={styles.infoStatLabel}>{t("atlas.spots")}</Text>
            </View>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>
                {selected.distinctClasses}
              </Text>
              <Text style={styles.infoStatLabel}>{t("atlas.classes")}</Text>
            </View>
            <View style={styles.infoStat}>
              <Text
                style={[
                  styles.infoStatValue,
                  { color: rarityColor(selected.topRarity) },
                ]}
              >
                {t(`rarity.${selected.topRarity}`)}
              </Text>
              <Text style={styles.infoStatLabel}>{t("atlas.rarest")}</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { ...StyleSheet.absoluteFillObject },
  cellHit: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cellDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  gateTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  gateBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  gateButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  gateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  gateBtnPrimary: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.accent,
  },
  gateBtnSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  gateBtnTextPrimary: { color: colors.accent, fontSize: 15, fontWeight: "700" },
  gateBtnTextSecondary: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  header: { position: "absolute", top: 12, left: 12, right: 12 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface + "f2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerSubtitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  toggle: {
    flexDirection: "row",
    alignSelf: "flex-end",
    marginTop: 10,
    backgroundColor: colors.surface + "f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  toggleTextActive: { color: colors.background },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: colors.surface + "f2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: "center",
    gap: 10,
    maxWidth: 260,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  legend: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: colors.surface + "f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontSize: 11, fontWeight: "500" },
  infoCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoPlace: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  infoStats: { flexDirection: "row", marginTop: 12, gap: 24 },
  infoStat: { alignItems: "flex-start" },
  infoStatValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  infoStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
