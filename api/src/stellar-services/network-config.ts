import { Networks } from "stellar-sdk";

/**
 * Stellar Network Configuration
 *
 * Centralizes network-specific settings and URLs
 */

export interface StellarNetworkConfig {
  readonly name: string;
  readonly horizonUrl: string;
  readonly sorobanUrl: string;
  readonly networkPassphrase: string;
}

/**
 * Get network configuration by name
 *
 * @param network - Network name: 'testnet', 'public', or custom
 * @returns Network configuration with URLs and passphrase
 */
export function getNetworkConfig(network: string): StellarNetworkConfig {
  switch (network.toLowerCase()) {
    case "testnet":
      return {
        name: "testnet",
        horizonUrl: "https://horizon-testnet.stellar.org",
        sorobanUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase:
          Networks.TESTNET_NETWORK_PASSPHRASE ||
          "Test SDF Network ; September 2015",
      };

    case "public":
    case "mainnet":
      return {
        name: "public",
        horizonUrl: "https://horizon.stellar.org",
        sorobanUrl: "https://soroban.stellar.org",
        networkPassphrase:
          Networks.PUBLIC_NETWORK_PASSPHRASE ||
          "Public Global Stellar Network ; September 2015",
      };

    default:
      // Default to testnet for unknown networks
      console.warn(`Unknown network "${network}", defaulting to testnet`);
      return getNetworkConfig("testnet");
  }
}
