import { ConsentService, QueryConsentResponse } from "./consent-service";

/**
 * Hospital Verification Service with Audit Logging
 *
 * Handles verification requests from hospital systems with comprehensive auditing.
 * Every verification request is logged for compliance and analytics.
 *
 * Responsibility:
 * - Query consent status by donor ID hash
 * - Format verification responses for hospitals
 * - Track verification metadata
 * - Support multi-organ transplant workflows
 * - Log all requests for audit trail
 */

export interface VerificationRequest {
  donorIdHash: string;
  hospitalId: string;
  procedureType?: string;
  requestedAt: number;
}

export interface VerificationAuditEntry {
  timestamp: string;
  correlationId: string;
  hospitalId: string;
  donorIdHash: string;
  procedureType?: string;
  result: "verified" | "not_verified" | "error";
  organs: string[];
  responseTimeMs: number;
  sourceIp?: string;
  userAgent?: string;
}

export interface OrganConsent {
  organ: string;
  consented: boolean;
}

export interface DetailedVerificationResponse {
  status: "verified" | "not_verified" | "error";
  donorIdHash: string;
  consentActive: boolean;
  organs: OrganConsent[];
  registeredAt?: number;
  verifiedAt: string;
  message: string;
  procedureAllowed: boolean;
  metadata: {
    requestId: string;
    lookupTimeMs: number;
    consentType: "explicit" | "none";
  };
}

export interface VerificationResponse {
  status: "verified" | "not_verified" | "error";
  donorIdHash: string;
  consentActive: boolean;
  organs: string[];
  registeredAt?: number;
  verifiedAt: string;
  message: string;
  procedureAllowed: boolean;
}

export interface VerificationRecord extends VerificationRequest {
  response: VerificationResponse;
  auditLog?: VerificationAuditEntry;
}

/**
 * Verification Service with Audit Logging
 */
export class VerificationService {
  private consentService: ConsentService;
  private verificationLog: VerificationRecord[] = [];
  private auditLog: VerificationAuditEntry[] = [];
  private requestIdCounter: number = 0;

  constructor(consentService: ConsentService) {
    this.consentService = consentService;
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    this.requestIdCounter++;
    return `vrfy-${Date.now()}-${this.requestIdCounter}`;
  }

  /**
   * Verify donor consent for hospital with audit logging
   *
   * @param donorIdHash - SHA-256 hash of donor ID
   * @param hospitalId - Hospital identifier
   * @param procedureType - Optional: type of procedure (e.g., "kidney_transplant")
   * @param correlationId - Unique request ID for tracing
   * @param sourceIp - Source IP address (for audit)
   * @param userAgent - User agent string (for audit)
   * @returns Verification response with consent status and message
   */
  async verifyDonor(
    donorIdHash: string,
    hospitalId: string,
    procedureType?: string,
    correlationId?: string,
    sourceIp?: string,
    userAgent?: string,
  ): Promise<VerificationResponse> {
    const requestedAt = Date.now();
    const startTime = Date.now();
    const requestId = correlationId || this.generateRequestId();

    try {
      // Query consent status
      const consent = await this.consentService.queryConsent({
        idHash: donorIdHash,
      });

      const responseTimeMs = Date.now() - startTime;

      // Build verification response
      const response: VerificationResponse = {
        status: consent.isConsented ? "verified" : "not_verified",
        donorIdHash,
        consentActive: consent.isConsented,
        organs: consent.organs,
        verifiedAt: new Date().toISOString(),
        procedureAllowed: consent.isConsented,
        message: this.buildMessage(
          consent.isConsented,
          consent.organs,
          procedureType,
        ),
      };

      // Create audit log entry
      const auditEntry: VerificationAuditEntry = {
        timestamp: new Date().toISOString(),
        correlationId: requestId,
        hospitalId,
        donorIdHash,
        procedureType,
        result: response.status as "verified" | "not_verified" | "error",
        organs: consent.organs,
        responseTimeMs,
        sourceIp,
        userAgent,
      };

      // Log both verification and audit
      this.verificationLog.push({
        donorIdHash,
        hospitalId,
        procedureType,
        requestedAt,
        response,
        auditLog: auditEntry,
      });

      this.auditLog.push(auditEntry);

      console.log(
        `[AUDIT] Verification: ${requestId} | Hospital: ${hospitalId} | Status: ${response.status} | Time: ${responseTimeMs}ms`,
      );

      return response;
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;

      // Return error response
      const response: VerificationResponse = {
        status: "error",
        donorIdHash,
        consentActive: false,
        organs: [],
        verifiedAt: new Date().toISOString(),
        procedureAllowed: false,
        message: "Unable to verify consent at this time. Please try again.",
      };

      // Log error audit entry
      const auditEntry: VerificationAuditEntry = {
        timestamp: new Date().toISOString(),
        correlationId: requestId,
        hospitalId,
        donorIdHash,
        procedureType,
        result: "error",
        organs: [],
        responseTimeMs,
        sourceIp,
        userAgent,
      };

      this.verificationLog.push({
        donorIdHash,
        hospitalId,
        procedureType,
        requestedAt,
        response,
        auditLog: auditEntry,
      });

      this.auditLog.push(auditEntry);

      console.error(
        `[AUDIT] Verification ERROR: ${requestId} | Hospital: ${hospitalId} | Error: ${error.message}`,
      );

      throw error;
    }
  }

