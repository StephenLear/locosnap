// ============================================================
// LocoSnap — Profile & Stats Screen
// Shows user stats, level, streak, achievements, collection breakdown
// ============================================================

import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { useTrainStore } from "../../store/trainStore";
import { useSettingsStore } from "../../store/settingsStore";
import i18n from "../../i18n";
import {
  RarityTier,
  AchievementType,
  ACHIEVEMENT_DEFINITIONS,
} from "../../types";
import {
  fetchAchievements,
  Achievement,
  UK_REGIONS,
} from "../../services/supabase";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";
import { isValidUsername } from "../../utils/profanityFilter";
import { IdentityBadge } from "../../components/IdentityBadge";
import { CountryFlagPicker } from "../../components/CountryFlagPicker";
import { EmojiPicker } from "../../components/EmojiPicker";

// ── Level system ────────────────────────────────────────────

const LEVELS = [
  { name: "Platform Newbie", minXp: 0, icon: "train-outline" },
  { name: "Casual Spotter", minXp: 100, icon: "eye-outline" },
  { name: "Basher", minXp: 500, icon: "walk-outline" },
  { name: "Grinder", minXp: 1500, icon: "flash-outline" },
  { name: "Copping Legend", minXp: 5000, icon: "trophy-outline" },
];

function getLevel(xp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  return { current, next, index: LEVELS.indexOf(current) + 1 };
}

// ── Rarity config ───────────────────────────────────────────

