import {
  Horizon,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Operation,
  xdr,
  Contract,
  nativeToScVal,
} from "stellar-sdk";

export interface ConsentRecord {
  donorIdHash: string;
  wallet: string;
  organs: string[];
  registeredAt: number;
  isActive: boolean;
}

export class StellarClient {
  private contractId: string;
  private network: string;
  private horizonClient: Horizon.Server;
  private sorobanClient: SorobanRpc.Client;
  private sourceAccount: Horizon.AccountResponse | null = null;

  constructor(contractId: string, network: string = "testnet") {
    this.contractId = contractId;
    this.network = network;

    // Initialize Horizon client
    const horizonUrl =
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org";
    this.horizonClient = new Horizon.Server(horizonUrl);

    // Initialize Soroban RPC client
    const sorobanUrl =
      network === "testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://soroban.stellar.org";
    this.sorobanClient = new SorobanRpc.Client({
      allowHttp: false,
      serverURL: sorobanUrl,
    });
  }

  /**
   * Query consent status from the Soroban contract (read-only)
   * Returns true if consent exists and is active, false otherwise
   */
  async queryConsent(idHash: string): Promise<boolean> {
    try {
      const record = await this.getRecord(idHash);
      return record !== null && record.isActive;
    } catch (error) {
      console.error("Error querying consent:", error);
      throw error;
    }
  }

  /**
   * Get full consent record from the Soroban contract
   * Returns the complete ConsentRecord or null if not found
   */
  async getRecord(idHash: string): Promise<ConsentRecord | null> {
    try {
      // Get a source account for building the transaction
      const sourceAccount = await this.getSourceAccount();

      // Create contract instance
      const contract = new Contract(this.contractId);

      // Build a contract invocation for get_record
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: "100",
        networkPassphrase:
          this.network === "testnet"
            ? Networks.TESTNET_NETWORK_PASSPHRASE
            : Networks.PUBLIC_NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            "get_record",
            nativeToScVal(idHash, { type: "string" }),
          ),
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction (read-only, no submission)
      const simulated =
        await this.sorobanClient.simulateTransaction(transaction);

      if (SorobanRpc.Api.isSimulationSuccess(simulated)) {
        // Parse the result
        const result = simulated.result?.retval;
        if (!result) {
          return null;
        }

        // Parse XDR result into ConsentRecord
        return this.parseConsentRecord(result);
      } else if (SorobanRpc.Api.isSimulationError(simulated)) {
        // Contract returned an error (e.g., NotFound)
        console.log("Contract error:", simulated.error);
        return null;
      } else {
        console.error("Simulation failed:", simulated);
        return null;
      }
    } catch (error) {
      console.error("Error fetching record:", error);
      throw error;
    }
  }

  /**
   * Parse XDR ConsentRecord into TypeScript object
   * The contract returns a struct with fields:
   * donor_id_hash (String), wallet (Address), organs (Vec<String>),
   * registered_at (u64), is_active (bool)
   */
  private parseConsentRecord(xdrValue: xdr.SCVal): ConsentRecord | null {
    try {
      // Handle None/Option type
      if (xdrValue.switch() === xdr.SCValType.scvTypeVoid()) {
        return null;
      }

      // Handle map (struct as map)
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
            // Wallet is an Address type
            const addr = val.address();
            if (addr) {
              fields.wallet = addr.contractId()?.toString() || "";
            }
          } else if (key === "organs") {
            // organs is Vec<String>
            const vec = val.vec();
            fields.organs = vec
              ? vec.map((v) => v.str()?.toString() || "")
              : [];
          } else if (key === "registered_at") {
            // registered_at is u64
            fields.registeredAt = Number(val.u64()?.toString() || "0");
          } else if (key === "is_active") {
            // is_active is bool
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
    } catch (error) {
      console.error("Error parsing consent record:", error);
      return null;
    }
  }

  /**
   * Get a source account for building transactions
   * Uses a dummy account since we're only simulating (not submitting)
   */
  private async getSourceAccount(): Promise<Horizon.AccountResponse> {
    if (this.sourceAccount) {
      return this.sourceAccount;
    }

    try {
      // Use a dummy account for simulation
      // In production, this would be a real account
      const dummyAccount =
        "GBRPYHIL2CI3WHZDTOOQFC6EB4PSQJNPPQ42SOFQ5XJJEFSTX2ZGPM7";
      this.sourceAccount = await this.horizonClient.loadAccount(dummyAccount);
      return this.sourceAccount;
    } catch (error) {
      console.error("Error loading source account:", error);
      throw error;
    }
  }
}