  /**
   * Get full audit log (for compliance and analytics)
   */
  getAuditLog(limit: number = 1000): VerificationAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get audit log by hospital
   */
  getAuditLogByHospital(
    hospitalId: string,
    limit: number = 100,
  ): VerificationAuditEntry[] {
    return this.auditLog
      .filter((entry) => entry.hospitalId === hospitalId)
      .slice(-limit);
  }

  /**
   * Get audit log by date range
   */
  getAuditLogByDateRange(
    startTime: Date,
    endTime: Date,
    limit: number = 1000,
  ): VerificationAuditEntry[] {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    return this.auditLog
      .filter((entry) => {
        const entryMs = new Date(entry.timestamp).getTime();
        return entryMs >= startMs && entryMs <= endMs;
      })
      .slice(-limit);
  }

  /**
   * Export audit log as CSV (for compliance reporting)
   */
  exportAuditLogAsCSV(): string {
    const headers = [
      "timestamp",
      "correlationId",
      "hospitalId",
      "donorIdHash",
      "procedureType",
      "result",
      "organs",
      "responseTimeMs",
      "sourceIp",
      "userAgent",
    ];

    const rows = this.auditLog.map((entry) => [
      entry.timestamp,
      entry.correlationId,
      entry.hospitalId,
      entry.donorIdHash,
      entry.procedureType || "",
      entry.result,
      entry.organs.join("|"),
      entry.responseTimeMs,
      entry.sourceIp || "",
      entry.userAgent || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(",")),
    ].join("\n");

    return csv;
  }

  /**
   * Build human-readable verification message
   */
  private buildMessage(
    consentActive: boolean,
    organs: string[],
    procedureType?: string,
  ): string {
    if (!consentActive) {
      return "No active donor consent on file. Not authorized to proceed with transplant.";
    }

    if (organs.length === 0) {
      return "Donor consent on file but no organs specified.";
    }

    const organList = organs.join(", ");

    if (procedureType) {
      const organMatch = organs.some((o) =>
        procedureType.toLowerCase().includes(o.toLowerCase()),
      );
      if (organMatch) {
        return `Donor consent verified for: ${organList}. Authorized to proceed with ${procedureType}.`;
      } else {
        return `Donor consent verified for: ${organList}. Procedure type ${procedureType} not among consented organs.`;
      }
    }

    return `Donor consent verified for: ${organList}. Authorized to proceed with compatible procedures.`;
  }

  /**
   * Get verification history for hospital
   */
  getVerificationHistory(
    hospitalId: string,
    limit: number = 100,
  ): VerificationRecord[] {
    return this.verificationLog
      .filter((record) => record.hospitalId === hospitalId)
      .slice(-limit);
  }

  /**
   * Get all verification records
   */
  getAllVerifications(limit: number = 1000): VerificationRecord[] {
    return this.verificationLog.slice(-limit);
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(): {
    totalVerifications: number;
    verified: number;
    notVerified: number;
    errors: number;
  } {
    let verified = 0;
    let notVerified = 0;
    let errors = 0;

    for (const record of this.verificationLog) {
      switch (record.response.status) {
        case "verified":
          verified++;
          break;
        case "not_verified":
          notVerified++;
          break;
        case "error":
          errors++;
          break;
      }
    }

    return {
      totalVerifications: this.verificationLog.length,
      verified,
      notVerified,
      errors,
    };
  }

  /**
   * Clear logs (for testing)
   */
  clearLogs(): void {
    this.verificationLog = [];
    this.auditLog = [];
  }
}
