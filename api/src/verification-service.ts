import { ConsentService, QueryConsentResponse } from "./consent-service";

/**
 * Hospital Verification Service
 *
 * Handles verification requests from hospital systems.
 * Coordinates consent queries with verification response formatting.
 *
 * Responsibility:
 * - Query consent status by donor ID hash
 * - Format verification responses for hospitals
 * - Track verification metadata
 */

export interface VerificationRequest {
  donorIdHash: string;
  hospitalId: string;
  procedureType?: string;
  requestedAt: number;
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

  constructor(consentService: ConsentService) {
    this.consentService = consentService;
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

    try {
      // Query consent status
      const consent = await this.consentService.queryConsent({
        idHash: donorIdHash,
      });

      // Build verification response
      const response: VerificationResponse = {
        status: consent.isConsented ? "verified" : "not_verified",
        donorIdHash,
        consentActive: consent.isConsented,
        organs: consent.organs,
        verifiedAt: new Date().toISOString(),
        procedureAllowed: consent.isConsented,
        message: this.buildMessage(consent.isConsented, consent.organs),
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
   * Build human-readable verification message
   */
  private buildMessage(consentActive: boolean, organs: string[]): string {
    if (!consentActive) {
      return "No active donor consent on file. Not authorized to proceed with transplant.";
    }

    if (organs.length === 0) {
      return "Donor consent on file but no organs specified.";
    }

    const organList = organs.join(", ");
    return `Donor consent verified for: ${organList}. Authorized to proceed with compatible procedures.`;
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
