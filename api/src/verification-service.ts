import { ConsentService, QueryConsentResponse } from "./consent-service";

/**
 * Hospital Verification Service
 *
 * Handles verification requests from hospital systems.
 * Coordinates consent queries with verification response formatting.
 * Implements detailed response schemas for hospital integration.
 *
 * Responsibility:
 * - Query consent status by donor ID hash
 * - Format verification responses for hospitals
 * - Track verification metadata
 * - Support multi-organ transplant workflows
 */

export interface VerificationRequest {
  donorIdHash: string;
  hospitalId: string;
  procedureType?: string;
  requestedAt: number;
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
}

/**
 * Verification Service
 *
 * Provides hospital verification operations with detailed responses
 */
export class VerificationService {
  private consentService: ConsentService;
  private verificationLog: VerificationRecord[] = [];
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
   * Verify donor consent for hospital
   *
   * @param donorIdHash - SHA-256 hash of donor ID
   * @param hospitalId - Hospital identifier
   * @param procedureType - Optional: type of procedure (e.g., "kidney_transplant")
   * @returns Verification response with consent status and message
   */
  async verifyDonor(
    donorIdHash: string,
    hospitalId: string,
    procedureType?: string,
  ): Promise<VerificationResponse> {
    const requestedAt = Date.now();
    const startTime = Date.now();

    try {
      // Query consent status
      const consent = await this.consentService.queryConsent({
        idHash: donorIdHash,
      });

      const lookupTimeMs = Date.now() - startTime;

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

      // Log verification record
      this.verificationLog.push({
        donorIdHash,
        hospitalId,
        procedureType,
        requestedAt,
        response,
      });

      return response;
    } catch (error: any) {
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

      // Log error verification record
      this.verificationLog.push({
        donorIdHash,
        hospitalId,
        procedureType,
        requestedAt,
        response,
      });

      throw error;
    }
  }

  /**
   * Perform detailed consent lookup for specific organ
   *
   * Useful for multi-organ transplant planning
   *
   * @param donorIdHash - SHA-256 hash of donor ID
   * @param organs - List of organs to check (e.g., ["kidney", "liver", "heart"])
   * @returns DetailedVerificationResponse with per-organ breakdown
   */
  async lookupConsentForOrgans(
    donorIdHash: string,
    organs: string[],
  ): Promise<DetailedVerificationResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Query full consent record
      const consent = await this.consentService.getConsentRecord({
        idHash: donorIdHash,
      });

      const lookupTimeMs = Date.now() - startTime;
      const consentedOrgans = consent?.organs || [];

      // Build per-organ consent map
      const organConsent: OrganConsent[] = organs.map((organ) => ({
        organ,
        consented: consentedOrgans.includes(organ),
      }));

      // Determine if any requested organ is consented
      const anyConsentedOrgans = organConsent.some((oc) => oc.consented);

      return {
        status: anyConsentedOrgans ? "verified" : "not_verified",
        donorIdHash,
        consentActive: consent?.isActive || false,
        organs: organConsent,
        registeredAt: consent?.registeredAt,
        verifiedAt: new Date().toISOString(),
        procedureAllowed: anyConsentedOrgans,
        message: this.buildDetailedMessage(organConsent),
        metadata: {
          requestId,
          lookupTimeMs,
          consentType: anyConsentedOrgans ? "explicit" : "none",
        },
      };
    } catch (error: any) {
      const lookupTimeMs = Date.now() - startTime;

      return {
        status: "error",
        donorIdHash,
        consentActive: false,
        organs: organs.map((organ) => ({ organ, consented: false })),
        verifiedAt: new Date().toISOString(),
        procedureAllowed: false,
        message: "Unable to verify consent at this time.",
        metadata: {
          requestId,
          lookupTimeMs,
          consentType: "none",
        },
      };
    }
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
   * Build detailed message for per-organ consent
   */
  private buildDetailedMessage(organConsent: OrganConsent[]): string {
    const consented = organConsent
      .filter((oc) => oc.consented)
      .map((oc) => oc.organ);
    const denied = organConsent
      .filter((oc) => !oc.consented)
      .map((oc) => oc.organ);

    if (consented.length === 0) {
      return "Donor has not consented to any of the requested organs.";
    }

    if (denied.length === 0) {
      return `Donor has consented to all requested organs: ${consented.join(", ")}.`;
    }

    return `Donor has consented to: ${consented.join(", ")}. Not consented to: ${denied.join(", ")}.`;
  }

  /**
   * Get verification history for hospital
   *
   * @param hospitalId - Hospital identifier
   * @param limit - Number of records to return
   * @returns Array of verification records for hospital
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
   *
   * @param limit - Number of records to return
   * @returns Array of all verification records
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
   * Clear verification log (for testing)
   */
  clearLog(): void {
    this.verificationLog = [];
  }
}
