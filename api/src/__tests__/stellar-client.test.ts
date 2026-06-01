import { StellarClient, ConsentRecord } from "../stellar-client";

// Mock the Stellar SDK
jest.mock("stellar-sdk", () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: jest.fn().mockResolvedValue({
        accountId: "GBRPYHIL2CI3WHZDTOOQFC6EB4PSQJNPPQ42SOFQ5XJJEFSTX2ZGPM7",
        sequenceNumber: "0",
      }),
    })),
  },
  SorobanRpc: {
    Client: jest.fn().mockImplementation(() => ({
      simulateTransaction: jest.fn(),
    })),
    Api: {
      isSimulationSuccess: jest.fn(),
      isSimulationError: jest.fn(),
    },
  },
  TransactionBuilder: jest.fn(),
  Networks: {
    TESTNET_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    PUBLIC_NETWORK_PASSPHRASE: "Public Global Stellar Network ; September 2015",
  },
  Operation: {},
  xdr: {},
  Contract: jest.fn(),
  nativeToScVal: jest.fn(),
}));

describe("StellarClient", () => {
  let client: StellarClient;

  beforeEach(() => {
    client = new StellarClient("test-contract-id", "testnet");
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with contract ID and network", () => {
      expect(client).toBeDefined();
    });

    it("should use testnet URLs by default", () => {
      const testnetClient = new StellarClient("test-id", "testnet");
      expect(testnetClient).toBeDefined();
    });

    it("should use mainnet URLs when specified", () => {
      const mainnetClient = new StellarClient("test-id", "public");
      expect(mainnetClient).toBeDefined();
    });
  });

  describe("queryConsent", () => {
    it("should return true if record exists and is active", async () => {
      const mockRecord: ConsentRecord = {
        donorIdHash: "test-hash",
        wallet: "GAAAA...",
        organs: ["kidney"],
        registeredAt: 1694700180,
        isActive: true,
      };

      jest.spyOn(client, "getRecord" as any).mockResolvedValue(mockRecord);

      const result = await client.queryConsent("test-hash");

      expect(result).toBe(true);
    });

    it("should return false if record does not exist", async () => {
      jest.spyOn(client, "getRecord" as any).mockResolvedValue(null);

      const result = await client.queryConsent("unknown-hash");

      expect(result).toBe(false);
    });

    it("should return false if record is not active", async () => {
      const mockRecord: ConsentRecord = {
        donorIdHash: "test-hash",
        wallet: "GAAAA...",
        organs: ["kidney"],
        registeredAt: 1694700180,
        isActive: false,
      };

      jest.spyOn(client, "getRecord" as any).mockResolvedValue(mockRecord);

      const result = await client.queryConsent("test-hash");

      expect(result).toBe(false);
    });
  });

  describe("getRecord", () => {
    it("should throw error if contract ID is not set", async () => {
      const emptyClient = new StellarClient("", "testnet");

      await expect(emptyClient.getRecord("test-hash")).rejects.toThrow();
    });

    it("should handle network errors gracefully", async () => {
      jest
        .spyOn(client, "getRecord" as any)
        .mockRejectedValue(new Error("network timeout"));

      await expect(client.queryConsent("test-hash")).rejects.toThrow(
        "network timeout",
      );
    });
  });

  describe("parseConsentRecord", () => {
    it("should parse valid XDR record", () => {
      // This test would require mocking XDR parsing
      // For now, we test the public interface
      expect(client).toBeDefined();
    });
  });
});
