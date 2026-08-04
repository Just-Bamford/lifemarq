import {
  Horizon,
  SorobanRpc,
  TransactionBuilder,
  Contract,
  nativeToScVal,
  xdr,
} from "stellar-sdk";
import { StellarNetworkConfig } from "./network-config";
import { ResilienceService, DEFAULT_RETRY_CONFIG } from "./resilience-service";

/**
 * Consent Record as returned from Soroban contract
 */
export interface ConsentRecord {
  donorIdHash: string;
  wallet: string;
  organs: string[];
  registeredAt: number;
  isActive: boolean;
}

/**
 * Query Service
 *
 * Handles all read-only contract queries via Soroban RPC.
 * No authentication required — queries are public.
 *
 * Responsibility:
 * - Build contract query transactions
 * - Simulate against Soroban RPC
 * - Parse XDR responses into TypeScript objects
 */
export class QueryService {
  private contractId: string;
  private networkConfig: StellarNetworkConfig;
  private horizonClient: Horizon.Server;
  private sorobanClient: SorobanRpc.Server;
  private resilienceService: ResilienceService;
  private sourceAccount: Horizon.AccountResponse | null = null;

  constructor(contractId: string, networkConfig: StellarNetworkConfig) {
    this.contractId = contractId;
    this.networkConfig = networkConfig;

    this.horizonClient = new Horizon.Server(networkConfig.horizonUrl);
    this.sorobanClient = new SorobanRpc.Server(networkConfig.sorobanUrl, {
      allowHttp: false,
    });

    // Initialize resilience service with retry + circuit breaker
    this.resilienceService = new ResilienceService(DEFAULT_RETRY_CONFIG);
  }

  /**
   * Query consent status (read-only)
   *
   * Calls contract.query(donor_id_hash) without authentication
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns true if active, false if not found or revoked
   */
  async queryConsent(idHash: string): Promise<boolean> {
    return this.resilienceService.executeWithRetry(
      () => this.performQueryConsent(idHash),
      `query(${idHash})`,
    );
  }

  /**
   * Perform the actual query call
   */
  private async performQueryConsent(idHash: string): Promise<boolean> {
    try {
      const sourceAccount = await this.getSourceAccount();
      const contract = new Contract(this.contractId);

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: this.networkConfig.networkPassphrase,
      })
        .addOperation(
          contract.call("query", nativeToScVal(idHash, { type: "string" })),
        )
        .setTimeout(30)
        .build();

      const simulated =
        await this.sorobanClient.simulateTransaction(transaction);

      if (SorobanRpc.Api.isSimulationSuccess(simulated)) {
        const result = simulated.result?.retval;
        if (!result) {
          return false;
        }

        // Parse boolean result
        if (result.b !== undefined) {
          return result.b() || false;
        }

        return false;
      } else if (SorobanRpc.Api.isSimulationError(simulated)) {
        console.warn(`Query contract error for ${idHash}`);
        return false;
      }

