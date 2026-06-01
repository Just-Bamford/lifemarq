import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StellarClient, ConsentRecord } from "./stellar-client";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stellar client
const contractId = process.env.CONTRACT_ID || "";
const network = process.env.NETWORK || "testnet";

if (!contractId) {
  console.error("ERROR: CONTRACT_ID environment variable not set");
  process.exit(1);
}

const stellarClient = new StellarClient(contractId, network);

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

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    network,
    contractId,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /consent/:id_hash
 * Query a donor's consent status
 * Returns consent status and organs if active
 */
app.get("/consent/:id_hash", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;

    // Validate hash format (SHA-256 hex = 64 chars)
    if (!id_hash || id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
      return res.status(400).json({
        error: "Invalid ID hash format (must be 64-char hex SHA-256)",
      });
    }

    // Query the contract
    const record = await stellarClient.getRecord(id_hash);

    const consentActive = record !== null && record.isActive;
    const organs = record?.organs || [];

    // Log to audit trail
    auditLog.push({
      id_hash,
      queried_at: new Date().toISOString(),
      result: {
        consent_active: consentActive,
        organs,
      },
    });

    // Return 200 regardless of consent status
    // A 404 would be ambiguous (could mean record not found or system error)
    res.json({
      id_hash,
      consent_active: consentActive,
      organs,
      queried_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error querying consent:", error);

    // If Soroban RPC is unavailable, return 503
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

/**
 * GET /consent/:id_hash/full
 * Get full consent record (for authorized queries)
 * Requires X-API-Key header (optional for MVP)
 */
app.get("/consent/:id_hash/full", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;
    const apiKey = req.headers["x-api-key"];

    // TODO: Implement API key validation for hospital providers
    // For now, API key is optional
    if (process.env.ENABLE_PROVIDER_AUTH === "true" && !apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    // Validate hash format
    if (!id_hash || id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
      return res.status(400).json({
        error: "Invalid ID hash format (must be 64-char hex SHA-256)",
      });
    }

    // Query the contract
    const result = await stellarClient.getRecord(id_hash);

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

/**
 * GET /audit/queries
 * Retrieve audit log of all queries
 * Returns array of query entries with timestamp and result
 */
app.get("/audit/queries", (req: Request, res: Response) => {
  try {
    // Optional: limit parameter
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

/**
 * Error handling middleware
 */
app.use((err: any, req: Request, res: Response) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(port, () => {
  console.log(`Lifemarq API running on http://localhost:${port}`);
  console.log(`Network: ${network}`);
  console.log(`Contract ID: ${contractId}`);
  console.log(`Endpoints:`);
  console.log(`  GET /health`);
  console.log(`  GET /consent/:id_hash`);
  console.log(`  GET /consent/:id_hash/full`);
  console.log(`  GET /audit/queries`);
});
