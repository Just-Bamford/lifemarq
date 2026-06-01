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
 * Connect to Freighter wallet
 * Returns the public key (wallet address)
 * Throws error if Freighter is not installed
 */
export async function connectWallet(): Promise<string> {
  if (!window.freighter) {
    throw new Error(
      "Freighter wallet not found. Please install the Freighter browser extension from https://freighter.app",
    );
  }

  try {
    const publicKey = await window.freighter.getPublicKey();
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
 */
export async function signTransaction(
  xdr: string,
  network: string,
): Promise<string> {
  if (!window.freighter) {
    throw new Error("Freighter wallet not found");
  }

  try {
    const signedXdr = await window.freighter.signTransaction(xdr, { network });
    return signedXdr;
  } catch (error: any) {
    throw new Error(
      `Failed to sign transaction: ${error.message || "Unknown error"}`,
    );
  }
}

/**
 * Hash a national ID using SHA-256
 * Returns hex string
 */
export async function hashNationalId(nationalId: string): Promise<string> {
  const encoded = new TextEncoder().encode(nationalId.trim().toUpperCase());
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Truncate a public key for display
 * e.g., GAAAA...ZZZZZ
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) {
    return address;
  }
  return `${address.substring(0, chars)}...${address.substring(
    address.length - chars,
  )}`;
}