      return false;
    } catch (error: any) {
      console.error(`Error querying consent for ${idHash}:`, error);
      throw error;
    }
  }

  /**
   * Query consent status via full record (legacy method)
   *
   * Calls contract.get_record(donor_id_hash) without authentication
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns true if active, false if not found or revoked
   */
  async queryConsentViaRecord(idHash: string): Promise<boolean> {
    const record = await this.getRecord(idHash);
    return record !== null && record.isActive;
  }

  /**
   * Get full consent record (read-only)
   *
   * Calls contract.get_record(donor_id_hash)
   * Simulates the transaction to retrieve the result
   * Applies resilience pattern: retry + circuit breaker
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns Full ConsentRecord or null if not found
   */
  async getRecord(idHash: string): Promise<ConsentRecord | null> {
    return this.resilienceService.executeWithRetry(
      () => this.performGetRecord(idHash),
      `get_record(${idHash})`,
    );
  }

  /**
   * Perform the actual get_record query (without resilience wrapper)
   *
   * Internal method called by getRecord() with retry logic applied
   */
  private async performGetRecord(
    idHash: string,
  ): Promise<ConsentRecord | null> {
    try {
      // Get source account for building transaction
      const sourceAccount = await this.getSourceAccount();

      // Create contract instance
      const contract = new Contract(this.contractId);

      // Build contract invocation
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase: this.networkConfig.networkPassphrase,
      })
        .addOperation(
          contract.call(
            "get_record",
            nativeToScVal(idHash, { type: "string" }),
          ),
        )
        .setTimeout(30)
        .build();

      // Simulate (read-only, no submission)
      const simulated =
        await this.sorobanClient.simulateTransaction(transaction);

      if (SorobanRpc.Api.isSimulationSuccess(simulated)) {
        const result = simulated.result?.retval;
        if (!result) {
          return null;
        }

        return this.parseConsentRecord(result);
      } else if (SorobanRpc.Api.isSimulationError(simulated)) {
        // Contract returned error - could be NotFound, Unauthorized, etc
        // Log for debugging but treat as "not found" for public queries
        const error = simulated.error;
        console.warn(`Contract error for ${idHash}: ${error}`);
        return null;
      } else if (SorobanRpc.Api.isSimulationRestore(simulated)) {
        // Restore state required - archive ledger entry needs restoration
        console.warn(`Restore operation needed for ${idHash}`);
        return null;
      } else {
        // Simulation failed for unknown reason
        console.error(`Simulation failed for ${idHash}:`, simulated);
        return null;
      }
    } catch (error: any) {
      console.error(`Error fetching record for ${idHash}:`, error);
      throw error;
    }
  }

  /**
   * Parse XDR ConsentRecord into TypeScript object
   *
   * The contract returns a struct with fields:
   * - donor_id_hash: String
   * - wallet: Address
   * - organs: Vec<String>
   * - registered_at: u64
   * - is_active: bool
   */
  private parseConsentRecord(xdrValue: any): ConsentRecord | null {
    try {
      // Handle Option/None type - check if void/null
      const resultType = xdrValue.switch?.();
      const typeStr = resultType?.toString?.() || "";

      // If type is void (0), return null
      if (typeStr === "0" || xdrValue.innerValue?.() === null) {
        return null;
      }

      // Handle struct as map
      if (xdrValue.map) {
        const map = xdrValue.map();
        if (!map) return null;

        const fields: Record<string, any> = {};

        // Parse map entries
        for (const entry of map.sc_map_entries?.() || []) {
          const keyVal = entry.key?.();
          const key = keyVal?.sym?.()?.toString() || "";
          const val = entry.val?.();

          if (key === "donor_id_hash") {
            fields.donorIdHash = val?.str?.()?.toString() || "";
          } else if (key === "wallet") {
            const addr = val?.address?.();
            if (addr?.accountId?.()) {
              fields.wallet = addr.accountId()?.toString() || "";
            } else if (addr?.contractId?.()) {
              fields.wallet = addr.contractId()?.toString() || "";
            }
          } else if (key === "organs") {
            const vec = val?.vec?.();
            fields.organs = vec
              ? vec.map((v: any) => v.str?.()?.toString() || "")
              : [];
          } else if (key === "registered_at") {
            fields.registeredAt = Number(val?.u64?.()?.toString() || "0");
          } else if (key === "is_active") {
            fields.isActive = val?.b?.() || false;
          }
        }

        return {
          donorIdHash: fields.donorIdHash || "",
          wallet: fields.wallet || "",
          organs: fields.organs || [],
          registeredAt: fields.registeredAt || 0,
          isActive: fields.isActive || false,
        };
      }

      return null;
    } catch (error: any) {
      console.error("Error parsing consent record:", error);
      return null;
    }
  }

  /**
   * Get source account for building transactions
   *
   * Uses a dummy account since we're only simulating (not submitting)
   */
  private async getSourceAccount(): Promise<Horizon.AccountResponse> {
    if (this.sourceAccount) {
      return this.sourceAccount;
    }

    try {
      // Use a dummy account for simulation only
      const dummyAccount =
        "GBRPYHIL2CI3WHZDTOOQFC6EB4PSQJNPPQ42SOFQ5XJJEFSTX2ZGPM7";
      this.sourceAccount = await this.horizonClient.loadAccount(dummyAccount);
      return this.sourceAccount;
    } catch (error: any) {
      console.error("Error loading source account:", error);
      throw error;
    }
  }
}
