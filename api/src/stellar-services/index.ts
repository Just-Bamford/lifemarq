/**
 * Stellar Services Module
 *
 * Modular services layer separating concerns for Stellar blockchain interaction.
 * Each service handles a specific domain:
 * - QueryService: Read-only contract queries
 * - TransactionService: Building and submitting transactions
 * - AuthService: Wallet authentication and signatures
 */

export { QueryService } from "./query-service";
export { TransactionService } from "./transaction-service";
export { AuthService } from "./auth-service";
export { StellarNetworkConfig } from "./network-config";
