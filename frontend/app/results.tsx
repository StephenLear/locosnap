// ============================================================
// LocoSnap — Results Screen
// Shows identified train info, specs, facts, rarity, and blueprint
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { RarityTier, BlueprintStyle, BLUEPRINT_STYLES } from "../types";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { track } from "../services/analytics";
import { generateBlueprintWithCredit, pollBlueprintStatus } from "../services/api";

// ── Rarity colours ──────────────────────────────────────
const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const rarityLabels: Record<RarityTier, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

// ── Spec Row Component ──────────────────────────────────
function SpecRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.specRow}>
      <Ionicons
        name={icon as any}
        size={18}
        color={colors.accent}
      />
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

// ── Main Results Screen ─────────────────────────────────
export default function ResultsScreen() {
  const router = useRouter();
  const {
    currentTrain,
    currentSpecs,
    currentFacts,
    currentRarity,
    blueprintStatus,
    currentLocation,
    selectedBlueprintStyle,
    setBlueprintStyle,
    setBlueprintStatus,
  } = useTrainStore();

  const { profile, isGuest, user, deductBlueprintCredit, fetchProfile } = useAuthStore();
  const isPro = profile?.is_pro ?? false;
  const credits = profile?.blueprint_credits ?? 0;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreditBlueprint = async () => {
    if (!user || credits <= 0 || !currentTrain) return;

    setIsGenerating(true);
    try {
      const result = await generateBlueprintWithCredit(
        user.id,
        currentTrain,
        currentSpecs,
        selectedBlueprintStyle
      );

      // Update local credit count
      await fetchProfile();

      // Start polling for blueprint completion
      const { promise } = pollBlueprintStatus(result.taskId, (status) => {
        setBlueprintStatus(status);
      });
      promise.then(() => {});

      track("blueprint_credit_generated", {
        style: selectedBlueprintStyle,
        remaining: result.creditsRemaining,
      });
    } catch (error) {
      Alert.alert(
        "Blueprint Error",
        (error as Error).message || "Could not generate blueprint."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!currentTrain) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No train data available</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.emptyLink}>Go back and spot a train</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rarityColor = currentRarity
    ? rarityColors[currentRarity.tier]
    : colors.textMuted;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ── Rarity Badge ─────────────────────────────── */}
      {currentRarity && (
        <View
          style={[
            styles.rarityBadge,
            { borderColor: rarityColor, backgroundColor: `${rarityColor}15` },
          ]}
        >
          <View style={styles.rarityHeader}>
            <Ionicons name="diamond" size={20} color={rarityColor} />
            <Text style={[styles.rarityTier, { color: rarityColor }]}>
              {rarityLabels[currentRarity.tier]}
            </Text>
          </View>
          <Text style={styles.rarityReason}>{currentRarity.reason}</Text>
          {(currentRarity.productionCount || currentRarity.survivingCount) && (
            <View style={styles.rarityStats}>
              {currentRarity.productionCount && (
                <Text style={styles.rarityStat}>
                  {currentRarity.productionCount} built
                </Text>
              )}
              {currentRarity.survivingCount && (
                <Text style={[styles.rarityStat, { color: rarityColor }]}>
                  {currentRarity.survivingCount} surviving
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Train Identity Card ──────────────────────── */}
      <View style={styles.identityCard}>
        <View style={styles.identityHeader}>
          <View style={styles.identityInfo}>
            <Text style={styles.trainClass}>{currentTrain.class}</Text>
            {currentTrain.name && (
              <Text style={styles.trainName}>"{currentTrain.name}"</Text>
            )}
            <Text style={styles.trainMeta}>
              {currentTrain.operator} · {currentTrain.type} · {currentTrain.color}
            </Text>
            {currentTrain.yearBuilt && (
              <Text style={styles.trainYear}>
                Built {currentTrain.yearBuilt} · {currentTrain.designation}
              </Text>
            )}
            {currentLocation && (
              <View style={styles.locationRow}>
                <Ionicons name="location" size={12} color={colors.primary} />
                <Text style={styles.locationText}>
                  {currentLocation.latitude.toFixed(4)}°N, {currentLocation.longitude.toFixed(4)}°W
                </Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  currentTrain.confidence >= 80
                    ? "rgba(34, 197, 94, 0.15)"
                    : currentTrain.confidence >= 60
                      ? "rgba(234, 179, 8, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
              },
            ]}
          >
            <Text
              style={[
                styles.confidenceText,
                {
                  color:
                    currentTrain.confidence >= 80
                      ? colors.success
                      : currentTrain.confidence >= 60
                        ? colors.warning
                        : colors.danger,
                },
              ]}
            >
              {currentTrain.confidence}%
            </Text>
            <Text style={styles.confidenceLabel}>match</Text>
          </View>
        </View>
        {currentTrain.description && (
          <Text style={styles.trainDescription}>{currentTrain.description}</Text>
        )}
      </View>

      {/* ── Blueprint Style Picker (Pro only) ─────────── */}
      {isPro && (
        <View style={styles.styleSection}>
          <Text style={styles.styleSectionTitle}>Blueprint Style</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.styleRow}
          >
            {BLUEPRINT_STYLES.map((s) => {
              const isSelected = selectedBlueprintStyle === s.id;

              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.styleCard,
                    isSelected && styles.styleCardSelected,
                  ]}
                  onPress={() => {
                    setBlueprintStyle(s.id);
                    track("blueprint_style_selected", { style: s.id });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={s.icon as any}
                    size={20}
                    color={isSelected ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.styleLabel,
                      isSelected && styles.styleLabelSelected,
                    ]}
                  >
                    {s.label}
                  </Text>
                  <Text style={styles.styleDesc} numberOfLines={1}>
                    {s.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Blueprint Button ─────────────────────────── */}
      {isPro ? (
        /* Pro users: full blueprint access */
        <TouchableOpacity
          style={[
            styles.blueprintBtn,
            blueprintStatus?.status === "completed"
              ? styles.blueprintBtnReady
              : styles.blueprintBtnLoading,
          ]}
          onPress={() => {
            if (blueprintStatus?.status === "completed") {
              router.push("/blueprint");
            }
          }}
          disabled={blueprintStatus?.status !== "completed"}
        >
          <Ionicons
            name={
              blueprintStatus?.status === "completed"
                ? "image"
                : blueprintStatus?.status === "failed"
                  ? "alert-circle"
                  : "hourglass"
            }
            size={24}
            color={
              blueprintStatus?.status === "completed"
                ? colors.accent
                : colors.textSecondary
            }
          />
          <View style={styles.blueprintBtnContent}>
            <Text style={styles.blueprintBtnTitle}>
              {blueprintStatus?.status === "completed"
                ? "View Technical Blueprint"
                : blueprintStatus?.status === "failed"
                  ? "Blueprint Generation Failed"
                  : "Generating Blueprint..."}
            </Text>
            <Text style={styles.blueprintBtnSubtitle}>
              {blueprintStatus?.status === "completed"
                ? "Locomotive works drawing style"
                : blueprintStatus?.status === "failed"
                  ? blueprintStatus.error || "Try again later"
                  : "This may take up to 60 seconds"}
            </Text>
          </View>
          {blueprintStatus?.status === "completed" && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          )}
        </TouchableOpacity>
      ) : blueprintStatus?.status === "completed" ? (
        /* Credit user: blueprint ready to view */
        <TouchableOpacity
          style={[styles.blueprintBtn, styles.blueprintBtnReady]}
          onPress={() => router.push("/blueprint")}
        >
          <Ionicons name="image" size={24} color={colors.accent} />
          <View style={styles.blueprintBtnContent}>
            <Text style={styles.blueprintBtnTitle}>View Technical Blueprint</Text>
            <Text style={styles.blueprintBtnSubtitle}>Locomotive works drawing style</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : blueprintStatus?.status === "processing" || blueprintStatus?.status === "queued" || isGenerating ? (
        /* Credit user: blueprint generating */
        <View style={[styles.blueprintBtn, styles.blueprintBtnLoading]}>
          <Ionicons name="hourglass" size={24} color={colors.textSecondary} />
          <View style={styles.blueprintBtnContent}>
            <Text style={styles.blueprintBtnTitle}>Generating Blueprint...</Text>
            <Text style={styles.blueprintBtnSubtitle}>This may take up to 60 seconds</Text>
          </View>
        </View>
      ) : !isGuest && credits > 0 ? (
        /* Authenticated user with credits: generate with credit */
        <TouchableOpacity
          style={[styles.blueprintBtn, styles.blueprintBtnCredit]}
          onPress={handleCreditBlueprint}
          activeOpacity={0.7}
        >
          <View style={styles.creditBadge}>
            <Ionicons name="sparkles" size={14} color={colors.accent} />
            <Text style={styles.creditBadgeText}>{credits}</Text>
          </View>
          <View style={styles.blueprintBtnContent}>
            <Text style={styles.blueprintBtnTitle}>Generate Blueprint</Text>
            <Text style={styles.blueprintBtnSubtitle}>
              Use 1 credit ({credits} remaining)
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.accent} />
        </TouchableOpacity>
      ) : (
        /* No credits / guest: upsell */
        <View>
          <TouchableOpacity
            style={[styles.blueprintBtn, styles.blueprintBtnCredit]}
            onPress={() => router.push("/paywall?source=blueprint_credit")}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={24} color={colors.accent} />
            <View style={styles.blueprintBtnContent}>
              <Text style={styles.blueprintBtnTitle}>Buy Blueprint</Text>
              <Text style={styles.blueprintBtnSubtitle}>
                £0.99 for a single blueprint
              </Text>
            </View>
            <Ionicons name="add-circle" size={20} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.blueprintBtn, styles.blueprintBtnLocked]}
            onPress={() => router.push("/paywall?source=blueprint")}
            activeOpacity={0.7}
          >
            <View style={styles.proBadge}>
              <Ionicons name="lock-closed" size={14} color="#f59e0b" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            <View style={styles.blueprintBtnContent}>
              <Text style={styles.blueprintBtnTitle}>Unlimited Blueprints</Text>
              <Text style={styles.blueprintBtnSubtitle}>
                All styles included with Pro
              </Text>
            </View>
            <Ionicons name="star" size={20} color="#f59e0b" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Specs Section ────────────────────────────── */}
      {currentSpecs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.specsCard}>
            {currentSpecs.status && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color: currentSpecs.status.toLowerCase().includes("service")
                        ? colors.success
                        : currentSpecs.status.toLowerCase().includes("preserved")
                          ? colors.warning
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {currentSpecs.status}
                </Text>
              </View>
            )}
            <SpecRow icon="speedometer" label="Max Speed" value={currentSpecs.maxSpeed} />
            <SpecRow icon="flash" label="Power" value={currentSpecs.power} />
            <SpecRow icon="scale" label="Weight" value={currentSpecs.weight} />
            <SpecRow icon="resize" label="Length" value={currentSpecs.length} />
            <SpecRow icon="git-merge" label="Gauge" value={currentSpecs.gauge} />
            <SpecRow icon="construct" label="Builder" value={currentSpecs.builder} />
            <SpecRow icon="flame" label="Fuel" value={currentSpecs.fuelType} />
            <SpecRow icon="map" label="Route" value={currentSpecs.route} />
            {currentSpecs.numberBuilt && (
              <SpecRow
                icon="layers"
                label="Built"
                value={`${currentSpecs.numberBuilt} units`}
              />
            )}
            {currentSpecs.numberSurviving && (
              <SpecRow
                icon="heart"
                label="Surviving"
                value={`${currentSpecs.numberSurviving} units`}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Facts Section ────────────────────────────── */}
      {currentFacts && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facts & History</Text>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{currentFacts.summary}</Text>
          </View>

          {/* Historical significance */}
          {currentFacts.historicalSignificance && (
            <View style={styles.significanceCard}>
              <View style={styles.significanceHeader}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={styles.significanceTitle}>Historical Significance</Text>
              </View>
              <Text style={styles.significanceText}>
                {currentFacts.historicalSignificance}
              </Text>
            </View>
          )}

          {/* Fun facts */}
          {currentFacts.funFacts.length > 0 && (
            <View style={styles.factsCard}>
              <Text style={styles.factsTitle}>Fun Facts</Text>
              {currentFacts.funFacts.map((fact, i) => (
                <View key={i} style={styles.factRow}>
                  <Ionicons
                    name="bulb"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.factText}>{fact}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Notable events */}
          {currentFacts.notableEvents.length > 0 && (
            <View style={styles.eventsCard}>
              <Text style={styles.eventsTitle}>Notable Events</Text>
              {currentFacts.notableEvents.map((event, i) => (
                <View key={i} style={styles.factRow}>
                  <Ionicons
                    name="flag"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.factText}>{event}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Bottom spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: fonts.sizes.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyLink: {
    fontSize: fonts.sizes.md,
    color: colors.primary,
  },

  // Rarity badge
  rarityBadge: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  rarityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rarityTier: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    letterSpacing: 2,
  },
  rarityReason: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  rarityStats: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  rarityStat: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
  },

  // Identity card
  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  identityInfo: {
    flex: 1,
  },
  trainClass: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  trainName: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
    marginBottom: 4,
  },
  trainMeta: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  trainYear: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  locationText: {
    fontSize: fonts.sizes.xs,
    color: colors.primary,
    fontWeight: fonts.weights.medium,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginLeft: spacing.md,
  },
  confidenceText: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  confidenceLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },
  trainDescription: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 20,
  },

  // Blueprint style picker
  styleSection: {
    marginBottom: spacing.md,
  },
  styleSectionTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  styleRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  styleCard: {
    width: 90,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center" as const,
    gap: 4,
  },
  styleCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(0, 212, 170, 0.08)",
  },
  styleCardLocked: {
    opacity: 0.6,
  },
  styleProBadge: {
    position: "absolute" as const,
    top: 4,
    right: 4,
  },
  styleLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    textAlign: "center" as const,
  },
  styleLabelSelected: {
    color: colors.accent,
  },
  styleLabelLocked: {
    color: colors.textMuted,
  },
  styleDesc: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "center" as const,
  },

  // Blueprint button
  blueprintBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  blueprintBtnReady: {
    backgroundColor: "rgba(0, 212, 170, 0.08)",
    borderColor: "rgba(0, 212, 170, 0.2)",
  },
  blueprintBtnLoading: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  blueprintBtnLocked: {
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  blueprintBtnCredit: {
    backgroundColor: "rgba(0, 212, 170, 0.06)",
    borderColor: "rgba(0, 212, 170, 0.25)",
  },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 212, 170, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  creditBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  proBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#f59e0b",
    letterSpacing: 1,
  },
  blueprintBtnContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  blueprintBtnTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  blueprintBtnSubtitle: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Specs
  specsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },
  statusValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  specLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    width: 100,
  },
  specValue: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
    fontWeight: fonts.weights.medium,
  },

  // Facts
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryText: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  significanceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  significanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  significanceTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.warning,
  },
  significanceText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  factsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factsTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  eventsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventsTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  factText: {
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
    lineHeight: 20,
  },
});
