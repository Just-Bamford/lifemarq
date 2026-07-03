/**
 * Authentication Service
 *
 * Handles wallet authentication and signature verification.
 * Separates auth concerns from transaction building.
 *
 * Responsibility:
 * - Verify wallet signatures
 * - Manage authentication state
 * - Validate authorization headers
 *
 * Future: Implement provider API key validation, nonce-based auth
 */

export interface AuthContext {
  walletAddress: string;
  authenticated: boolean;
  timestamp: number;
}

/**
 * Authentication Service for wallet and provider verification
 */
export class AuthService {
  /**
   * Verify a wallet signature
   *
   * In production, this would verify against the actual signed transaction.
   * For now, placeholder for integration with Freighter or other wallet libs.
   *
   * @param signature - Signature from wallet
   * @param message - Original message that was signed
   * @param publicKey - Public key of signer
   * @returns true if signature is valid
   */
  verifySignature(
    signature: string,
    message: string,
    publicKey: string,
  ): boolean {
    // TODO: Implement actual signature verification
    // This would use tweetnacl.sign.open() or similar
    console.log(
      `[TODO] Verify signature from ${publicKey} for message: ${message}`,
    );
    return true;
  }

  /**
   * Validate provider API key
   *
   * Checks if provided API key is authorized to query consent records
   *
   * @param apiKey - API key from Authorization header
   * @returns true if API key is valid and authorized
   */
  validateApiKey(apiKey: string): boolean {
    // TODO: Implement API key validation against provider registry
    // This would query a provider database or in-memory registry
    console.log(`[TODO] Validate API key: ${apiKey?.substring(0, 8)}...`);
    return false; // Default: require implementation
  }

  /**
   * Extract API key from Authorization header
   *
   * Expected format: "Bearer <api_key>"
   *
   * @param authHeader - Authorization header value
   * @returns API key or null if invalid format
   */
  extractApiKey(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    return authHeader.substring("Bearer ".length).trim();
  }
}
