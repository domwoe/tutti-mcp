import { describe, expect, it } from "vitest";
import { createThrottledRetry, normalizeError, shouldRetry } from "./throttle.js";

describe("createThrottledRetry", () => {
  it("serializes calls and enforces the minimum delay between starts", async () => {
    let time = 0;
    const sleeps: number[] = [];
    const starts: string[] = [];
    const run = createThrottledRetry({
      minDelayMs: 700,
      retryDelaysMs: [],
      now: () => time,
      sleep: async (ms) => {
        sleeps.push(ms);
        time += ms;
      }
    });

    await Promise.all([
      run(async () => {
        starts.push("first");
        return "first";
      }),
      run(async () => {
        starts.push("second");
        return "second";
      })
    ]);

    expect(starts).toEqual(["first", "second"]);
    expect(sleeps).toEqual([700]);
  });

  it("retries 429 responses with configured backoff", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    const run = createThrottledRetry({
      minDelayMs: 0,
      retryDelaysMs: [1000, 3000],
      sleep: async (ms) => {
        sleeps.push(ms);
      }
    });

    await expect(
      run(async () => {
        attempts += 1;
        if (attempts < 3) {
          throw httpError(429);
        }
        return "ok";
      })
    ).resolves.toBe("ok");

    expect(attempts).toBe(3);
    expect(sleeps).toEqual([1000, 3000]);
  });

  it("does not retry ordinary 4xx responses", async () => {
    let attempts = 0;
    const run = createThrottledRetry({
      minDelayMs: 0,
      retryDelaysMs: [1000],
      sleep: async () => undefined
    });

    await expect(
      run(async () => {
        attempts += 1;
        throw httpError(404);
      })
    ).rejects.toMatchObject({ status: 404 });

    expect(attempts).toBe(1);
  });
});

describe("retry classification", () => {
  it("retries network errors and 5xx responses", () => {
    const network = new Error("fetch failed");
    network.name = "TuttiNetworkError";

    expect(shouldRetry(network)).toBe(true);
    expect(shouldRetry(httpError(503))).toBe(true);
  });

  it("normalizes Cloudflare HTML 403 blocks", () => {
    const error = httpError(403, "<!DOCTYPE html><html><title>Forbidden</title>");

    expect(shouldRetry(error)).toBe(false);
    expect(normalizeError(error).message).toBe("tutti.ch is rate-limiting this client; wait a few minutes");
  });
});

function httpError(status: number, body = "plain error"): Error & { status: number; body: string } {
  return Object.assign(new Error(`HTTP ${status}`), { status, body });
}