const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export default function ProfileScreen() {
  const { t } = useTranslation();

  const getRarityLabel = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "common": return t("rarity.common");
      case "uncommon": return t("rarity.uncommon");
      case "rare": return t("rarity.rare");
      case "epic": return t("rarity.epic");
      case "legendary": return t("rarity.legendary");
      default: return tier;
    }
  };
  const router = useRouter();
  const {
    profile,
    user,
    session,
    signOut,
    updateRegion,
    updateUsername,
    updateCountryCode,
    updateSpotterEmoji,
  } = useAuthStore();

  // ── Username edit modal state ────────────────────────────
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  // ── Identity (flag + emoji) edit modal state ────────────
  const [identityModalVisible, setIdentityModalVisible] = useState(false);
  const [draftCountry, setDraftCountry] = useState<string | null>(null);
  const [draftEmoji, setDraftEmoji] = useState<string | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);

  const handleOpenIdentityModal = () => {
    setDraftCountry(profile?.country_code ?? null);
    setDraftEmoji(profile?.spotter_emoji ?? null);
    setIdentityModalVisible(true);
  };

  const handleSaveIdentity = async () => {
    setIdentitySaving(true);
    try {
      if (draftCountry && draftCountry !== profile?.country_code) {
        await updateCountryCode(draftCountry);
      }
      if (draftEmoji && draftEmoji !== profile?.spotter_emoji) {
        await updateSpotterEmoji(draftEmoji);
      }
      setIdentityModalVisible(false);
    } finally {
      setIdentitySaving(false);
    }
  };

  const handleProLockTapped = () => {
    Alert.alert(
      t("onboardingIdentity.emojiProLockTitle"),
      t("onboardingIdentity.emojiProLockBody"),
      [{ text: t("onboardingIdentity.emojiProLockOk") }]
    );
  };

  const handleOpenUsernameModal = () => {
    setUsernameInput(profile?.username || "");
    setUsernameError("");
    setUsernameModalVisible(true);
  };

  const handleSaveUsername = async () => {
    const validation = isValidUsername(usernameInput);
    if (!validation.valid) {
      setUsernameError(t(validation.reasonKey || "profile.usernameModal.errors.generic"));
      return;
    }

    setUsernameSaving(true);
    setUsernameError("");
    const result = await updateUsername(usernameInput);
    setUsernameSaving(false);

    if (result.success) {
      setUsernameModalVisible(false);
    } else {
      setUsernameError(t(result.errorKey || "profile.usernameModal.errors.generic"));
    }
  };
  const { history } = useTrainStore();
  const { language, setLanguage } = useSettingsStore();

  const handleLanguageToggle = async () => {
    const next = language === "en" ? "de" : "en";
    await setLanguage(next);
  };

  // ── Achievements state ────────────────────────────────────
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    Set<AchievementType>
  >(new Set());

  useEffect(() => {
    if (user) {
      fetchAchievements(user.id).then((achievements) => {
        setUnlockedAchievements(new Set(achievements.map((a) => a.type)));
      });
    }
  }, [user, history.length]); // Refresh when history changes (new spot may unlock)

  // ── Collection stats ────────────────────────────────────
  const stats = useMemo(() => {
    const uniqueClasses = new Set<string>();
    const rarityBreakdown: Record<RarityTier, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    };
    const operatorCounts: Record<string, number> = {};
    let rarestTier: RarityTier = "common";
    const rarityOrder: RarityTier[] = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
    ];

    for (const item of history) {
      const classKey = `${item.train.class}::${item.train.operator}`;
      uniqueClasses.add(classKey);

      const tier = item.rarity?.tier || "common";
      rarityBreakdown[tier]++;

      if (rarityOrder.indexOf(tier) > rarityOrder.indexOf(rarestTier)) {
        rarestTier = tier;
      }

      const op = item.train.operator;
      operatorCounts[op] = (operatorCounts[op] || 0) + 1;
    }

    // Find favourite operator
    let favouriteOperator = "None yet";
    let maxOpCount = 0;
    for (const [op, count] of Object.entries(operatorCounts)) {
      if (count > maxOpCount) {
        favouriteOperator = op;
        maxOpCount = count;
      }
    }

    return {
      totalSpots: history.length,
      uniqueClasses: uniqueClasses.size,
      rarityBreakdown,
      rarestTier,
      favouriteOperator,
    };
  }, [history]);

  const xp = profile?.xp ?? stats.totalSpots * 10;
  const levelInfo = getLevel(xp);
  const xpProgress = levelInfo.next
    ? (xp - levelInfo.current.minXp) /
      (levelInfo.next.minXp - levelInfo.current.minXp)
    : 1;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Your local collection will be kept on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account & Data",
      "This will permanently delete your account, collection, achievements, and all associated data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: () => {
            // Double-confirm for safety
            Alert.alert(
              "Are you sure?",
              "All your data will be permanently deleted. You will not be able to recover it.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      if (!user) return;
                      const { supabase } = require("../../config/supabase");

                      // Delete user data from all tables (cascading from profiles)
                      await supabase.from("spots").delete().eq("user_id", user.id);
                      await supabase.from("achievements").delete().eq("user_id", user.id);
                      await supabase.from("credit_transactions").delete().eq("user_id", user.id);
                      await supabase.from("subscription_events").delete().eq("user_id", user.id);
                      await supabase.from("profiles").delete().eq("id", user.id);

                      // Clear local storage
                      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
                      await AsyncStorage.clear();

                      // Sign out
                      await signOut();
                      router.replace("/sign-in");

                      Alert.alert("Account Deleted", "Your account and all data have been permanently deleted.");
                    } catch (error) {
                      Alert.alert("Error", "Could not delete account. Please contact support.");
                      console.error("Delete account error:", error);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* ── User header ──────────────────────────────────── */}
      <View style={styles.userHeader}>
        <View style={styles.avatarCircle}>
          <Ionicons
            name={levelInfo.current.icon as any}
            size={36}
            color={colors.accent}
          />
        </View>
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>
              {profile?.username || user?.email?.split("@")[0] || "Guest Spotter"}
            </Text>
            <TouchableOpacity onPress={handleOpenUsernameModal} style={styles.editUsernameBtn}>
              <Ionicons name="pencil" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userEmail}>
            {user?.email || ""}
          </Text>
          <TouchableOpacity
            onPress={handleOpenIdentityModal}
            style={styles.identityBadgeButton}
            accessibilityRole="button"
            accessibilityLabel={t("identityModal.title")}
          >
            {profile?.country_code || profile?.spotter_emoji ? (
              <IdentityBadge
                countryCode={profile?.country_code ?? null}
                emojiId={profile?.spotter_emoji ?? null}
                size="md"
              />
            ) : (
              <Text style={styles.identityBadgePlaceholder}>
                {t("identityModal.badgePlaceholder")}
              </Text>
            )}
            <Ionicons
              name="pencil"
              size={12}
              color={colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </View>
        {profile?.is_pro && (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>{t("profile.pro").toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* ── Level card ───────────────────────────────────── */}
      <View style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelName}>{levelInfo.current.name}</Text>
          <Text style={styles.levelNumber}>{t("profile.level", { number: levelInfo.index })}</Text>
        </View>
        <View style={styles.xpBarContainer}>
          <View
            style={[
              styles.xpBarFill,
              { width: `${Math.min(xpProgress * 100, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.xpText}>
          {xp} XP
          {levelInfo.next
            ? ` · ${levelInfo.next.minXp - xp} XP to ${levelInfo.next.name}`
            : " · Max level reached!"}
        </Text>
      </View>

      {/* ── Quick stats ──────────────────────────────────── */}
      <View style={styles.statsGrid}>
        <StatBox
          icon="camera"
          value={stats.totalSpots.toString()}
          label={t("profile.totalSpots")}
        />
        <StatBox
          icon="layers"
          value={stats.uniqueClasses.toString()}
          label="Unique Classes"
        />
        <StatBox
          icon="flame"
          value={(profile?.streak_current ?? 0).toString()}
          label={t("profile.streak")}
          accent={
            (profile?.streak_current ?? 0) >= 3 ? colors.accent : undefined
          }
        />
        <StatBox
          icon="diamond"
          value={getRarityLabel(stats.rarestTier)}
          label="Rarest Find"
          accent={rarityColors[stats.rarestTier]}
        />
      </View>

      {/* ── Favourite operator ────────────────────────────── */}
      <View style={styles.infoRow}>
        <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoLabel}>Favourite Operator</Text>
        <Text style={styles.infoValue}>{stats.favouriteOperator}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="trophy-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoLabel}>Best Streak</Text>
        <Text style={styles.infoValue}>
          {profile?.streak_best ?? 0} days
        </Text>
      </View>

      {/* ── Language toggle ──────────────────────────────── */}
      <TouchableOpacity style={styles.infoRow} onPress={handleLanguageToggle}>
        <Ionicons name="language-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoLabel}>{t("profile.language")}</Text>
        <Text style={styles.infoValue}>
          {language === "en" ? "English" : "Deutsch"}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* ── Region selector — gated on country_code, not UI language. A
            German user with English UI should not see London / South East /
            etc; a British user with German UI should. v1.0.23 shipped the
            language-based gate by mistake. */}
      {user && profile?.country_code === "GB" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Region</Text>
          <Text style={styles.regionHelpText}>
            Set your UK region to appear on regional leaderboards
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.regionChipRow}
          >
            {UK_REGIONS.map((region) => (
              <TouchableOpacity
                key={region.key}
                style={[
                  styles.regionChip,
                  profile?.region === region.key && styles.regionChipActive,
                ]}
                onPress={() => {
                  const newRegion =
                    profile?.region === region.key ? null : region.key;
                  updateRegion(newRegion);
                }}
              >
                <Text
                  style={[
                    styles.regionChipText,
                    profile?.region === region.key && styles.regionChipTextActive,
                  ]}
                >
                  {region.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Achievements ────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Text style={styles.sectionCount}>
            {unlockedAchievements.size}/{ACHIEVEMENT_DEFINITIONS.length}
          </Text>
        </View>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENT_DEFINITIONS.map((achievement) => {
            const isUnlocked = unlockedAchievements.has(achievement.type);
            return (
              <View
                key={achievement.type}
                style={[
                  styles.achievementCard,
                  !isUnlocked && styles.achievementLocked,
                ]}
              >
                <View
                  style={[
                    styles.achievementIcon,
                    {
                      backgroundColor: isUnlocked
                        ? achievement.color + "20"
                        : colors.surfaceLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={achievement.icon as any}
                    size={22}
                    color={isUnlocked ? achievement.color : colors.textMuted}
                  />
                </View>
                <Text
                  style={[
                    styles.achievementName,
                    !isUnlocked && styles.achievementNameLocked,
                  ]}
                  numberOfLines={1}
                >
                  {achievement.name}
                </Text>
                <Text
                  style={[
                    styles.achievementDesc,
                    !isUnlocked && styles.achievementDescLocked,
                  ]}
                  numberOfLines={2}
                >
                  {achievement.description}
                </Text>
                {isUnlocked && (
                  <View
                    style={[
                      styles.achievementBadge,
                      { backgroundColor: achievement.color },
                    ]}
                  >
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Rarity breakdown ─────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rarity Breakdown</Text>
        <View style={styles.rarityGrid}>
          {(
            ["legendary", "epic", "rare", "uncommon", "common"] as RarityTier[]
          ).map((tier) => (
            <View key={tier} style={styles.rarityRow}>
              <View
                style={[
                  styles.rarityDot,
                  { backgroundColor: rarityColors[tier] },
                ]}
              />
              <Text style={styles.rarityLabel}>{getRarityLabel(tier)}</Text>
              <Text
                style={[styles.rarityCount, { color: rarityColors[tier] }]}
              >
                {stats.rarityBreakdown[tier]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Actions ──────────────────────────────────────── */}
      <View style={styles.section}>
        {/* Upgrade to Pro (if not Pro) */}
        {!profile?.is_pro && (
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push("/paywall?source=profile")}>
            <Ionicons name="rocket" size={20} color="#fff" />
            <View style={styles.upgradeBtnContent}>
              <Text style={styles.upgradeBtnTitle}>{t("profile.upgradeToPro")}</Text>
              <Text style={styles.upgradeBtnSubtitle}>
                Unlimited scans · Premium blueprints · All styles
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="rgba(255,255,255,0.6)"
            />
          </TouchableOpacity>
        )}

        {/* Sign in / sign up — three-CTA pattern (Steph 2026-04-24).
            Returning users land here as "Guest Spotter" after a reinstall
            and need an explicit "Log In" path; new users need "Sign Up".
            Both routes go to /sign-in (single OTP flow) but with different
            mode params so the destination screen can show "Welcome back"
            vs "Create your account" copy. */}
        {!user && (
          <>
            <View style={styles.authCtaRow}>
              <TouchableOpacity
                style={[styles.authCtaBtn, styles.authCtaBtnPrimary]}
                onPress={() => router.push("/sign-in?mode=login")}
              >
                <Ionicons name="log-in-outline" size={18} color={colors.accent} />
                <Text style={styles.authCtaBtnTextPrimary}>Log In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authCtaBtn, styles.authCtaBtnSecondary]}
                onPress={() => router.push("/sign-in?mode=signup")}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.authCtaBtnTextSecondary}>Sign Up</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.authCtaSubtitle}>
              Cloud sync • Leaderboards • Streaks
            </Text>
          </>
        )}

        {/* Sign out (authenticated) */}
        {user && (
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
          </TouchableOpacity>
        )}

        {/* Delete account (authenticated) */}
        {user && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Account & Data</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── App info ─────────────────────────────────────── */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoText}>
          LocoSnap v{Application.nativeApplicationVersion ?? "—"}
        </Text>
        <Text style={styles.appInfoText}>AI-powered train identification</Text>
      </View>
    </ScrollView>

    {/* ── Username edit modal ──────────────────────────── */}
    <Modal
      visible={usernameModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setUsernameModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t("profile.usernameModal.title")}</Text>
          <Text style={styles.modalSubtitle}>
            {t("profile.usernameModal.subtitle")}
          </Text>
          <TextInput
            style={[styles.modalInput, usernameError ? styles.modalInputError : null]}
            value={usernameInput}
            onChangeText={(text) => {
              setUsernameInput(text);
              setUsernameError("");
            }}
            placeholder={t("profile.usernameModal.placeholder")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
          />
          {usernameError ? (
            <Text style={styles.modalError}>{usernameError}</Text>
          ) : null}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setUsernameModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t("profile.usernameModal.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, usernameSaving && styles.modalSaveBtnDisabled]}
              onPress={handleSaveUsername}
              disabled={usernameSaving}
            >
              {usernameSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>{t("profile.usernameModal.save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* ── Identity (flag + emoji) edit modal ───────────── */}
    <Modal
      visible={identityModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setIdentityModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.identityModalContent]}>
          <Text style={styles.modalTitle}>{t("identityModal.title")}</Text>
          <Text style={styles.modalSubtitle}>{t("identityModal.subtitle")}</Text>

          <Text style={styles.identitySectionLabel}>{t("identityModal.countryLabel")}</Text>
          <CountryFlagPicker
            mode="compact"
            selectedCode={draftCountry}
            onSelect={setDraftCountry}
          />

          <Text style={styles.identitySectionLabel}>{t("identityModal.emojiLabel")}</Text>
          <View style={styles.identityEmojiContainer}>
            <EmojiPicker
              selectedId={draftEmoji}
              isPro={profile?.is_pro ?? false}
              onSelect={setDraftEmoji}
              onProLockTapped={handleProLockTapped}
            />
          </View>

          {!session && (
            <TouchableOpacity
              style={styles.addAccountLink}
              onPress={() => {
                setIdentityModalVisible(false);
                router.push("/sign-in");
              }}
            >
              <Text style={styles.addAccountText}>
                {t("identityModal.addAccount")}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIdentityModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t("identityModal.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, identitySaving && styles.modalSaveBtnDisabled]}
              onPress={handleSaveIdentity}
              disabled={identitySaving}
            >
              {identitySaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>{t("identityModal.save")}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ── Stat box component ──────────────────────────────────────

function StatBox({
  icon,
  value,
  label,
  accent,
}: {
  icon: string;
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons
        name={icon as any}
        size={18}
        color={accent || colors.accent}
      />
      <Text
        style={[styles.statValue, accent ? { color: accent } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  // User header
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.accent,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  usernameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  username: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
  },
  editUsernameBtn: {
    marginLeft: 8,
    padding: 4,
  },
  userEmail: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  proBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 1,
  },

  // Level card
  levelCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  levelName: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  levelNumber: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
  },
  xpBarContainer: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  xpText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  infoValue: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },

  // Sections
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionCount: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
    marginBottom: spacing.md,
  },

  // Region selector
  regionHelpText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  regionChipRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  regionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regionChipActive: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    borderColor: colors.accent,
  },
  regionChipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textMuted,
  },
  regionChipTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },

  // Achievements
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  achievementCard: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
    overflow: "hidden",
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  achievementName: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  achievementNameLocked: {
    color: colors.textMuted,
  },
  achievementDesc: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  achievementDescLocked: {
    color: colors.textMuted,
  },
  achievementBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  // Rarity breakdown
  rarityGrid: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rarityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  rarityLabel: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  rarityCount: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },

  // Buttons
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  upgradeBtnContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  upgradeBtnTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },
  upgradeBtnSubtitle: {
    fontSize: fonts.sizes.xs,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  signInPrompt: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  signInPromptTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  signInPromptSubtitle: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  authCtaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  authCtaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  authCtaBtnPrimary: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
  },
  authCtaBtnSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  authCtaBtnTextPrimary: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },
  authCtaBtnTextSecondary: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  authCtaSubtitle: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  signOutText: {
    fontSize: fonts.sizes.md,
    color: colors.danger,
    fontWeight: fonts.weights.medium,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    fontWeight: fonts.weights.medium,
  },

  // App info
  appInfo: {
    alignItems: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  appInfoText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },

  // Username edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fonts.sizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  modalInputError: {
    borderColor: "#ef4444",
  },
  modalError: {
    fontSize: fonts.sizes.sm,
    color: "#ef4444",
    marginTop: 6,
  },
  modalButtons: {
    flexDirection: "row" as const,
    justifyContent: "flex-end",
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  modalCancelText: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    minWidth: 80,
    alignItems: "center" as const,
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },
  identityBadgeButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignSelf: "flex-start",
  },
  identityBadgePlaceholder: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
  },
  identityModalContent: {
    maxHeight: "85%",
    width: "92%",
  },
  identitySectionLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  identityEmojiContainer: {
    height: 220,
  },
  addAccountLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  addAccountText: {
    color: colors.primary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
});
