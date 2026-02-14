// Mock PostHog
const mockCapture = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);
jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    flush: mockFlush,
  })),
}));

// Mock Sentry
jest.mock("@sentry/node", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((cb: any) => cb({ setExtras: jest.fn() })),
  flush: jest.fn().mockResolvedValue(true),
  setupExpressErrorHandler: jest.fn(),
}));

jest.mock("../../config/env", () => ({
  config: {
    posthogApiKey: "test-ph-key",
    posthogHost: "https://test.posthog.com",
    sentryDsn: "https://test@sentry.io/123",
    nodeEnv: "test",
    hasPostHog: true,
    hasSentry: true,
  },
}));

import {
  initAnalytics,
  trackServerEvent,
  captureServerError,
} from "../../services/analytics";
import * as Sentry from "@sentry/node";

describe("analytics", () => {
  beforeAll(() => {
    initAnalytics();
  });

  beforeEach(() => jest.clearAllMocks());

  it("trackServerEvent calls posthog.capture", () => {
    trackServerEvent("test_event", "user-123", { foo: "bar" });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "test_event",
      properties: { foo: "bar" },
    });
  });

  it("captureServerError calls Sentry", () => {
    const error = new Error("test error");
    captureServerError(error, { context: "test" });
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("trackServerEvent does not throw if posthog is unavailable", () => {
    expect(() => {
      trackServerEvent("safe_event", "user-456");
    }).not.toThrow();
  });
});
