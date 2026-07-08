export interface ThrottleRetryOptions {
  minDelayMs?: number;
  retryDelaysMs?: readonly number[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type ThrottledRetry = <T>(operation: () => Promise<T>) => Promise<T>;

const DEFAULT_MIN_DELAY_MS = 700;
const DEFAULT_RETRY_DELAYS_MS = [1000, 3000] as const;

export const runWithThrottleAndRetry = createThrottledRetry();

export function createThrottledRetry(options: ThrottleRetryOptions = {}): ThrottledRetry {
  const minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  let previous = Promise.resolve();
  let lastStartedAt: number | null = null;

  return async function throttledRetry<T>(operation: () => Promise<T>): Promise<T> {
    const runAfterPrevious = previous.catch(() => undefined);
    let release: () => void = () => undefined;
    previous = runAfterPrevious.then(() => new Promise<void>((resolve) => {
      release = resolve;
    }));

    await runAfterPrevious;

    try {
      for (let attempt = 0; ; attempt += 1) {
        if (lastStartedAt !== null) {
          const waitMs = minDelayMs - (now() - lastStartedAt);
          if (waitMs > 0) {
            await sleep(waitMs);
          }
        }

        lastStartedAt = now();

        try {
          return await operation();
        } catch (error) {
          if (!shouldRetry(error) || attempt >= retryDelaysMs.length) {
            throw normalizeError(error);
          }

          await sleep(retryDelaysMs[attempt]);
        }
      }
    } finally {
      release();
    }
  };
}

export function shouldRetry(error: unknown): boolean {
  const status = statusFromError(error);

  if (status === undefined) {
    return isNetworkError(error);
  }

  if (isCloudflareBlock(error)) {
    return false;
  }

  return status === 429 || status >= 500;
}

export function normalizeError(error: unknown): Error {
  if (isCloudflareBlock(error)) {
    return new Error("tutti.ch is rate-limiting this client; wait a few minutes");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function statusFromError(error: unknown): number | undefined {
  return isRecord(error) && typeof error.status === "number" ? error.status : undefined;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TuttiNetworkError" || error.name === "TypeError");
}

function isCloudflareBlock(error: unknown): boolean {
  if (!isRecord(error) || error.status !== 403 || typeof error.body !== "string") {
    return false;
  }

  return /<html|<!doctype html/i.test(error.body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
