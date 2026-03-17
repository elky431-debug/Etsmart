export interface RetryOptions {
  retries: number;
  delayMs: number;
  factor?: number;
  onRetry?: (attempt: number, error: unknown) => void;
  shouldRetry?: (attempt: number, error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const maxAttempts = Math.max(1, options.retries);
  const factor = options.factor ?? 1.5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      if (options.shouldRetry && !options.shouldRetry(attempt, error)) break;
      options.onRetry?.(attempt, error);
      const waitMs = Math.round(options.delayMs * Math.pow(factor, attempt - 1));
      await sleep(waitMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
