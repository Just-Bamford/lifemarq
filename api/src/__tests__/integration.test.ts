/**
 * Integration tests for the full donor → contract → verification flow
 * Tests the complete lifecycle: registration, query, and revocation
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { StellarClient, ConsentRecord } from "../stellar-client";
import { ConsentService } from "../consent-service";
import { VerificationService } from "../verification-service";
import {
  confirmationTracker,
  ConfirmationStatus,
} from "../confirmation-tracker";

// Mock the StellarClient
jest.mock("../stellar-client");

// Create a test app that mirrors the production setup
function createIntegrationTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mock middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).user = { id: "test-user", role: "donor" };
    (req as any).ip = "127.0.0.1";
    next();
  });

  const mockStellarClient = new StellarClient("test-contract-id", "testnet");
  const consentService = new ConsentService(mockStellarClient);
  const verificationService = new VerificationService(consentService);

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      network: "testnet",
      contractId: "test-contract-id",
      timestamp: new Date().toISOString(),
    });
  });

  // Register donor consent
  app.post("/consent/register", async (req: Request, res: Response) => {
    try {
      const { idHash, wallet, organs } = req.body;

      if (!idHash || !wallet || !organs) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (idHash.length !== 64 || !/^[a-f0-9]{64}$/i.test(idHash)) {
        return res.status(400).json({
          error: "Invalid ID hash format (must be 64-char hex SHA-256)",
        });
      }

      // Mock contract interaction
      const result = await consentService.registerConsent({
        idHash,
        wallet,
        organs,
      });

      res.json({
        status: "registered",
        idHash,
        wallet,
        organs,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

      const result = await consentService.queryConsent({ idHash: id_hash });

      res.json({
        id_hash,
        consent_active: result.isConsented,
        organs: result.organs,
        queried_at: result.queriedAt,
      });
    } catch (error: any) {
      res.status(503).json({ error: "registry_unavailable" });
    }
  });

  // Revoke consent
  app.post("/consent/:id_hash/revoke", async (req: Request, res: Response) => {
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

      // Mock contract interaction
      const result = await consentService.revokeConsent({ idHash: id_hash });

      res.json({
        status: "revoked",
        idHash: id_hash,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Record submission
  app.post("/submission/:tx_hash", (req: Request, res: Response) => {
    try {
      const { tx_hash } = req.params;
      const { consentHash, wallet, operation } = req.body;

      if (!tx_hash || !consentHash || !wallet || !operation) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      confirmationTracker.recordSubmission(
        tx_hash,
        consentHash,
        wallet,
        operation as "register" | "revoke",
      );

      res.json({
        status: "recorded",
        txHash: tx_hash,
        consentHash,
        operation,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get submission status
  app.get("/submission/:tx_hash", (req: Request, res: Response) => {
    try {
      const { tx_hash } = req.params;

      const confirmation = confirmationTracker.getStatus(tx_hash);
      const submission = confirmationTracker.getSubmission(tx_hash);

      if (!confirmation) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({
        txHash: tx_hash,
        status: confirmation.status,
        operation: submission?.operation,
        consentHash: submission?.consentHash,
        wallet: submission?.wallet,
        submittedAt: submission?.submittedAt,
        confirmationTime: confirmation.confirmationTime,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Verify donor
  app.post("/verify-donor/:id_hash", async (req: Request, res: Response) => {
    try {
      const { id_hash } = req.params;
      const { hospitalId } = req.body;

      if (!id_hash || !hospitalId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
        return res.status(400).json({
          error: "Invalid ID hash format (must be 64-char hex SHA-256)",
        });
      }

      const result = await verificationService.verifyDonor(
        id_hash,
        hospitalId,
        undefined,
        "test-req-id",
        "127.0.0.1",
        "test-user-agent",
      );

      res.json(result);
    } catch (error: any) {
      res.status(503).json({
        status: "error",
        donorIdHash: req.params.id_hash,
        consentActive: false,
        organs: [],
        verifiedAt: new Date().toISOString(),
        procedureAllowed: false,
        message: error.message,
      });
    }
  });

  // Get audit log
  app.get("/audit/queries", (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const queries = consentService.getAuditLog(limit);

      res.json({
        total: consentService.getFullAuditLog().length,
        returned: queries.length,
        queries,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Endpoint not found" });
  });

  return app;
}

describe("Lifemarq Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createIntegrationTestApp();
    jest.clearAllMocks();
    confirmationTracker.clear();
  });

  describe("Full Donor Registration Flow", () => {
    it("should complete full donor registration → query → verification workflow", async () => {
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
      const wallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      const organs = ["kidney", "liver"];
      const txHash = "tx123456789abcdef";

      // Step 1: Register consent (donor performs)
      const registerResponse = await request(app)
        .post("/consent/register")
        .send({
          idHash: donorHash,
          wallet,
          organs,
        });

      expect(registerResponse.status).toBe(200);
      expect(registerResponse.body).toHaveProperty("status", "registered");
      expect(registerResponse.body).toHaveProperty("idHash", donorHash);

      // Step 2: Record transaction submission
      const submissionResponse = await request(app)
        .post(`/submission/${txHash}`)
        .send({
          consentHash: donorHash,
          wallet,
          operation: "register",
        });

      expect(submissionResponse.status).toBe(200);
      expect(submissionResponse.body).toHaveProperty("status", "recorded");
      expect(submissionResponse.body).toHaveProperty("txHash", txHash);

      // Step 3: Mock contract registration
      const mockRecord: ConsentRecord = {
        donorIdHash: donorHash,
        wallet,
        organs,
        registeredAt: Math.floor(Date.now() / 1000),
        isActive: true,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      // Step 4: Hospital queries consent
      const queryResponse = await request(app).get(`/consent/${donorHash}`);

      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body).toHaveProperty("consent_active", true);
      expect(queryResponse.body).toHaveProperty("organs");
      expect(queryResponse.body.organs).toEqual(organs);

      // Step 5: Hospital verifies donor for procedure
      const verifyResponse = await request(app)
        .post(`/verify-donor/${donorHash}`)
        .send({
          hospitalId: "hospital-001",
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty("status", "verified");
      expect(verifyResponse.body).toHaveProperty("consentActive", true);
      expect(verifyResponse.body).toHaveProperty("organs");

      // Step 6: Verify audit log recorded the query
      const auditResponse = await request(app).get("/audit/queries");

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.body).toHaveProperty("queries");
      expect(Array.isArray(auditResponse.body.queries)).toBe(true);
    });

    it("should handle unknown donor (not yet registered)", async () => {
      const unknownHash =
        "0000000000000000000000000000000000000000000000000000000000000000";

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get(`/consent/${unknownHash}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("consent_active", false);
      expect(response.body).toHaveProperty("organs", []);
    });

    it("should validate hash format in all endpoints", async () => {
      const invalidHash = "invalid-hash";

      // Register
      const registerResponse = await request(app)
        .post("/consent/register")
        .send({
          idHash: invalidHash,
          wallet: "GAAAA...",
          organs: ["kidney"],
        });
      expect(registerResponse.status).toBe(400);

      // Query
      const queryResponse = await request(app).get(`/consent/${invalidHash}`);
      expect(queryResponse.status).toBe(400);

      // Revoke
      const revokeResponse = await request(app)
        .post(`/consent/${invalidHash}/revoke`)
        .send({});
      expect(revokeResponse.status).toBe(400);

      // Verify
      const verifyResponse = await request(app)
        .post(`/verify-donor/${invalidHash}`)
        .send({ hospitalId: "hospital-001" });
      expect(verifyResponse.status).toBe(400);
    });
  });

  describe("Transaction Confirmation Tracking", () => {
    it("should track submission through confirmation", async () => {
      const txHash = "tx_abc123";
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
      const wallet = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

      // Record submission
      const recordResponse = await request(app)
        .post(`/submission/${txHash}`)
        .send({
          consentHash: donorHash,
          wallet,
          operation: "register",
        });

      expect(recordResponse.status).toBe(200);

      // Get submission status (should be pending initially)
      const statusResponse = await request(app).get(`/submission/${txHash}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty("status");
      expect(statusResponse.body).toHaveProperty("txHash", txHash);
      expect(statusResponse.body).toHaveProperty("operation", "register");
      expect(statusResponse.body).toHaveProperty("consentHash", donorHash);
      expect(statusResponse.body).toHaveProperty("wallet", wallet);
    });

    it("should return 404 for unknown transaction", async () => {
      const response = await request(app).get("/submission/unknown_tx_hash");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Transaction not found");
    });

    it("should track multiple submissions independently", async () => {
      const tx1 = "tx_1";
      const tx2 = "tx_2";
      const hash1 =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
      const hash2 =
        "b4f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f8";

      // Record two submissions
      await request(app).post(`/submission/${tx1}`).send({
        consentHash: hash1,
        wallet: "GAAAA...",
        operation: "register",
      });

      await request(app).post(`/submission/${tx2}`).send({
        consentHash: hash2,
        wallet: "GBBBB...",
        operation: "revoke",
      });

      // Verify they're tracked separately
      const status1 = await request(app).get(`/submission/${tx1}`);
      const status2 = await request(app).get(`/submission/${tx2}`);

      expect(status1.body.consentHash).toBe(hash1);
      expect(status2.body.consentHash).toBe(hash2);
      expect(status1.body.operation).toBe("register");
      expect(status2.body.operation).toBe("revoke");
    });
  });

  describe("Consent Revocation Flow", () => {
    it("should revoke active consent", async () => {
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";

      // Mock active consent
      const activeRecord: ConsentRecord = {
        donorIdHash: donorHash,
        wallet: "GAAAA...",
        organs: ["kidney", "liver"],
        registeredAt: Math.floor(Date.now() / 1000),
        isActive: true,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        activeRecord,
      );

      // Verify consent is active
      let queryResponse = await request(app).get(`/consent/${donorHash}`);
      expect(queryResponse.body.consent_active).toBe(true);

      // Revoke consent
      const revokeResponse = await request(app)
        .post(`/consent/${donorHash}/revoke`)
        .send({});

      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body).toHaveProperty("status", "revoked");

      // Mock revocation (consent now inactive)
      const revokedRecord: ConsentRecord = {
        ...activeRecord,
        isActive: false,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        revokedRecord,
      );

      // Verify consent is now inactive
      queryResponse = await request(app).get(`/consent/${donorHash}`);
      expect(queryResponse.body.consent_active).toBe(false);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should return 503 when contract query fails", async () => {
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";

      (StellarClient.prototype.getRecord as jest.Mock).mockRejectedValue(
        new Error("Network timeout"),
      );

      const response = await request(app).get(`/consent/${donorHash}`);

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty("error", "registry_unavailable");
    });

    it("should handle missing required fields in registration", async () => {
      const response = await request(app).post("/consent/register").send({
        idHash:
          "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
        // Missing wallet and organs
      });

      expect(response.status).toBe(400);
    });

    it("should handle missing fields in submission recording", async () => {
      const response = await request(app).post("/submission/tx_hash").send({
        consentHash:
          "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
        // Missing wallet and operation
      });

      expect(response.status).toBe(400);
    });

    it("should return 404 for unknown endpoint", async () => {
      const response = await request(app).get("/unknown-endpoint");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Endpoint not found");
    });
  });

  describe("Hospital Verification Flow", () => {
    it("should verify donor and allow procedure for active consent", async () => {
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
      const organs = ["kidney"];

      const mockRecord: ConsentRecord = {
        donorIdHash: donorHash,
        wallet: "GAAAA...",
        organs,
        registeredAt: Math.floor(Date.now() / 1000),
        isActive: true,
      };

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
        mockRecord,
      );

      const response = await request(app)
        .post(`/verify-donor/${donorHash}`)
        .send({
          hospitalId: "hospital-001",
          procedureType: "kidney_transplant",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "verified");
      expect(response.body).toHaveProperty("consentActive", true);
      expect(response.body).toHaveProperty("procedureAllowed", true);
      expect(response.body.organs).toContain("kidney");
    });

    it("should deny verification for no consent", async () => {
      const donorHash =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post(`/verify-donor/${donorHash}`)
        .send({
          hospitalId: "hospital-001",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "not_verified");
      expect(response.body).toHaveProperty("consentActive", false);
      expect(response.body).toHaveProperty("procedureAllowed", false);
    });
  });

  describe("Audit Logging", () => {
    it("should log all consent queries to audit log", async () => {
      const hash1 =
        "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7";
      const hash2 =
        "b4f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f8";

      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      // Make two queries
      await request(app).get(`/consent/${hash1}`);
      await request(app).get(`/consent/${hash2}`);

      // Check audit log
      const auditResponse = await request(app).get("/audit/queries");

      expect(auditResponse.status).toBe(200);
      expect(Array.isArray(auditResponse.body.queries)).toBe(true);
      expect(auditResponse.body.queries.length).toBeGreaterThanOrEqual(2);
    });

    it("should respect audit log limit parameter", async () => {
      (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(null);

      // Make multiple queries
      for (let i = 0; i < 10; i++) {
        const hash = `${"a".repeat(63)}${i}`;
        await request(app).get(`/consent/${hash}`);
      }

      // Get audit log with limit
      const response = await request(app).get("/audit/queries?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.returned).toBeLessThanOrEqual(5);
    });
  });
});
