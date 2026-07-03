import { TransactionBuilder, Transaction } from "stellar-sdk";
import { StellarNetworkConfig } from "./network-config";

/**
 * Transaction Service
 *
 * Handles building and submitting transactions to the Stellar network.
 * Separates transaction construction from submission concerns.
 *
 * Responsibility:
 * - Build unsigned transactions
 * - Format and serialize for signing
 * - Submit signed transactions to Horizon
 *
 * Future: Add retry logic, fee estimation, transaction tracking
 */
export class TransactionService {
  private networkConfig: StellarNetworkConfig;

  constructor(networkConfig: StellarNetworkConfig) {
    this.networkConfig = networkConfig;
  }

  /**
   * Build an unsigned transaction
   *
   * Creates a TransactionBuilder with network-specific settings.
   * Operations can be added before calling build().
   *
   * @param sourceAccount - Account from Horizon API
   * @param fee - Fee in stroops (default: "100")
   * @returns TransactionBuilder instance
   *
   * @example
   * const builder = txService.createBuilder(account);
   * builder.addOperation(...);
   * const tx = builder.setTimeout(30).build();
   */
  createBuilder(sourceAccount: any, fee: string = "100"): TransactionBuilder {
    return new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase: this.networkConfig.networkPassphrase,
    });
  }

  /**
   * Serialize transaction to XDR for signing
   *
   * @param transaction - Built transaction
   * @returns XDR string representation
   */
  serializeTransaction(transaction: Transaction): string {
    return transaction.toEnvelope().toXDR();
  }

  /**
   * Deserialize XDR back to Transaction object
   *
   * @param xdr - XDR string from serialization
   * @returns Transaction object
   */
  deserializeTransaction(xdr: string): Transaction {
    const envelope = Transaction.fromXDR(
      xdr,
      this.networkConfig.networkPassphrase,
    );
    return envelope;
  }

  /**
   * Format transaction for submission to Horizon
   *
   * @param transaction - Signed transaction
   * @returns Formatted transaction object for Horizon
   */
  formatForSubmission(transaction: Transaction): {
    tx: string;
  } {
    return {
      tx: transaction.toEnvelope().toXDR("base64"),
    };
  }
}
