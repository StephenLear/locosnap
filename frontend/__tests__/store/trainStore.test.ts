// Mock all deep dependencies before importing trainStore
// These modules import native RN modules that aren't available in Node

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-file-system", () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: "base64" },
}));

jest.mock("base64-arraybuffer", () => ({
  decode: jest.fn(),
}));

jest.mock("../../config/supabase", () => ({
  supabase: null,
}));

jest.mock("../../services/supabase", () => ({
  upsertTrain: jest.fn(),
  saveSpot: jest.fn(),
  fetchSpots: jest.fn().mockResolvedValue([]),
  uploadPhoto: jest.fn(),
  uploadBlueprint: jest.fn(),
  updateSpotBlueprint: jest.fn(),
  awardXp: jest.fn(),
  calculateXp: jest.fn().mockReturnValue(10),
  updateStreak: jest.fn(),
  checkAndUnlockAchievements: jest.fn().mockResolvedValue([]),
  fetchAchievements: jest.fn().mockResolvedValue([]),
}));

jest.mock("../../services/notifications", () => ({
  notifyBlueprintReady: jest.fn().mockResolvedValue(undefined),
  notifyAchievementUnlocked: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/analytics", () => ({
  track: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureError: jest.fn(),
}));

jest.mock("../../store/authStore", () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({ user: null }),
  },
}));

import { useTrainStore } from "../../store/trainStore";

// Reset store between tests
beforeEach(() => {
  useTrainStore.setState({
    isScanning: false,
    scanError: null,
    currentTrain: null,
    currentSpecs: null,
    currentFacts: null,
    currentRarity: null,
    blueprintStatus: null,
    history: [],
    historyLoaded: false,
    currentSpotId: null,
    isSyncing: false,
    currentPhotoUri: null,
    currentLocation: null,
    selectedBlueprintStyle: "technical",
    compareItems: null,
  });
});

const mockTrain = {
  class: "Class 390",
  name: "Pendolino",
  operator: "Avanti West Coast",
  type: "EMU" as const,
  designation: "Bo-Bo",
  yearBuilt: 2001,
  confidence: 92,
  color: "Dark grey",
  description: "Tilting EMU",
};

const mockSpecs = {
  maxSpeed: "125 mph",
  power: "5,100 kW",
  weight: null,
  length: null,
  gauge: null,
  builder: null,
  numberBuilt: null,
  numberSurviving: null,
  status: null,
  route: null,
  fuelType: null,
};

const mockFacts = {
  summary: "A tilting train.",
  historicalSignificance: null,
  funFacts: [],
  notableEvents: [],
};

const mockRarity = {
  tier: "common" as const,
  reason: "Large fleet",
  productionCount: 56,
  survivingCount: 56,
};

describe("trainStore", () => {
  it("has correct initial state", () => {
    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(false);
    expect(state.scanError).toBeNull();
    expect(state.currentTrain).toBeNull();
    expect(state.history).toEqual([]);
    expect(state.selectedBlueprintStyle).toBe("technical");
  });

  it("startScan sets scanning state", () => {
    useTrainStore.getState().startScan();
    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(true);
    expect(state.scanError).toBeNull();
    expect(state.currentTrain).toBeNull();
  });

  it("setScanResults stores train data", () => {
    useTrainStore.getState().setScanResults(mockTrain, mockSpecs, mockFacts, mockRarity);
    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(false);
    expect(state.currentTrain?.class).toBe("Class 390");
    expect(state.currentSpecs?.maxSpeed).toBe("125 mph");
    expect(state.currentRarity?.tier).toBe("common");
  });

  it("setScanError clears scanning and stores error", () => {
    useTrainStore.getState().startScan();
    useTrainStore.getState().setScanError("Network error");
    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(false);
    expect(state.scanError).toBe("Network error");
  });

  it("setBlueprintStatus updates status", () => {
    useTrainStore.getState().setBlueprintStatus({
      taskId: "task-1",
      status: "queued",
      imageUrl: null,
      error: null,
    });
    expect(useTrainStore.getState().blueprintStatus?.status).toBe("queued");
  });

  it("setPhotoUri stores the URI", () => {
    useTrainStore.getState().setPhotoUri("file:///photo.jpg");
    expect(useTrainStore.getState().currentPhotoUri).toBe("file:///photo.jpg");
  });

  it("setLocation stores coordinates", () => {
    useTrainStore.getState().setLocation({ latitude: 51.5, longitude: -0.12 });
    expect(useTrainStore.getState().currentLocation?.latitude).toBe(51.5);
  });

  it("clearCurrentScan resets scan state", () => {
    useTrainStore.getState().setScanResults(mockTrain, mockSpecs, mockFacts, mockRarity);
    useTrainStore.getState().clearCurrentScan();
    const state = useTrainStore.getState();
    expect(state.currentTrain).toBeNull();
    expect(state.currentSpecs).toBeNull();
    expect(state.blueprintStatus).toBeNull();
  });

  it("setBlueprintStyle updates style", () => {
    useTrainStore.getState().setBlueprintStyle("vintage");
    expect(useTrainStore.getState().selectedBlueprintStyle).toBe("vintage");
  });

  it("setCompareItems stores two items", () => {
    const item1 = { id: "1", train: mockTrain, specs: mockSpecs, facts: mockFacts, rarity: mockRarity, blueprintUrl: null, scannedAt: new Date().toISOString() };
    const item2 = { ...item1, id: "2" };
    useTrainStore.getState().setCompareItems([item1 as any, item2 as any]);
    expect(useTrainStore.getState().compareItems).toHaveLength(2);
  });

  it("setCompareItems can be cleared with null", () => {
    useTrainStore.getState().setCompareItems(null);
    expect(useTrainStore.getState().compareItems).toBeNull();
  });
});
