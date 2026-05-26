import {
  localisePushBody,
  buildExpoPushMessage,
  isSendable,
  ACCOUNT_AGE_THRESHOLD_DAYS,
  RESEND_COOLDOWN_DAYS,
  EXPO_PUSH_URL,
  runZeroEngagementRescuePush,
  type CandidateRow,
} from "../../cron/zeroEngagementRescuePush";

describe("localisePushBody", () => {
  it("returns EN copy by default", () => {
    expect(localisePushBody(null)).toEqual({
      title: "You have Pro",
      body: "Now scan your first train.",
    });
    expect(localisePushBody("en")).toEqual({
      title: "You have Pro",
      body: "Now scan your first train.",
    });
  });

  it("returns DE copy for German", () => {
    expect(localisePushBody("de")).toEqual({
      title: "Du hast Pro",
      body: "Jetzt scannst du den ersten Zug.",
    });
  });

  it("returns PL copy for Polish", () => {
    expect(localisePushBody("pl")).toEqual({
      title: "Masz Pro",
      body: "Czas zeskanować pierwszy pociąg.",
    });
  });

  it("normalises regional locales to base tag (de-AT → de)", () => {
    expect(localisePushBody("de-AT")).toEqual({
      title: "Du hast Pro",
      body: "Jetzt scannst du den ersten Zug.",
    });
    expect(localisePushBody("en-GB").title).toBe("You have Pro");
  });

  it("falls back to EN for unknown languages", () => {
    expect(localisePushBody("xx").title).toBe("You have Pro");
    expect(localisePushBody("").title).toBe("You have Pro");
  });
});

describe("buildExpoPushMessage", () => {
  it("composes the canonical Expo envelope", () => {
    const out = buildExpoPushMessage("ExponentPushToken[abc]", {
      title: "T",
      body: "B",
    });
    expect(out).toEqual({
      to: "ExponentPushToken[abc]",
      title: "T",
      body: "B",
      sound: "default",
      priority: "default",
      channelId: "default",
    });
  });
});

describe("isSendable", () => {
  it("accepts ExponentPushToken tokens", () => {
    expect(
      isSendable({
        id: "u1",
        language: "en",
        push_token: "ExponentPushToken[abc]",
      })
    ).toBe(true);
  });

  it("accepts ExpoPushToken tokens (newer format)", () => {
    expect(
      isSendable({
        id: "u1",
        language: "en",
        push_token: "ExpoPushToken[xyz]",
      })
    ).toBe(true);
  });

  it("rejects missing tokens", () => {
    expect(
      isSendable({ id: "u1", language: "en", push_token: null })
    ).toBe(false);
  });

  it("rejects garbage tokens (FCM string, empty, gibberish)", () => {
    expect(
      isSendable({ id: "u1", language: "en", push_token: "" })
    ).toBe(false);
    expect(
      isSendable({ id: "u1", language: "en", push_token: "abc123" })
    ).toBe(false);
    expect(
      isSendable({
        id: "u1",
        language: "en",
        push_token: "fcm-token-not-expo",
      })
    ).toBe(false);
  });
});

