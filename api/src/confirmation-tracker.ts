/**
 * Blockchain Confirmation Status Tracker
 *
 * Tracks the confirmation status of submitted transactions on Stellar.
 * Enables coordination between frontend (who submitted) and backend
 * (who confirms on-chain state).
 *
 * Responsibility:
 * - Track pending transactions by hash
 * - Poll for confirmation status
 * - Cache confirmed state
 * - Clean up stale entries
 */

/**
 * Transaction submission record
 */
export interface SubmissionRecord {
  txHash: string;
  consentHash: string;
  wallet: string;
  submittedAt: number;
  operation: "register" | "revoke";
}

/**
 * Confirmation status
 */
export enum ConfirmationStatus {
  /// Transaction submitted, awaiting confirmation
  PENDING = "PENDING",
  /// Transaction confirmed on-chain
  CONFIRMED = "CONFIRMED",
  /// Transaction failed or not found
  FAILED = "FAILED",
  /// Status unknown or unchecked
  UNKNOWN = "UNKNOWN",
}

/**
 * Blockchain confirmation record
 */
export interface ConfirmationRecord {
  txHash: string;
  status: ConfirmationStatus;
  confirmationTime?: number; // Unix timestamp when confirmed
  ledgerHeight?: number; // Stellar ledger height
  consentActiveOnChain?: boolean; // Current consent state
}

/**
 * Confirmation Tracker
 *
 * In-memory tracker for transaction confirmations.
 * Future: Persist to database for production use.
 */
export class ConfirmationTracker {
  /// Map: txHash -> SubmissionRecord
  private submissions: Map<string, SubmissionRecord> = new Map();

  /// Map: txHash -> ConfirmationRecord
  private confirmations: Map<string, ConfirmationRecord> = new Map();

  /// TTL for pending transactions (default: 1 hour)
  private pendingTtlMs: number = 60 * 60 * 1000;

  /// TTL for confirmed transactions (default: 7 days)
  private confirmedTtlMs: number = 7 * 24 * 60 * 60 * 1000;

  constructor(
    pendingTtlMs: number = 60 * 60 * 1000,
    confirmedTtlMs: number = 7 * 24 * 60 * 60 * 1000,
  ) {
    this.pendingTtlMs = pendingTtlMs;
    this.confirmedTtlMs = confirmedTtlMs;

    // Periodic cleanup of stale entries
    this.startCleanupInterval();
  }

  /**
   * Record a transaction submission
   *
   * Call this when the frontend submits a transaction to Stellar
   *
   * @param txHash - Transaction hash from Stellar
   * @param consentHash - Donor ID hash being registered/revoked
   * @param wallet - Donor's wallet address
   * @param operation - Operation: "register" or "revoke"
   */
  recordSubmission(
    txHash: string,
    consentHash: string,
    wallet: string,
    operation: "register" | "revoke",
  ): void {
    this.submissions.set(txHash, {
      txHash,
      consentHash,
      wallet,
      submittedAt: Date.now(),
      operation,
    });

    // Initialize confirmation status as PENDING
    this.confirmations.set(txHash, {
      txHash,
      status: ConfirmationStatus.PENDING,
    });

    console.log(
      `[Confirmation] ${operation} transaction submitted: ${txHash.substring(0, 16)}...`,
    );
  }

  /**
   * Update confirmation status
   *
   * Called when polling Stellar for transaction status
   *
   * @param txHash - Transaction hash
   * @param status - Current confirmation status
   * @param consentActiveOnChain - Optional: current consent state on-chain
   */
  updateStatus(
    txHash: string,
    status: ConfirmationStatus,
    consentActiveOnChain?: boolean,
    ledgerHeight?: number,
  ): void {
    const confirmation = this.confirmations.get(txHash) || {
      txHash,
      status: ConfirmationStatus.UNKNOWN,
    };

    confirmation.status = status;
    if (consentActiveOnChain !== undefined) {
      confirmation.consentActiveOnChain = consentActiveOnChain;
    }
    if (ledgerHeight !== undefined) {
      confirmation.ledgerHeight = ledgerHeight;
    }

    if (status === ConfirmationStatus.CONFIRMED) {
      confirmation.confirmationTime = Date.now();
      console.log(
        `[Confirmation] Transaction confirmed: ${txHash.substring(0, 16)}... (ledger: ${ledgerHeight})`,
      );
    }

    this.confirmations.set(txHash, confirmation);
  }

