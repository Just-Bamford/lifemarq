import { QueryService, ConsentRecord } from "./stellar-services/query-service";
import { TransactionService } from "./stellar-services/transaction-service";
import { AuthService } from "./stellar-services/auth-service";
import {
  getNetworkConfig,
  StellarNetworkConfig,
} from "./stellar-services/network-config";

/**
 * Stellar Client (Facade)
 *
 * High-level interface to Stellar blockchain interaction.
 * Delegates to modular services for specific concerns:
 * - QueryService: read-only contract queries
 * - TransactionService: building and submitting transactions
 * - AuthService: wallet authentication
 *
 * Design Pattern: Facade
 * - Provides simple interface to complex subsystems
 * - Encapsulates service initialization and coordination
 * - Enables easy testing through dependency injection
 */
export class StellarClient {
  private queryService: QueryService;
  private transactionService: TransactionService;
  private authService: AuthService;
  private networkConfig: StellarNetworkConfig;

  constructor(contractId: string, network: string = "testnet") {
    this.networkConfig = getNetworkConfig(network);

    // Initialize modular services
    this.queryService = new QueryService(contractId, this.networkConfig);
    this.transactionService = new TransactionService(this.networkConfig);
    this.authService = new AuthService();
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(): StellarNetworkConfig {
    return this.networkConfig;
  }

  /**
   * Get query service for read-only operations
   */
  getQueryService(): QueryService {
    return this.queryService;
  }

  /**
   * Get transaction service for building/submitting transactions
   */
  getTransactionService(): TransactionService {
    return this.transactionService;
  }

  /**
   * Get authentication service
   */
  getAuthService(): AuthService {
    return this.authService;
  }

  /**
   * Query consent status (delegates to QueryService)
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns true if active consent exists, false otherwise
   */
  async queryConsent(idHash: string): Promise<boolean> {
    return this.queryService.queryConsent(idHash);
  }

  /**
   * Get full consent record (delegates to QueryService)
   *
   * @param idHash - SHA-256 hash of donor ID
   * @returns Full ConsentRecord or null if not found
   */
  async getRecord(idHash: string): Promise<ConsentRecord | null> {
    return this.queryService.getRecord(idHash);
  }
}

// Re-export types from services
export { ConsentRecord } from "./stellar-services/query-service";
export {
  QueryService,
  TransactionService,
  AuthService,
} from "./stellar-services";
