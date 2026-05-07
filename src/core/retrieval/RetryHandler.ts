import pRetry, { AbortError } from 'p-retry';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: boolean;
  retryableErrors: string[];
}

const RETRYABLE_ERROR_CODES = [
  'REQUEST_LIMIT_EXCEEDED',
  'UNABLE_TO_LOCK_ROW',
  'TIMEOUT',
  'INVALID_QUERY_LOCATOR',
  'SERVER_UNAVAILABLE',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
];

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30_000,
  factor: 2,
  jitter: true,
  retryableErrors: RETRYABLE_ERROR_CODES,
};

function isRetryable(err: unknown, retryableErrors: string[]): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const code = String(e['errorCode'] ?? e['code'] ?? e['name'] ?? '');
  const message = String(e['message'] ?? '');

  for (const retryableCode of retryableErrors) {
    if (code.includes(retryableCode) || message.includes(retryableCode)) return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };

  return pRetry(fn, {
    retries: opts.maxRetries,
    minTimeout: opts.initialDelayMs,
    maxTimeout: opts.maxDelayMs,
    factor: opts.factor,
    randomize: opts.jitter,
    onFailedAttempt: (err) => {
      if (!isRetryable(err, opts.retryableErrors)) {
        throw new AbortError(err.message);
      }
    },
  });
}
