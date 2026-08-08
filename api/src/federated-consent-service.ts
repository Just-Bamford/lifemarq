// Federated Consent Service for cross-border queries
// Handles cross-border consent queries across multiple country registries

import {
  getRegistryForCountry,
  getLocalRegistry,
  isCountryConfigured,
  LOCAL_COUNTRY_CODE,
} from "./registry-config";

export interface FederatedQueryRequest {
  donor_id_hash: string;
  hospital_id: string;
  donor_country_code: string;
}

export interface FederatedQueryResponse {
  is_consented: boolean;
  hospital_verified: boolean;
  donor_country: string;
  registry_contract: string;
  is_cross_border: boolean;
  timestamp: number;
}

export class FederatedConsentService {
  async queryDonorConsent(
    request: FederatedQueryRequest,
  ): Promise<FederatedQueryResponse> {
    const { donor_id_hash, hospital_id, donor_country_code } = request;

    this.validateRequest(donor_id_hash, hospital_id, donor_country_code);

    if (!isCountryConfigured(donor_country_code)) {
      throw new Error(`Registry not configured for ${donor_country_code}`);
    }

    const isCrossBorder = donor_country_code !== LOCAL_COUNTRY_CODE;
    const donorRegistry = getRegistryForCountry(donor_country_code);

    // TODO: Implement actual contract calls to Soroban
    // For now, return stub response
    return {
      is_consented: false,
      hospital_verified: false,
      donor_country: donor_country_code,
      registry_contract: donorRegistry,
      is_cross_border: isCrossBorder,
      timestamp: Date.now(),
    };
  }

  private validateRequest(
    donor_id_hash: string,
    hospital_id: string,
    donor_country_code: string,
  ): void {
    if (!donor_id_hash || donor_id_hash.length !== 64) {
      throw new Error("Invalid donor_id_hash: must be 64-char hex string");
    }

    if (!hospital_id || hospital_id.trim() === "") {
      throw new Error("Invalid hospital_id: must not be empty");
    }

    if (!donor_country_code || donor_country_code.length !== 2) {
      throw new Error("Invalid donor_country_code: must be 2-letter ISO code");
    }

    if (!/^[A-Z]{2}$/.test(donor_country_code)) {
      throw new Error("Invalid donor_country_code: must be uppercase ISO code");
    }
  }
}
