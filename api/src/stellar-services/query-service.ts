import {
  Horizon,
  SorobanRpc,
  TransactionBuilder,
  Contract,
  nativeToScVal,
  xdr,
} from "stellar-sdk";
import { StellarNetworkConfig } from "./network-config";

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
  private sorobanClient: SorobanRpc.Client;
  private sourceAccount: Horizon.AccountResponse | null = null;

  constructor(contractId: string, networkConfig: StellarNetworkConfig) {
    this.contractId = contractId;
    this.networkConfig = networkConfig;

    this.horizonClient = new Horizon.Server(networkConfig.horizonUrl);
    this.sorobanClient = new SorobanRpc.Client({
      allowHttp: false,
      serverURL: networkConfig.sorobanUrl,
    });
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
    const record = await this.getRecord(idHash);
    return record !== null && record.isActive;
  }

  /**
   * Get full consent record (read-only)
   *
   * Calls contract.get_record(donor_id_hash)
   * Simulates the transaction to retrieve the result
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns Full ConsentRecord or null if not found
   */
  async getRecord(idHash: string): Promise<ConsentRecord | null> {
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
        // Contract returned error (e.g., NotFound) — treat as null
        return null;
      } else {
        // Simulation failed
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
  private parseConsentRecord(xdrValue: xdr.SCVal): ConsentRecord | null {
    try {
      // Handle Option/None type
      if (xdrValue.switch() === xdr.SCValType.scvTypeVoid()) {
        return null;
      }

      // Handle struct as map
      if (xdrValue.switch() === xdr.SCValType.scvTypeMap()) {
        const map = xdrValue.map();
        if (!map) return null;

        const fields: Record<string, any> = {};

        // Parse map entries
        for (const entry of map.sc_map_entries()) {
          const keyVal = entry.key();
          const key = keyVal.sym()?.toString() || "";
          const val = entry.val();

          if (key === "donor_id_hash") {
            fields.donorIdHash = val.str()?.toString() || "";
          } else if (key === "wallet") {
            const addr = val.address();
            if (addr) {
              fields.wallet = addr.contractId()?.toString() || "";
            }
          } else if (key === "organs") {
            const vec = val.vec();
            fields.organs = vec
              ? vec.map((v) => v.str()?.toString() || "")
              : [];
          } else if (key === "registered_at") {
            fields.registeredAt = Number(val.u64()?.toString() || "0");
          } else if (key === "is_active") {
            fields.isActive = val.b() || false;
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
