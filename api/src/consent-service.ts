import { StellarClient, ConsentRecord } from "./stellar-client";
import {
  validateConsentHash,
  ConsentHashError,
  parseHashInput,
} from "./hash-utils";

/**
 * Donor Consent Service Layer
 *
 * Abstracts all contract interaction logic and provides high-level
 * consent operations to the HTTP API layer.
 *
 * Responsibilities:
 * - Unify contract interaction logic (query, retrieve, audit)
 * - Provide service-level error handling and recovery
 * - Enable easy mocking for tests
 * - Document domain operations (in business terms, not contract terms)
 *
 * Design Pattern: Service Layer (Domain-Driven Design)
 * - Decouples HTTP handlers from blockchain interaction
 * - Single responsibility: consent domain logic
 * - Enables testing without Stellar network access
 */
export interface QueryConsentRequest {
  idHash: string;
}

export interface QueryConsentResponse {
  idHash: string;
  isConsented: boolean;
  organs: string[];
  queriedAt: string;
}

export interface GetConsentRecordRequest {
  idHash: string;
}

export interface GetConsentRecordResponse {
  donorIdHash: string;
  wallet: string;
  organs: string[];
  registeredAt: number;
  isActive: boolean;
}

export interface AuditLogEntry {
  idHash: string;
  queriedAt: string;
  result: {
    isConsented: boolean;
    organs: string[];
  };
}

/**
 * Service layer for donor consent operations
 *
 * Provides a clean API for consent verification without exposing
 * Stellar-specific implementation details to HTTP handlers.
 */
export class ConsentService {
  private stellarClient: StellarClient;
  private auditLog: AuditLogEntry[] = [];

  constructor(stellarClient: StellarClient) {
    this.stellarClient = stellarClient;
  }

  /**
   * Query whether a donor has active consent
   *
   * Business Operation: "Is this donor registered?"
   * Contract Method: query(donor_id_hash) -> bool
   *
   * Returns:
   * - true if consent exists and is active
   * - false if not found or revoked
   *
   * Errors propagate to caller (HTTP layer) for proper status code mapping
   */
  async queryConsent(req: QueryConsentRequest): Promise<QueryConsentResponse> {
    const { idHash } = req;

    // Validate input
    this.validateHash(idHash);

    try {
      // Fetch full record to get organs and status
      const record = await this.stellarClient.getRecord(idHash);

      const isConsented = record !== null && record.isActive;
      const organs = record?.organs || [];
      const queriedAt = new Date().toISOString();

      // Log to audit trail
      this.auditLog.push({
        idHash,
        queriedAt,
        result: {
          isConsented,
          organs,
        },
      });

      return {
        idHash,
        isConsented,
        organs,
        queriedAt,
      };
    } catch (error: any) {
      // Service layer logs context; caller maps to HTTP status
      console.error(`Consent query failed for ${idHash}:`, error.message);
      throw new ConsentServiceError(
        `Failed to query consent for ${idHash}`,
        "REGISTRY_UNAVAILABLE",
        error,
      );
    }
  }

  /**
   * Retrieve full consent record
   *
   * Business Operation: "Get all details about this donor's consent"
   * Contract Method: get_record(donor_id_hash) -> Option<ConsentRecord>
   *
   * Returns:
   * - Full ConsentRecord if found
   * - Throws NotFoundError if not found
   *
   * Used by authorized queries (hospitals with API key)
   */
  async getConsentRecord(
    req: GetConsentRecordRequest,
  ): Promise<GetConsentRecordResponse> {
    const { idHash } = req;

    // Validate input
    this.validateHash(idHash);

    try {
      const record = await this.stellarClient.getRecord(idHash);

      if (!record) {
        throw new ConsentNotFoundError(`No consent record found for ${idHash}`);
      }

      return {
        donorIdHash: record.donorIdHash,
        wallet: record.wallet,
        organs: record.organs,
        registeredAt: record.registeredAt,
        isActive: record.isActive,
      };
    } catch (error: any) {
      if (error instanceof ConsentNotFoundError) {
        throw error;
      }

      console.error(
        `Failed to retrieve consent record for ${idHash}:`,
        error.message,
      );
      throw new ConsentServiceError(
        `Failed to retrieve consent record for ${idHash}`,
        "REGISTRY_UNAVAILABLE",
        error,
      );
    }
  }

  /**
   * Get audit log of all consent queries
   *
   * Returns array of queries with timestamps and results
   * Optional limit parameter to control response size
   */
  getAuditLog(limit: number = 100): AuditLogEntry[] {
    // Ensure limit is reasonable
    const normalizedLimit = Math.min(Math.max(limit, 1), 1000);
    return this.auditLog.slice(-normalizedLimit);
  }

  /**
   * Get full audit log (for admin/compliance)
   */
  getFullAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log (for testing or admin operations)
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Validate SHA-256 hash format
   *
   * SHA-256 hex string must be exactly 64 characters
   * Contains only hex digits (0-9, a-f, A-F)
   *
   * Uses hash-utils for consistent validation across codebase
   */
  private validateHash(hash: string): void {
    try {
      validateConsentHash(hash);
    } catch (error: any) {
      if (error instanceof ConsentHashError) {
        throw new ConsentValidationError(error.message);
      }

      throw error;
    }
  }
}

/**
 * Custom error class for consent service errors
 *
 * Enables specific error handling in HTTP layer
 */
export class ConsentServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly originalError?: Error,
  ) {
    super(message);
    this.name = "ConsentServiceError";
  }
}

/**
 * Error raised when consent record not found
 */
export class ConsentNotFoundError extends ConsentServiceError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "ConsentNotFoundError";
  }
}

/**
 * Error raised when input validation fails
 */
export class ConsentValidationError extends ConsentServiceError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ConsentValidationError";
  }
}
