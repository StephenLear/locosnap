// ============================================================
// CarSnap — Results Screen
// Shows identified car info, specs, reviews, and infographic
// ============================================================

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCarStore } from "../store/carStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

// ── Score Bar Component ─────────────────────────────────
function ScoreBar({
  label,
  score,
  maxScore = 10,
}: {
  label: string;
  score: number;
  maxScore?: number;
}) {
  const percentage = (score / maxScore) * 100;
  const barColor =
    score >= 7.5
      ? colors.success
      : score >= 5
        ? colors.warning
        : colors.danger;

  return (
    <View style={styles.scoreBarContainer}>
      <View style={styles.scoreBarHeader}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <Text style={[styles.scoreBarValue, { color: barColor }]}>
          {score.toFixed(1)}
        </Text>
      </View>
      <View style={styles.scoreBarTrack}>
        <View
          style={[
            styles.scoreBarFill,
            { width: `${percentage}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

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
    currentCar,
    currentSpecs,
    currentReviews,
    infographicStatus,
  } = useCarStore();

  if (!currentCar) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No car data available</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.emptyLink}>Go back and scan a car</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safetyStars = currentSpecs?.safetyRating
    ? "★".repeat(Math.round(currentSpecs.safetyRating)) +
      "☆".repeat(5 - Math.round(currentSpecs.safetyRating))
    : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ── Car Identity Card ──────────────────────── */}
      <View style={styles.identityCard}>
        <View style={styles.identityHeader}>
          <View style={styles.identityInfo}>
            <Text style={styles.carYear}>{currentCar.year}</Text>
            <Text style={styles.carName}>
              {currentCar.make} {currentCar.model}
            </Text>
            <Text style={styles.carTrim}>
              {currentCar.trim} · {currentCar.color} · {currentCar.bodyStyle}
            </Text>
          </View>
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  currentCar.confidence >= 80
                    ? "rgba(34, 197, 94, 0.15)"
                    : currentCar.confidence >= 60
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
                    currentCar.confidence >= 80
                      ? colors.success
                      : currentCar.confidence >= 60
                        ? colors.warning
                        : colors.danger,
                },
              ]}
            >
              {currentCar.confidence}%
            </Text>
            <Text style={styles.confidenceLabel}>match</Text>
          </View>
        </View>
        {currentCar.description && (
          <Text style={styles.carDescription}>{currentCar.description}</Text>
        )}
      </View>

      {/* ── Infographic Button ─────────────────────── */}
      <TouchableOpacity
        style={[
          styles.infographicBtn,
          infographicStatus?.status === "completed"
            ? styles.infographicBtnReady
            : styles.infographicBtnLoading,
        ]}
        onPress={() => {
          if (infographicStatus?.status === "completed") {
            router.push("/infographic");
          }
        }}
        disabled={infographicStatus?.status !== "completed"}
      >
        <Ionicons
          name={
            infographicStatus?.status === "completed"
              ? "image"
              : infographicStatus?.status === "failed"
                ? "alert-circle"
                : "hourglass"
          }
          size={24}
          color={
            infographicStatus?.status === "completed"
              ? colors.accent
              : colors.textSecondary
          }
        />
        <View style={styles.infographicBtnContent}>
          <Text style={styles.infographicBtnTitle}>
            {infographicStatus?.status === "completed"
              ? "View Technical Infographic"
              : infographicStatus?.status === "failed"
                ? "Infographic Generation Failed"
                : "Generating Infographic..."}
          </Text>
          <Text style={styles.infographicBtnSubtitle}>
            {infographicStatus?.status === "completed"
              ? "Industrial engineering-style blueprint"
              : infographicStatus?.status === "failed"
                ? infographicStatus.error || "Try again later"
                : "This may take up to 60 seconds"}
          </Text>
        </View>
        {infographicStatus?.status === "completed" && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        )}
      </TouchableOpacity>

      {/* ── Specs Section ──────────────────────────── */}
      {currentSpecs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          <View style={styles.specsCard}>
            {safetyStars && (
              <View style={styles.safetyRow}>
                <Text style={styles.safetyLabel}>NHTSA Safety</Text>
                <Text style={styles.safetyStars}>{safetyStars}</Text>
              </View>
            )}
            <SpecRow
              icon="speedometer"
              label="Engine"
              value={currentSpecs.engine}
            />
            <SpecRow
              icon="flash"
              label="Horsepower"
              value={
                currentSpecs.horsepower
                  ? `${currentSpecs.horsepower} HP`
                  : null
              }
            />
            <SpecRow
              icon="cog"
              label="Transmission"
              value={currentSpecs.transmission}
            />
            <SpecRow
              icon="navigate"
              label="Drivetrain"
              value={currentSpecs.drivetrain}
            />
            <SpecRow
              icon="resize"
              label="Wheelbase"
              value={currentSpecs.wheelbase}
            />
            <SpecRow
              icon="scale"
              label="Curb Weight"
              value={currentSpecs.curbWeight}
            />
            {currentSpecs.fuelEconomy && (
              <SpecRow
                icon="leaf"
                label="Fuel Economy"
                value={`${currentSpecs.fuelEconomy.city}/${currentSpecs.fuelEconomy.highway} MPG (city/hwy)`}
              />
            )}
          </View>
        </View>
      )}

      {/* ── Reviews Section ────────────────────────── */}
      {currentReviews && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>

          {/* Overall score hero */}
          <View style={styles.overallScoreCard}>
            <Text style={styles.overallScoreValue}>
              {currentReviews.overallScore.toFixed(1)}
            </Text>
            <Text style={styles.overallScoreLabel}>/ 10 Overall</Text>
          </View>

          {/* Score breakdowns */}
          <View style={styles.scoresCard}>
            <ScoreBar label="Safety" score={currentReviews.safetyScore} />
            <ScoreBar
              label="Reliability"
              score={currentReviews.reliabilityScore}
            />
            <ScoreBar
              label="Performance"
              score={currentReviews.performanceScore}
            />
            <ScoreBar label="Comfort" score={currentReviews.comfortScore} />
            <ScoreBar label="Value" score={currentReviews.valueScore} />
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{currentReviews.summary}</Text>
          </View>

          {/* Pros & Cons */}
          {(currentReviews.pros.length > 0 || currentReviews.cons.length > 0) && (
            <View style={styles.prosConsContainer}>
              {currentReviews.pros.length > 0 && (
                <View style={styles.prosCard}>
                  <Text style={styles.prosTitle}>Pros</Text>
                  {currentReviews.pros.map((pro, i) => (
                    <View key={i} style={styles.prosConRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={colors.success}
                      />
                      <Text style={styles.prosConText}>{pro}</Text>
                    </View>
                  ))}
                </View>
              )}
              {currentReviews.cons.length > 0 && (
                <View style={styles.consCard}>
                  <Text style={styles.consTitle}>Cons</Text>
                  {currentReviews.cons.map((con, i) => (
                    <View key={i} style={styles.prosConRow}>
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.danger}
                      />
                      <Text style={styles.prosConText}>{con}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Sources */}
          {currentReviews.sources.length > 0 && (
            <View style={styles.sourcesCard}>
              <Text style={styles.sourcesTitle}>Review Sources</Text>
              {currentReviews.sources.map((source, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.sourceRow}
                  onPress={() => Linking.openURL(source.url)}
                >
                  <Text style={styles.sourceName}>{source.name}</Text>
                  <Text style={styles.sourceScore}>
                    {source.score.toFixed(1)}/10
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
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
  carYear: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
    marginBottom: 2,
  },
  carName: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  carTrim: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
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
  carDescription: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 20,
  },

  // Infographic button
  infographicBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  infographicBtnReady: {
    backgroundColor: "rgba(255, 107, 0, 0.08)",
    borderColor: "rgba(255, 107, 0, 0.3)",
  },
  infographicBtnLoading: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  infographicBtnContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infographicBtnTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  infographicBtnSubtitle: {
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
  safetyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  safetyLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },
  safetyStars: {
    fontSize: fonts.sizes.lg,
    color: colors.warning,
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

  // Reviews
  overallScoreCard: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overallScoreValue: {
    fontSize: 48,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  overallScoreLabel: {
    fontSize: fonts.sizes.lg,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  scoresCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreBarContainer: {
    marginBottom: spacing.md,
  },
  scoreBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  scoreBarLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  scoreBarValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
  },
  scoreBarTrack: {
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Summary
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

  // Pros & Cons
  prosConsContainer: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  prosCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prosTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  consTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  prosConRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  prosConText: {
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },

  // Sources
  sourcesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourcesTitle: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  sourceName: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
  },
  sourceScore: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
    marginRight: spacing.sm,
  },
});
