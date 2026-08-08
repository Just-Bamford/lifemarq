/**
 * Federated Consent Service
 *
 * Handles cross-border consent queries across multiple country registries.
 * Enables hospitals to query donors registered in other countries.
 */

import { LifemarqContractClient } from "./soroban-client";
import {
  getRegistryForCountry,
  getLocalRegistry,
  isCountryConfigured,
  getCountryName,
  LOCAL_COUNTRY_CODE,
} from "./registry-config";

export interface FederatedQueryRequest {
  /** SHA-256 hash of donor's national ID */
  donor_id_hash: string;
  /** Querying hospital's ID */
  hospital_id: string;
  /** Country where donor is registered (ISO 3166-1 alpha-2) */
  donor_country_code: string;
}

export interface FederatedQueryResponse {
  /** Whether donor has active, non-expired consent */
  is_consented: boolean;
  /** Whether querying hospital is verified in local registry */
  hospital_verified: boolean;
  /** Country where donor is registered */
  donor_country: string;
  /** Registry contract address queried */
  registry_contract: string;
  /** Whether this was a local or cross-border query */
  is_cross_border: boolean;
  /** Timestamp of query */
  timestamp: number;
}

export interface ConsentDetails {
  is_active: boolean;
  organs?: string[];
  registered_at?: number;
  expires_at?: number;
}

export class FederatedConsentService {
  private client: LifemarqContractClient;

  constructor(client: LifemarqContractClient) {
    this.client = client;
  }

  /**
   * Query donor consent across registries (federation)
   *
   * @param request - Federated query request
   * @returns Consent status and metadata
   * @throws Error if configuration invalid or query fails
   */
  async queryDonorConsent(
    request: FederatedQueryRequest,
  ): Promise<FederatedQueryResponse> {
    const { donor_id_hash, hospital_id, donor_country_code } = request;

    // Validate inputs
    this.validateRequest(donor_id_hash, hospital_id, donor_country_code);

    // Check if donor country is configured
    if (!isCountryConfigured(donor_country_code)) {
      throw new Error(
        `Registry not configured for ${getCountryName(donor_country_code)} (${donor_country_code})`,
      );
    }

    const isCrossBorder = donor_country_code !== LOCAL_COUNTRY_CODE;
    const localRegistry = getLocalRegistry();
    const donorRegistry = getRegistryForCountry(donor_country_code);

    // Step 1: Verify hospital in LOCAL registry
    const hospitalVerified = await this.verifyHospital(
      hospital_id,
      localRegistry,
    );

    if (!hospitalVerified) {
      // Hospital not verified locally - cannot query cross-border
      return {
        is_consented: false,
        hospital_verified: false,
        donor_country: donor_country_code,
        registry_contract: donorRegistry,
        is_cross_border: isCrossBorder,
        timestamp: Date.now(),
      };
    }

    // Step 2: Query donor consent
    let isConsented = false;

    if (isCrossBorder) {
      // Cross-border: Use federated_query on foreign registry
      isConsented = await this.federatedQuery(
        localRegistry,
        donorRegistry,
        donor_id_hash,
        hospital_id,
      );
    } else {
      // Local: Use standard verified query
      isConsented = await this.client.query_verified_only(
        donorRegistry,
        donor_id_hash,
        hospital_id,
      );
    }

    return {
      is_consented: isConsented,
      hospital_verified: hospitalVerified,
      donor_country: donor_country_code,
      registry_contract: donorRegistry,
      is_cross_border: isCrossBorder,
      timestamp: Date.now(),
    };
  }

  /**
   * Verify hospital in local registry
   */
  private async verifyHospital(
    hospital_id: string,
    registry: string,
  ): Promise<boolean> {
    try {
      const result = await this.client.is_hospital_verified(
        registry,
        hospital_id,
      );
      return result;
    } catch (error) {
      console.error(`Error verifying hospital ${hospital_id}:`, error);
      return false;
    }
  }

