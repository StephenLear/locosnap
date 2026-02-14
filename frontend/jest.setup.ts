// ============================================================
// LocoSnap Frontend — Jest Setup
// Global mocks for React Native + Expo modules
// ============================================================

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: "Stack.Screen",
  },
  Tabs: {
    Screen: "Tabs.Screen",
  },
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock expo-camera
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

// Mock react-native-purchases
jest.mock("react-native-purchases", () => ({
  Purchases: {
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    getCustomerInfo: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

// Mock analytics
jest.mock("./services/analytics", () => ({
  track: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureError: jest.fn(),
  initAnalytics: jest.fn(),
}));

// Mock notifications
jest.mock("./services/notifications", () => ({
  notifyBlueprintReady: jest.fn().mockResolvedValue(undefined),
  notifyAchievementUnlocked: jest.fn().mockResolvedValue(undefined),
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// Mock Supabase service
jest.mock("./services/supabase", () => ({
  upsertTrain: jest.fn().mockResolvedValue("train-id"),
  saveSpot: jest.fn().mockResolvedValue("spot-id"),
  fetchSpots: jest.fn().mockResolvedValue([]),
  uploadPhoto: jest.fn().mockResolvedValue("https://example.com/photo.jpg"),
  uploadBlueprint: jest.fn().mockResolvedValue("https://example.com/bp.png"),
  updateSpotBlueprint: jest.fn(),
  awardXp: jest.fn().mockResolvedValue({ xp: 10, level: 1 }),
  calculateXp: jest.fn().mockReturnValue(10),
  updateStreak: jest.fn().mockResolvedValue({ current: 1 }),
  checkAndUnlockAchievements: jest.fn().mockResolvedValue([]),
  fetchAchievements: jest.fn().mockResolvedValue([]),
}));
