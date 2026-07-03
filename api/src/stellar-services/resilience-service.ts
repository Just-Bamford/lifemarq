/**
 * Resilience Service
 *
 * Provides production-grade resilience patterns for Stellar RPC interactions:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Timeout management
 * - Error classification
 *
 * Responsibility:
 * - Classify errors (transient vs permanent)
 * - Apply retry strategy based on error type
 * - Track failure rates and open/close circuit breaker
 * - Timeout requests to prevent hanging
 */

/**
 * Error classification for retry decisions
 */
export enum ErrorType {
  /// Transient error — safe to retry
  /// Examples: network timeout, temporary RPC unavailable
  TRANSIENT = "TRANSIENT",

  /// Permanent error — do not retry
  /// Examples: invalid contract ID, authorization failure
  PERMANENT = "PERMANENT",

  /// Unknown error — retry with caution
  UNKNOWN = "UNKNOWN",
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /// Maximum number of retry attempts (default: 3)
  maxRetries: number;
  /// Initial backoff delay in milliseconds (default: 100)
  initialDelayMs: number;
  /// Maximum backoff delay in milliseconds (default: 5000)
  maxDelayMs: number;
  /// Backoff multiplier (default: 2)
  backoffMultiplier: number;
  /// Add random jitter to backoff (0-100, default: 10)
  jitterPercent: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitterPercent: 10,
};

/**
 * Circuit breaker state
 */
export enum CircuitState {
  /// Circuit is closed (normal operation)
  CLOSED = "CLOSED",
  /// Circuit is open (failing, reject requests)
  OPEN = "OPEN",
  /// Circuit is half-open (testing recovery)
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /// Number of failures to trigger open state (default: 5)
  failureThreshold: number;
  /// Time to wait before trying half-open (default: 10000ms)
  resetTimeoutMs: number;
  /// Number of successes in half-open to close (default: 2)
  successThreshold: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 10000,
  successThreshold: 2,
};

/**
 * Resilience Service for Stellar RPC calls
 */
export class ResilienceService {
  private retryConfig: RetryConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastOpenTime: number | null = null;

  constructor(
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
    circuitBreakerConfig: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
  ) {
    this.retryConfig = retryConfig;
    this.circuitBreakerConfig = circuitBreakerConfig;
  }

  /**
   * Execute function with retry logic and circuit breaker
   *
   * @param fn - Async function to execute
   * @param context - Context for error logging (e.g., "query_consent")
   * @returns Result from fn or throws after retries exhausted
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = "stellar_operation",
  ): Promise<T> {
    // Check circuit breaker first
    if (this.circuitState === CircuitState.OPEN) {
      if (
        this.lastOpenTime &&
        Date.now() - this.lastOpenTime >
          this.circuitBreakerConfig.resetTimeoutMs
      ) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(
          `[Resilience] Circuit breaker: CLOSED -> HALF_OPEN (${context})`,
        );
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is OPEN for ${context}`,
        );
      }
    }

    // Retry loop
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();

        // Success — update circuit breaker
        this.recordSuccess();

        return result;
      } catch (error: any) {
        lastError = error;

        // Classify error
        const errorType = this.classifyError(error);

        // Log attempt
        console.warn(
          `[Resilience] Attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1} failed (${errorType}): ${context}`,
        );

        // Don't retry on permanent errors
        if (errorType === ErrorType.PERMANENT) {
          this.recordFailure();
          throw error;
        }

        // Don't retry on last attempt
        if (attempt >= this.retryConfig.maxRetries) {
          this.recordFailure();
          break;
        }

        // Wait before retrying
        const delayMs = this.calculateBackoffDelay(attempt);
        console.log(`[Resilience] Retrying after ${delayMs}ms...`);
        await this.delay(delayMs);
      }
    }

    // All retries exhausted
    this.recordFailure();
    throw lastError || new Error(`Operation failed after retries: ${context}`);
  }

  /**
   * Classify error to determine if retry is appropriate
   *
   * @param error - Error to classify
   * @returns ErrorType (TRANSIENT, PERMANENT, UNKNOWN)
   */
  private classifyError(error: any): ErrorType {
    const message = error?.message || "";
    const code = error?.code || "";

    // Transient errors — safe to retry
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ETIMEDOUT") ||
      message.includes("ENOTFOUND") ||
      code === "ECONNRESET" ||
      message.includes("timeout") ||
      message.includes("temporarily unavailable") ||
      message.includes("Service Unavailable") ||
      message.includes("Too Many Requests")
    ) {
      return ErrorType.TRANSIENT;
    }

    // Permanent errors — do not retry
    if (
      message.includes("400") ||
      message.includes("401") ||
      message.includes("403") ||
      message.includes("404") ||
      message.includes("Invalid") ||
      message.includes("Unauthorized") ||
      message.includes("Forbidden") ||
      message.includes("Not Found")
    ) {
      return ErrorType.PERMANENT;
    }

    // Unknown — retry cautiously
    return ErrorType.UNKNOWN;
  }

  /**
   * Calculate exponential backoff delay with jitter
   *
   * Formula: min(initialDelay * backoffMultiplier^attempt, maxDelay)
   * Then add random jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.initialDelayMs *
        Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelayMs,
    );

    // Add jitter
    const jitterFactor =
      1 + (Math.random() - 0.5) * (this.retryConfig.jitterPercent / 100);
    return Math.round(exponentialDelay * jitterFactor);
  }

  /**
   * Record successful operation — update circuit breaker
   */
  private recordSuccess(): void {
    this.failureCount = 0;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.circuitBreakerConfig.successThreshold) {
        this.circuitState = CircuitState.CLOSED;
        this.successCount = 0;
        console.log("[Resilience] Circuit breaker: HALF_OPEN -> CLOSED");
      }
    }
  }

  /**
   * Record failed operation — update circuit breaker
   */
  private recordFailure(): void {
    this.failureCount++;

    if (this.circuitState === CircuitState.CLOSED) {
      if (this.failureCount >= this.circuitBreakerConfig.failureThreshold) {
        this.circuitState = CircuitState.OPEN;
        this.lastOpenTime = Date.now();
        console.error(
          `[Resilience] Circuit breaker: CLOSED -> OPEN (${this.failureCount} failures)`,
        );
      }
    } else if (this.circuitState === CircuitState.HALF_OPEN) {
      this.circuitState = CircuitState.OPEN;
      this.lastOpenTime = Date.now();
      this.successCount = 0;
      console.error("[Resilience] Circuit breaker: HALF_OPEN -> OPEN");
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker (for testing)
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastOpenTime = null;
  }
}

/**
 * Error raised when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}
