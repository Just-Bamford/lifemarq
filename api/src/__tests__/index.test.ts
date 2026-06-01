import request from "supertest";
import express, { Request, Response } from "express";
import cors from "cors";
import { StellarClient, ConsentRecord } from "../stellar-client";

// Mock the StellarClient
jest.mock("../stellar-client");

// Create a test app
function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mock StellarClient
  const mockStellarClient = new StellarClient("test-contract-id", "testnet");

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      network: "testnet",
      contractId: "test-contract-id",
      timestamp: new Date().toISOString(),
    });
  });

  // In-memory audit log
  interface AuditEntry {
    id_hash: string;
    queried_at: string;
    result: {
      consent_active: boolean;
      organs: string[];
    };
  }

  const auditLog: AuditEntry[] = [];

  // Query consent status
  app.get("/consent/:id_hash", async (req: Request, res: Response) => {
    try {
      const { id_hash } = req.params;

      if (
        !id_hash ||
        id_hash.length !== 64 ||
        !/^[a-f0-9]{64}$/i.test(id_hash)
      ) {
        return res.status(400).json({
          error: "Invalid ID hash format (must be 64-char hex SHA-256)",
        });
      }

      const record = await mockStellarClient.getRecord(id_hash);

      const consentActive = record !== null && record.isActive;
      const organs = record?.organs || [];

      auditLog.push({
        id_hash,
        queried_at: new Date().toISOString(),
        result: {
          consent_active: consentActive,
          organs,
        },
      });

      res.json({
        id_hash,
        consent_active: consentActive,
        organs,
        queried_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error querying consent:", error);

      if (
        error.message?.includes("network") ||
        error.message?.includes("timeout") ||
        error.message?.includes("ECONNREFUSED")
      ) {
        return res.status(503).json({ error: "registry_unavailable" });
      }

      res.status(503).json({ error: "registry_unavailable" });
    }
  });

  // Get full consent record
  app.get("/consent/:id_hash/full", async (req: Request, res: Response) => {
    try {
      const { id_hash } = req.params;
      const apiKey = req.headers["x-api-key"];

      if (process.env.ENABLE_PROVIDER_AUTH === "true" && !apiKey) {
        return res.status(401).json({ error: "API key required" });
      }

      if (
        !id_hash ||
        id_hash.length !== 64 ||
        !/^[a-f0-9]{64}$/i.test(id_hash)
      ) {
        return res.status(400).json({
          error: "Invalid ID hash format (must be 64-char hex SHA-256)",
        });
      }

      const result = await mockStellarClient.getRecord(id_hash);

      if (!result) {
        return res.status(404).json({ error: "Consent record not found" });
      }

      res.json({
        donor_id_hash: result.donorIdHash,
        wallet: result.wallet,
        organs: result.organs,
        registered_at: result.registeredAt,
        is_active: result.isActive,
      });
    } catch (error: any) {
      console.error("Error fetching full record:", error);

      if (
        error.message?.includes("network") ||
        error.message?.includes("timeout") ||
        error.message?.includes("ECONNREFUSED")
      ) {
        return res.status(503).json({ error: "registry_unavailable" });
      }

      res.status(503).json({ error: "registry_unavailable" });
    }
  });

  // Audit log endpoint
  app.get("/audit/queries", (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

      const recentQueries = auditLog.slice(-limit);

      res.json({
        total: auditLog.length,
        returned: recentQueries.length,
        queries: recentQueries,
      });
    } catch (error: any) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  return app;
}

describe("Lifemarq API", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
      expect(response.body).toHaveProperty("network", "testnet");
      expect(response.body).toHaveProperty("contractId", "test-contract-id");
      expect(response.body).toHaveProperty("timestamp");
    });
  });

  describe("GET /consent/:id_hash", () => {
    it("should return 200 with correct shape for active consent", async () => {
      const mockRecord: ConsentRecord = {
        donorIdHash:
          "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
        wallet: "GAAAA...",
        organs: ["kidney", "liver"],
        registeredAt: 1694700180,
        isActive: true,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const response = await request(app).get(
        "/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id_hash");
      expect(response.body).toHaveProperty("consent_active", true);
      expect(response.body).toHaveProperty("organs");
      expect(response.body.organs).toEqual(["kidney", "liver"]);
      expect(response.body).toHaveProperty("queried_at");
    });

    it("should return 200 with consent_active false for unknown hash", async () => {
      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(
        "/consent/0000000000000000000000000000000000000000000000000000000000000000",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("consent_active", false);
      expect(response.body).toHaveProperty("organs", []);
    });

    it("should return 400 for invalid hash format", async () => {
      const response = await request(app).get("/consent/invalid-hash");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should return 503 on network error", async () => {
      (StellarClient.prototype.getRecord as jest.Mock).mockRejectedValue(
        new Error("network timeout"),
      );

      const response = await request(app).get(
        "/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
      );

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty("error", "registry_unavailable");
    });
  });

  describe("GET /consent/:id_hash/full", () => {
    it("should return 200 with full record", async () => {
      const mockRecord: ConsentRecord = {
        donorIdHash:
          "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
        wallet: "GAAAA...",
        organs: ["kidney", "liver"],
        registeredAt: 1694700180,
        isActive: true,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const response = await request(app).get(
        "/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7/full",
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("donor_id_hash");
      expect(response.body).toHaveProperty("wallet");
      expect(response.body).toHaveProperty("organs");
      expect(response.body).toHaveProperty("registered_at");
      expect(response.body).toHaveProperty("is_active", true);
    });

    it("should return 404 for unknown hash", async () => {
      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(
        "/consent/0000000000000000000000000000000000000000000000000000000000000000/full",
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Consent record not found");
    });
  });

  describe("GET /audit/queries", () => {
    it("should return 200 with array of queries", async () => {
      // Make a query first to populate audit log
      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      await request(app).get(
        "/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
      );

      const response = await request(app).get("/audit/queries");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("total");
      expect(response.body).toHaveProperty("returned");
      expect(response.body).toHaveProperty("queries");
      expect(Array.isArray(response.body.queries)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const response = await request(app).get("/audit/queries?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.returned).toBeLessThanOrEqual(5);
    });
  });

  describe("404 handler", () => {
    it("should return 404 for unknown endpoint", async () => {
      const response = await request(app).get("/unknown-endpoint");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Endpoint not found");
    });
  });
});