  /**
   * Get confirmation status
   *
   * @param txHash - Transaction hash
   * @returns ConfirmationRecord or null if not found
   */
  getStatus(txHash: string): ConfirmationRecord | null {
    return this.confirmations.get(txHash) || null;
  }

  /**
   * Get submission details
   *
   * @param txHash - Transaction hash
   * @returns SubmissionRecord or null if not found
   */
  getSubmission(txHash: string): SubmissionRecord | null {
    return this.submissions.get(txHash) || null;
  }

  /**
   * Get all pending transactions
   *
   * Returns transactions still awaiting confirmation
   */
  getPendingTransactions(): ConfirmationRecord[] {
    return Array.from(this.confirmations.values()).filter(
      (record) => record.status === ConfirmationStatus.PENDING,
    );
  }

  /**
   * Get all confirmed transactions
   */
  getConfirmedTransactions(): ConfirmationRecord[] {
    return Array.from(this.confirmations.values()).filter(
      (record) => record.status === ConfirmationStatus.CONFIRMED,
    );
  }

  /**
   * Check if transaction is confirmed
   *
   * @param txHash - Transaction hash
   * @returns true if CONFIRMED, false otherwise
   */
  isConfirmed(txHash: string): boolean {
    const record = this.confirmations.get(txHash);
    return record?.status === ConfirmationStatus.CONFIRMED;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSubmissions: number;
    pendingCount: number;
    confirmedCount: number;
    failedCount: number;
  } {
    let pendingCount = 0;
    let confirmedCount = 0;
    let failedCount = 0;

    for (const record of this.confirmations.values()) {
      switch (record.status) {
        case ConfirmationStatus.PENDING:
          pendingCount++;
          break;
        case ConfirmationStatus.CONFIRMED:
          confirmedCount++;
          break;
        case ConfirmationStatus.FAILED:
          failedCount++;
          break;
      }
    }

    return {
      totalSubmissions: this.submissions.size,
      pendingCount,
      confirmedCount,
      failedCount,
    };
  }

  /**
   * Clean up stale entries
   *
   * Removes pending transactions older than pendingTtlMs
   * Removes confirmed transactions older than confirmedTtlMs
   */
  private cleanup(): void {
    const now = Date.now();
    const stalePending: string[] = [];
    const staleConfirmed: string[] = [];

    for (const [txHash, confirmation] of this.confirmations) {
      const submission = this.submissions.get(txHash);
      if (!submission) {
        continue;
      }

      const age = now - submission.submittedAt;

      if (
        confirmation.status === ConfirmationStatus.PENDING &&
        age > this.pendingTtlMs
      ) {
        stalePending.push(txHash);
      } else if (
        confirmation.status === ConfirmationStatus.CONFIRMED &&
        age > this.confirmedTtlMs
      ) {
        staleConfirmed.push(txHash);
      }
    }

    // Remove stale entries
    for (const txHash of stalePending) {
      this.submissions.delete(txHash);
      this.confirmations.delete(txHash);
    }

    for (const txHash of staleConfirmed) {
      this.submissions.delete(txHash);
      this.confirmations.delete(txHash);
    }

    if (stalePending.length > 0 || staleConfirmed.length > 0) {
      console.log(
        `[Confirmation] Cleaned up ${stalePending.length} pending, ${staleConfirmed.length} confirmed transactions`,
      );
    }
  }

  /**
   * Start periodic cleanup
   *
   * Runs every 5 minutes to remove stale entries
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.submissions.clear();
    this.confirmations.clear();
  }
}

/**
 * Global confirmation tracker instance
 */
export const confirmationTracker = new ConfirmationTracker();
