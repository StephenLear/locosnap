const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRequestReview = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockGetItem(k),
    setItem: (k: string, v: string) => mockSetItem(k, v),
  },
}));

jest.mock("expo-store-review", () => ({
  __esModule: true,
  requestReview: () => mockRequestReview(),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

import { maybePromptReview } from "../services/reviewPrompt";

describe("maybePromptReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
  });

  it("prompts on legendary trigger when no prior prompt exists", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      "last_review_prompt_at",
      expect.any(String)
    );
  });

  it("does NOT prompt if last prompt was within 90 days", async () => {
    const recent = Date.now() - 1000 * 60 * 60 * 24 * 30;
    mockGetItem.mockResolvedValue(String(recent));

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("DOES prompt if last prompt was 91+ days ago", async () => {
    const old = Date.now() - 1000 * 60 * 60 * 24 * 91;
    mockGetItem.mockResolvedValue(String(old));

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it("does NOT prompt if user has fewer than 3 scans", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 2 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("rejects non-allowed triggers", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "paywall_view" as any, scanCount: 100 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("accepts all four allowed triggers", async () => {
    const triggers = [
      "legendary_scan",
      "achievement_silver_gold",
      "streak_7d",
      "unique_classes_50",
    ] as const;

    for (const trigger of triggers) {
      mockSetItem.mockClear();
      mockRequestReview.mockClear();
      mockGetItem.mockResolvedValue(null);

      await maybePromptReview({ trigger, scanCount: 10 });

      expect(mockRequestReview).toHaveBeenCalledTimes(1);
    }
  });

  it("does not prompt if expo-store-review is unavailable", async () => {
    mockGetItem.mockResolvedValue(null);
    mockIsAvailableAsync.mockResolvedValue(false);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});
