import crypto from "crypto";

/**
 * Consent Hash Generation Utilities
 *
 * Ensures deterministic, consistent hashing of donor identifiers across
 * frontend and backend. All donor hashes must be generated using these utilities
 * to guarantee consistency in the state machine.
 *
 * Domain Invariant:
 * hash(nationalId) == hash(nationalId) across all systems
 *
 * This ensures:
 * - Donors can register from frontend and be queried by API
 * - Hashes are deterministic (same input → same output)
 * - No collisions or randomness involved
 */

/**
 * Generate a deterministic SHA-256 hash of a donor identifier
 *
 * Pre-chain validation: Ensures the hash is correctly formatted before
 * submission to the Soroban contract.
 *
 * Algorithm:
 * 1. Normalize input: trim whitespace, convert to uppercase
 * 2. Encode to UTF-8 bytes
 * 3. Hash with SHA-256
 * 4. Convert to hex string (lowercase)
 * 5. Validate format (64 hex chars)
 *
 * @param identifier - Raw donor identifier (national ID, passport, etc.)
 * @returns Hex string of SHA-256 hash (64 characters, lowercase)
 * @throws ConsentHashError if hashing fails or output invalid
 *
 * @example
 * const hash = generateConsentHash("12345678901234");
 * // Returns: "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7"
 */
export function generateConsentHash(identifier: string): string {
  try {
    // Normalize input
    const normalized = identifier.trim().toUpperCase();

    if (!normalized) {
      throw new ConsentHashError("Identifier cannot be empty or whitespace");
    }

    // Hash with SHA-256
    const hash = crypto
      .createHash("sha256")
      .update(normalized, "utf-8")
      .digest("hex");

    // Validate output format
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new ConsentHashError(
        `Invalid hash format: expected 64 hex chars, got ${hash.length}`,
      );
    }

    return hash;
  } catch (error: any) {
    if (error instanceof ConsentHashError) {
      throw error;
    }

    throw new ConsentHashError(
      `Failed to generate hash: ${error.message}`,
      error,
    );
  }
}

/**
 * Validate a consent hash without re-hashing
 *
 * Used for input validation before database/contract queries
 *
 * Format: Must be exactly 64 hex characters (0-9, a-f)
 *
 * @param hash - Hash string to validate
 * @returns true if valid SHA-256 hex format
 * @throws ConsentHashError if validation fails
 *
 * @example
 * const hash = "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
 * validateConsentHash(hash); // true
 * validateConsentHash("invalid"); // throws ConsentHashError
 */
export function validateConsentHash(hash: string): boolean {
  if (!hash || hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new ConsentHashError(
      `Invalid hash format: expected 64 hex chars, got "${hash}"`,
    );
  }

  return true;
}

/**
 * Hash-based comparison with timing attack resistance
 *
 * Used for security-sensitive comparisons (e.g., API key validation)
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param hash1 - First hash string
 * @param hash2 - Second hash string
 * @returns true if hashes are equal (constant-time)
 *
 * @example
 * const stored = "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
 * const query = "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
 * compareHashes(stored, query); // true
 */
export function compareHashes(hash1: string, hash2: string): boolean {
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash1), Buffer.from(hash2));
}

/**
 * Utility to check if a value is a valid SHA-256 hex string
 *
 * @param value - Value to check
 * @returns true if value is 64 hex chars (case-insensitive)
 *
 * @example
 * isValidSha256("a3f8d2..."); // true
 * isValidSha256("not-a-hash"); // false
 */
export function isValidSha256(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Parse and validate a consent hash from external input
 *
 * Defensively parses hash-like strings and ensures they're valid
 *
 * @param input - Unvalidated input (e.g., URL param, JSON body)
 * @returns Valid hash string or null
 *
 * @example
 * const hash = parseHashInput("a3f8d2...");
 * if (hash) {
 *   // Safe to use in contract call
 *   await consentService.queryConsent({ idHash: hash });
 * }
 */
export function parseHashInput(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim().toLowerCase();

  if (!isValidSha256(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Custom error class for hashing operations
 */
export class ConsentHashError extends Error {
  constructor(
    message: string,
    readonly originalError?: Error,
  ) {
    super(message);
    this.name = "ConsentHashError";
  }
}

/**
 * Hash statistics for observability
 *
 * Track hashing performance and error rates
 */
export interface HashStats {
  totalHashes: number;
  successfulHashes: number;
  failedHashes: number;
  averageHashTimeMs: number;
}

/**
 * Hash statistics tracker
 *
 * Useful for monitoring and debugging hash generation performance
 */
export class HashStatsTracker {
  private stats: HashStats = {
    totalHashes: 0,
    successfulHashes: 0,
    failedHashes: 0,
    averageHashTimeMs: 0,
  };

  private hashTimes: number[] = [];

  /**
   * Record a successful hash operation with timing
   */
  recordSuccess(timeMs: number): void {
    this.stats.totalHashes++;
    this.stats.successfulHashes++;
    this.hashTimes.push(timeMs);

    if (this.hashTimes.length > 1000) {
      // Keep only last 1000 samples to avoid memory leak
      this.hashTimes = this.hashTimes.slice(-1000);
    }

    this.updateAverageTime();
  }

  /**
   * Record a failed hash operation
   */
  recordFailure(): void {
    this.stats.totalHashes++;
    this.stats.failedHashes++;
  }

  /**
   * Get current statistics
   */
  getStats(): HashStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      totalHashes: 0,
      successfulHashes: 0,
      failedHashes: 0,
      averageHashTimeMs: 0,
    };
    this.hashTimes = [];
  }

  private updateAverageTime(): void {
    if (this.hashTimes.length === 0) {
      this.stats.averageHashTimeMs = 0;
      return;
    }

    const sum = this.hashTimes.reduce((a, b) => a + b, 0);
    this.stats.averageHashTimeMs = sum / this.hashTimes.length;
  }
}

/**
 * Global hash statistics tracker instance
 */
export const hashStats = new HashStatsTracker();

/**
 * Generate consent hash with statistics tracking
 *
 * Wraps generateConsentHash to track performance
 */
export function generateConsentHashWithStats(identifier: string): string {
  const startTime = Date.now();

  try {
    const hash = generateConsentHash(identifier);
    const duration = Date.now() - startTime;
    hashStats.recordSuccess(duration);
    return hash;
  } catch (error) {
    hashStats.recordFailure();
    throw error;
  }
}
