/**
 * Freighter wallet integration for Lifemarq
 * Handles wallet connection, signing, and transaction submission
 */

declare global {
  interface Window {
    freighter?: {
      getPublicKey(): Promise<string>;
      isConnected(): Promise<boolean>;
      signTransaction(
        xdr: string,
        options: { network: string },
      ): Promise<string>;
    };
  }
}

/**
 * Validate that Freighter is available
 * @throws Error if Freighter extension not installed
 */
function ensureFreighter(): void {
  if (!window.freighter) {
    throw new Error(
      "Freighter wallet not found. Please install the Freighter browser extension from https://freighter.app",
    );
  }
}

/**
 * Connect to Freighter wallet
 * Returns the public key (wallet address)
 * Throws error if Freighter is not installed or connection fails
 */
export async function connectWallet(): Promise<string> {
  ensureFreighter();

  try {
    const publicKey = await window.freighter!.getPublicKey();
    if (!publicKey || publicKey.length === 0) {
      throw new Error("Wallet returned empty public key");
    }
    return publicKey;
  } catch (error: any) {
    throw new Error(
      `Failed to connect wallet: ${error.message || "Unknown error"}`,
    );
  }
}

/**
 * Check if wallet is connected
 */
export async function isConnected(): Promise<boolean> {
  if (!window.freighter) {
    return false;
  }

  try {
    return await window.freighter.isConnected();
  } catch (error) {
    return false;
  }
}

/**
 * Sign a transaction with Freighter
 * @param xdr - Transaction XDR string
 * @param network - Network name (e.g., "testnet", "public")
 * @returns Signed transaction XDR string
 * @throws Error if signing fails or wallet not available
 */
export async function signTransaction(
  xdr: string,
  network: string,
): Promise<string> {
  ensureFreighter();

  if (!xdr || xdr.length === 0) {
    throw new Error("Transaction XDR cannot be empty");
  }

  if (!network || network.length === 0) {
    throw new Error("Network name must be specified");
  }

  try {
    const signedXdr = await window.freighter!.signTransaction(xdr, { network });
    if (!signedXdr || signedXdr.length === 0) {
      throw new Error("Signing returned empty result");
    }
    return signedXdr;
  } catch (error: any) {
    throw new Error(
      `Failed to sign transaction: ${error.message || "Unknown error"}`,
    );
  }
}

/**
 * Hash a national ID using SHA-256
 * @param nationalId - National ID string to hash
 * @returns Hex string of SHA-256 hash (64 characters)
 * @throws Error if hashing fails
 */
export async function hashNationalId(nationalId: string): Promise<string> {
  if (!nationalId || nationalId.length === 0) {
    throw new Error("National ID cannot be empty");
  }

  try {
    const encoded = new TextEncoder().encode(nationalId.trim().toUpperCase());
    const buffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(buffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hashHex.length !== 64) {
      throw new Error("Hash generation produced invalid length");
    }

    return hashHex;
  } catch (error: any) {
    throw new Error(
      `Failed to hash national ID: ${error.message || "Unknown error"}`,
    );
  }
}

/**
 * Validate SHA-256 hash format
 * @param hash - Hash string to validate
 * @returns true if valid 64-character hex string
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Truncate a public key for display
 * e.g., GAAAA...ZZZZZ
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address || address.length <= chars * 2 + 3) {
    return address || "";
  }
  return `${address.substring(0, chars)}...${address.substring(
    address.length - chars,
  )}`;
}
