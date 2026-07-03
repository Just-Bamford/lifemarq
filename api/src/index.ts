import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StellarClient } from "./stellar-client";
import {
  ConsentService,
  ConsentServiceError,
  ConsentNotFoundError,
  ConsentValidationError,
} from "./consent-service";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stellar client and consent service
const contractId = process.env.CONTRACT_ID || "";
const network = process.env.NETWORK || "testnet";

if (!contractId) {
  console.error("ERROR: CONTRACT_ID environment variable not set");
  process.exit(1);
}

const stellarClient = new StellarClient(contractId, network);
const consentService = new ConsentService(stellarClient);

/**
 * GET /health
 * Health check endpoint
 *
 * Returns operational status, network, and contract ID
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
 *
 * Public endpoint - no authentication required
 * Returns consent status and organs if active
 *
 * Status Codes:
 * - 200: Record found (consent_active: true or false)
 * - 400: Invalid hash format
 * - 503: Registry unavailable (Stellar network error)
 */
app.get("/consent/:id_hash", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;

    // Use service layer to query consent
    const result = await consentService.queryConsent({
      idHash: id_hash,
    });

    // Always return 200 (not 404) - ambiguous whether record not found or system error
    res.json({
      id_hash: result.idHash,
      consent_active: result.isConsented,
      organs: result.organs,
      queried_at: result.queriedAt,
    });
  } catch (error: any) {
    // Service layer error handling
    if (error instanceof ConsentValidationError) {
      return res.status(400).json({
        error: "Invalid ID hash format (must be 64-char hex SHA-256)",
      });
    }

    if (error instanceof ConsentServiceError) {
      console.error("Consent service error:", error.message);
      return res.status(503).json({ error: "registry_unavailable" });
    }

    console.error("Unexpected error in /consent endpoint:", error);
    res.status(503).json({ error: "registry_unavailable" });
  }
});

/**
 * GET /consent/:id_hash/full
 * Get full consent record (for authorized queries)
 *
 * Requires X-API-Key header (optional for MVP)
 * Returns complete record: wallet, organs, registration timestamp, status
 *
 * Status Codes:
 * - 200: Record found
 * - 400: Invalid hash format
 * - 401: API key invalid or missing (if ENABLE_PROVIDER_AUTH=true)
 * - 404: Record not found
 * - 503: Registry unavailable
 */
app.get("/consent/:id_hash/full", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;
    const apiKey = req.headers["x-api-key"];

    // TODO: Implement API key validation for hospital providers
    if (process.env.ENABLE_PROVIDER_AUTH === "true" && !apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    // Use service layer to get record
    const result = await consentService.getConsentRecord({
      idHash: id_hash,
    });

    res.json({
      donor_id_hash: result.donorIdHash,
      wallet: result.wallet,
      organs: result.organs,
      registered_at: result.registeredAt,
      is_active: result.isActive,
    });
  } catch (error: any) {
    // Service layer error handling
    if (error instanceof ConsentValidationError) {
      return res.status(400).json({
        error: "Invalid ID hash format (must be 64-char hex SHA-256)",
      });
    }

    if (error instanceof ConsentNotFoundError) {
      return res.status(404).json({ error: "Consent record not found" });
    }

    if (error instanceof ConsentServiceError) {
      console.error("Consent service error:", error.message);
      return res.status(503).json({ error: "registry_unavailable" });
    }

    console.error(
      "Unexpected error in /consent/:id_hash/full endpoint:",
      error,
    );
    res.status(503).json({ error: "registry_unavailable" });
  }
});

/**
 * GET /audit/queries
 * Retrieve audit log of all queries
 *
 * Returns array of query entries with timestamp and result
 * Optional limit parameter to control response size (max 1000)
 *
 * Status Codes:
 * - 200: Audit log retrieved
 * - 500: Internal error (unlikely)
 */
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
