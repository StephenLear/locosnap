// ============================================================
// LocoSnap — Train Radar (Phase 2)
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
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../../constants/theme";
import { fetchSpotHeatmap } from "../../services/supabase";
import { HeatmapCell, RarityTier } from "../../types";

// Mirrors the rarity palette used across history/results/cards.
const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

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

export default function RadarScreen() {
  const { t } = useTranslation();
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState(GRID_FINE);
  const [selected, setSelected] = useState<HeatmapCell | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);

  const load = useCallback(async (g: number) => {
    setLoading(true);
    const data = await fetchSpotHeatmap(g, 2);
    setCells(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(grid);
  }, [grid, load]);

  const onSelectCell = useCallback(async (cell: HeatmapCell) => {
    setSelected(cell);
    setSelectedPlace(null);
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: cell.lat,
        longitude: cell.lng,
      });
      const r = results[0];
      if (r) {
        const name = r.city || r.subregion || r.region || r.country;
        setSelectedPlace(name || null);
      }
    } catch {
      // Reverse-geocode is best-effort; the stats still show without a name.
    }
  }, []);

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
              strokeColor={rarityColors[cell.topRarity]}
              strokeWidth={2}
              fillColor={`${rarityColors[cell.topRarity]}${cellFillAlpha(
                cell.spotCount
              )}`}
              zIndex={cell.spotCount}
            />
          );
        })}
        {/* Transparent tap targets (Circle isn't tappable in rn-maps 1.20). */}
        {cells.map((cell, i) => (
          <Marker
            key={`tap_${cell.lat}_${cell.lng}_${i}`}
            coordinate={{ latitude: cell.lat, longitude: cell.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onSelectCell(cell)}
          >
            {/* Invisible child fully replaces the default pin, leaving only
                a transparent tap target over the Circle. */}
            <View style={styles.tapTarget} />
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.headerCard}>
          <Ionicons name="radio" size={16} color={colors.accent} />
          <Text style={styles.headerSubtitle}>{t("radar.subtitle")}</Text>
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
              {t("radar.gridFine")}
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
              {t("radar.gridCoarse")}
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
            <Text style={styles.emptyText}>{t("radar.empty")}</Text>
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
              color={rarityColors[selected.topRarity]}
            />
            <Text style={styles.infoPlace}>
              {selectedPlace || t("radar.thisArea")}
            </Text>
          </View>
          <View style={styles.infoStats}>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>{selected.spotCount}</Text>
              <Text style={styles.infoStatLabel}>{t("radar.spots")}</Text>
            </View>
            <View style={styles.infoStat}>
              <Text style={styles.infoStatValue}>
                {selected.distinctClasses}
              </Text>
              <Text style={styles.infoStatLabel}>{t("radar.classes")}</Text>
            </View>
            <View style={styles.infoStat}>
              <Text
                style={[
                  styles.infoStatValue,
                  { color: rarityColors[selected.topRarity] },
                ]}
              >
                {t(`rarity.${selected.topRarity}`)}
              </Text>
              <Text style={styles.infoStatLabel}>{t("radar.rarest")}</Text>
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
  tapTarget: { width: 36, height: 36 },
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