describe("runZeroEngagementRescuePush — orchestrator", () => {
  const NOW = new Date("2026-05-26T09:00:00Z");

  // Minimal supabase mock factory. Each test wires its own
  // candidates list + update behaviour.
  function makeSupabase({
    candidates,
    queryError = null,
    updateError = null,
  }: {
    candidates: CandidateRow[];
    queryError?: { message: string } | null;
    updateError?: { message: string } | null;
  }) {
    const updateCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const builder = {
      _filters: {} as Record<string, unknown>,
      select() {
        return this;
      },
      eq(col: string, val: unknown) {
        this._filters[col] = val;
        return this;
      },
      is(col: string, val: unknown) {
        this._filters[col] = val;
        return this;
      },
      lt(col: string, val: unknown) {
        this._filters[`${col}_lt`] = val;
        return this;
      },
      or(_clause: string) {
        return this;
      },
      limit(_n: number) {
        return Promise.resolve({
          data: queryError ? null : candidates,
          error: queryError,
        });
      },
      update(patch: Record<string, unknown>) {
        const u = {
          _id: "",
          eq(_col: string, val: string) {
            updateCalls.push({ id: val, patch });
            return Promise.resolve({ error: updateError });
          },
        };
        return u;
      },
    };

    const supabase = {
      from(_table: string) {
        return builder;
      },
    } as any;

    return { supabase, updateCalls };
  }

  function makeFetch(
    response: { ok: boolean; status?: number; json?: any }
  ) {
    return jest.fn(async () => ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.json ?? { data: { status: "ok" } },
    })) as unknown as typeof fetch;
  }

  it("returns empty completed when no candidates", async () => {
    const { supabase } = makeSupabase({ candidates: [] });
    const fetchMock = makeFetch({ ok: true });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toEqual({
      status: "completed",
      candidates: 0,
      sent: 0,
      failed: 0,
      skippedNoToken: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns skipped on query failure", async () => {
    const { supabase } = makeSupabase({
      candidates: [],
      queryError: { message: "permission denied" },
    });
    const out = await runZeroEngagementRescuePush(
      supabase,
      NOW,
      makeFetch({ ok: true })
    );
    expect(out).toEqual({
      status: "skipped",
      reason: "query_failed: permission denied",
    });
  });

  it("sends to candidates with valid tokens and stamps engagement_push_sent_at", async () => {
    const { supabase, updateCalls } = makeSupabase({
      candidates: [
        { id: "u1", language: "de", push_token: "ExponentPushToken[a]" },
        { id: "u2", language: "pl", push_token: "ExponentPushToken[b]" },
      ],
    });
    const fetchMock = makeFetch({ ok: true });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({
      status: "completed",
      candidates: 2,
      sent: 2,
      failed: 0,
      skippedNoToken: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].patch.engagement_push_sent_at).toBe(
      NOW.toISOString()
    );
    expect(updateCalls.map((u) => u.id).sort()).toEqual(["u1", "u2"]);
  });

  it("skips candidates with missing or garbage push tokens", async () => {
    const { supabase, updateCalls } = makeSupabase({
      candidates: [
        { id: "u1", language: "en", push_token: null },
        { id: "u2", language: "en", push_token: "fcm-garbage" },
        { id: "u3", language: "en", push_token: "ExponentPushToken[good]" },
      ],
    });
    const fetchMock = makeFetch({ ok: true });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({
      candidates: 3,
      sent: 1,
      failed: 0,
      skippedNoToken: 2,
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe("u3");
  });

  it("counts HTTP failures as failed (no stamp update)", async () => {
    const { supabase, updateCalls } = makeSupabase({
      candidates: [
        { id: "u1", language: "en", push_token: "ExponentPushToken[a]" },
      ],
    });
    const fetchMock = makeFetch({ ok: false, status: 503 });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({ sent: 0, failed: 1 });
    expect(updateCalls).toHaveLength(0);
  });

  it("counts Expo ticket-level non-ok as failed", async () => {
    const { supabase, updateCalls } = makeSupabase({
      candidates: [
        { id: "u1", language: "en", push_token: "ExponentPushToken[a]" },
      ],
    });
    const fetchMock = makeFetch({
      ok: true,
      json: { data: { status: "DeviceNotRegistered", message: "gone" } },
    });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({ sent: 0, failed: 1 });
    expect(updateCalls).toHaveLength(0);
  });

  it("survives an update error — push still counted as sent", async () => {
    const { supabase } = makeSupabase({
      candidates: [
        { id: "u1", language: "en", push_token: "ExponentPushToken[a]" },
      ],
      updateError: { message: "transient db blip" },
    });
    const fetchMock = makeFetch({ ok: true });
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({ sent: 1, failed: 0 });
  });

  it("survives a fetch throw — counted as failed", async () => {
    const { supabase, updateCalls } = makeSupabase({
      candidates: [
        { id: "u1", language: "en", push_token: "ExponentPushToken[a]" },
      ],
    });
    const fetchMock = jest.fn(async () => {
      throw new Error("network unreachable");
    }) as unknown as typeof fetch;
    const out = await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(out).toMatchObject({ sent: 0, failed: 1 });
    expect(updateCalls).toHaveLength(0);
  });

  it("posts to the canonical Expo endpoint with JSON body", async () => {
    const { supabase } = makeSupabase({
      candidates: [
        { id: "u1", language: "de", push_token: "ExponentPushToken[a]" },
      ],
    });
    const fetchMock = makeFetch({ ok: true });
    await runZeroEngagementRescuePush(supabase, NOW, fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      EXPO_PUSH_URL,
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      })
    );
    const callBody = JSON.parse(
      (fetchMock as jest.Mock).mock.calls[0][1].body as string
    );
    expect(callBody.to).toBe("ExponentPushToken[a]");
    expect(callBody.title).toBe("Du hast Pro");
  });
});

describe("constants — sanity checks", () => {
  it("uses sensible day thresholds", () => {
    expect(ACCOUNT_AGE_THRESHOLD_DAYS).toBeGreaterThan(0);
    expect(RESEND_COOLDOWN_DAYS).toBeGreaterThanOrEqual(
      ACCOUNT_AGE_THRESHOLD_DAYS
    );
  });
});
