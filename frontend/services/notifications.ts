// ============================================================
// LocoSnap — Push Notification Service
// Handles local notifications (blueprint ready, streak reminders)
// and registers push tokens for future server-sent notifications.
// ============================================================

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "../config/supabase";

// ── Permission + token registration ──────────────────────

export async function registerForPushNotifications(
  userId?: string
): Promise<string | null> {
  // Wrap the entire function — notification setup must never crash the app.
  // On some Samsung/Android devices getExpoPushTokenAsync throws a native error
  // that bypasses JS catch blocks if not wrapped at the top level.
  try {
    // Only real devices can receive push notifications
    if (!Device.isDevice) {
      console.log("[NOTIFICATIONS] Must use physical device for push");
      return null;
    }

    // Configure notification handling (must be inside lifecycle, not module scope)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[NOTIFICATIONS] Permission not granted");
      return null;
    }

    // Android notification channel
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "LocoSnap",
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF6B00",
        });
      } catch (channelError) {
        console.warn("[NOTIFICATIONS] Failed to set Android channel:", channelError);
        // Non-fatal — continue without channel
      }
    }

    // Get the push token
    // Android: skip FCM token fetch — getExpoPushTokenAsync triggers a native
    // crash on Android 16 (Samsung) via FCM JNI. Push tokens are not yet used
    // server-side, so this is safe to skip until Expo SDK is upgraded.
    if (Platform.OS === "android") {
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "84584853-524a-44eb-bdad-3d57e1e4ea28",
      });
      const token = tokenData.data;

      // Save token to user's profile (for future server-sent notifications)
      if (userId) {
        await savePushToken(userId, token);
      }

      return token;
    } catch (tokenError) {
      console.warn("[NOTIFICATIONS] Failed to get push token:", tokenError);
      return null;
    }
  } catch (error) {
    // Top-level catch — ensures notification failures can never crash the app
    console.warn("[NOTIFICATIONS] registerForPushNotifications failed silently:", error);
    return null;
  }
}

async function savePushToken(userId: string, token: string) {
  try {
    await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);
  } catch {
    // push_token column may not exist yet — silently ignore
    console.log("[NOTIFICATIONS] Could not save push token (column may not exist)");
  }
}

// ── Local notification: Blueprint ready ──────────────────

export async function notifyBlueprintReady(trainClass: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Blueprint Ready! 🎨",
      body: `Your ${trainClass} technical blueprint has been generated. Tap to view it.`,
      data: { type: "blueprint_ready", trainClass },
      sound: "default",
    },
    trigger: null, // Immediate
  });
}

// ── Local notification: Streak reminder ──────────────────

export async function scheduleStreakReminder() {
  // Cancel any existing streak reminders first
  await cancelStreakReminder();

  // Schedule daily at 7pm local time
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't lose your streak! 🔥",
      body: "You haven't spotted a train today. Open LocoSnap to keep your streak alive!",
      data: { type: "streak_reminder" },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 0,
    },
  });
}

export async function cancelStreakReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === "streak_reminder") {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }
}

// ── Local notification: Achievement unlocked ─────────────

export async function notifyAchievementUnlocked(
  achievementName: string,
  achievementDescription: string
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Achievement Unlocked! 🏆`,
      body: `${achievementName} — ${achievementDescription}`,
      data: { type: "achievement", achievementName },
      sound: "default",
    },
    trigger: null, // Immediate
  });
}