  /**
   * Call federated_query on foreign registry
   *
   * Routes query through local registry verification to foreign registry
   */
  private async federatedQuery(
    localRegistry: string,
    foreignRegistry: string,
    donor_id_hash: string,
    hospital_id: string,
  ): Promise<boolean> {
    try {
      // Call federated_query on foreign registry
      // This will:
      // 1. Check hospital is verified somewhere
      // 2. Query donor consent
      // 3. Return status
      const result = await this.client.federated_query(
        localRegistry,
        foreignRegistry,
        donor_id_hash,
        hospital_id,
      );
      return result;
    } catch (error) {
      console.error(
        `Federated query failed (${localRegistry} → ${foreignRegistry}):`,
        error,
      );
      return false; // Fail safely
    }
  }

  /**
   * Get consent details with expiry information
   *
   * Useful for showing renewal status to donors
   */
  async getConsentDetails(
    donor_id_hash: string,
    country_code: string = LOCAL_COUNTRY_CODE,
  ): Promise<ConsentDetails | null> {
    try {
      if (!isCountryConfigured(country_code)) {
        throw new Error(`Registry not configured for ${country_code}`);
      }

      const registry = getRegistryForCountry(country_code);
      const record = await this.client.get_record(registry, donor_id_hash);

      if (!record) {
        return null;
      }

      return {
        is_active: record.is_active,
        organs: record.organs,
        registered_at: record.registered_at,
        expires_at: record.expires_at || undefined,
      };
    } catch (error) {
      console.error("Error getting consent details:", error);
      return null;
    }
  }

  /**
   * Check if consent is expired
   */
  async isConsentExpired(
    donor_id_hash: string,
    country_code: string = LOCAL_COUNTRY_CODE,
  ): Promise<boolean> {
    try {
      if (!isCountryConfigured(country_code)) {
        throw new Error(`Registry not configured for ${country_code}`);
      }

      const registry = getRegistryForCountry(country_code);
      return await this.client.is_consent_expired(registry, donor_id_hash);
    } catch (error) {
      console.error("Error checking consent expiry:", error);
      return false;
    }
  }

  /**
   * Renew donor consent for another cycle
   */
  async renewConsent(
    donor_id_hash: string,
    wallet: string,
    renewal_period: number,
    country_code: string = LOCAL_COUNTRY_CODE,
  ): Promise<boolean> {
    try {
      if (!isCountryConfigured(country_code)) {
        throw new Error(`Registry not configured for ${country_code}`);
      }

      const registry = getRegistryForCountry(country_code);
      const result = await this.client.renew_consent(
        registry,
        donor_id_hash,
        wallet,
        renewal_period,
      );
      return result.is_ok();
    } catch (error) {
      console.error("Error renewing consent:", error);
      return false;
    }
  }

  /**
   * Get all available registries and their status
   *
   * For network discovery
   */
  async getNetworkStatus(): Promise<
    Array<{
      country: string;
      country_code: string;
      registry_contract: string;
      is_local: boolean;
    }>
  > {
    // This would call health checks on each registry
    // For now, just return configuration
    const configured = [
      { code: "KE", name: "Kenya" },
      { code: "NG", name: "Nigeria" },
      { code: "SN", name: "Senegal" },
      { code: "DRC", name: "Democratic Republic of Congo" },
      { code: "GH", name: "Ghana" },
    ];

    return configured
      .filter(({ code }) => isCountryConfigured(code))
      .map(({ code, name }) => ({
        country: name,
        country_code: code,
        registry_contract: getRegistryForCountry(code),
        is_local: code === LOCAL_COUNTRY_CODE,
      }));
  }

  /**
   * Validate federated query request
   */
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

    // Check format
    if (!/^[A-Z]{2}$/.test(donor_country_code)) {
      throw new Error("Invalid donor_country_code: must be uppercase ISO code");
    }
  }
}
