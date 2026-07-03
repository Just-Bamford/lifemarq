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
import {
  confirmationTracker,
  ConfirmationStatus,
} from "./confirmation-tracker";
import { VerificationService } from "./verification-service";
import {
  rbacMiddleware,
  requirePermission,
  rbacService,
  Role,
} from "./rbac-service";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(rbacMiddleware); // Apply RBAC authentication

// Initialize Stellar client and consent service
const contractId = process.env.CONTRACT_ID || "";
const network = process.env.NETWORK || "testnet";

if (!contractId) {
  console.error("ERROR: CONTRACT_ID environment variable not set");
  process.exit(1);
}

const stellarClient = new StellarClient(contractId, network);
const consentService = new ConsentService(stellarClient);
const verificationService = new VerificationService(consentService);

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
 * POST /submission/:tx_hash
 * Record a transaction submission (for frontend integration)
 *
 * Called when frontend submits a register/revoke transaction to Stellar
 * Enables backend to track confirmation status
 *
 * Status Codes:
 * - 200: Submission recorded
 * - 400: Invalid parameters
 */
app.post("/submission/:tx_hash", (req: Request, res: Response) => {
  try {
    const { tx_hash } = req.params;
    const { consentHash, wallet, operation } = req.body;

    // Validate required fields
    if (!tx_hash || !consentHash || !wallet || !operation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["register", "revoke"].includes(operation)) {
      return res.status(400).json({ error: "Invalid operation" });
    }

    // Record submission in tracker
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
    console.error("Error recording submission:", error);
    res.status(500).json({ error: "Failed to record submission" });
  }
});

/**
 * GET /submission/:tx_hash
 * Get transaction confirmation status
 *
 * Allows frontend to poll confirmation status of submitted transaction
 *
 * Status Codes:
 * - 200: Confirmation status retrieved
 * - 404: Transaction not found
 */
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
      ledgerHeight: confirmation.ledgerHeight,
      consentActiveOnChain: confirmation.consentActiveOnChain,
    });
  } catch (error: any) {
    console.error("Error fetching submission status:", error);
    res.status(500).json({ error: "Failed to fetch submission status" });
  }
});

/**
 * GET /submission/:tx_hash/confirm
 * Poll and update transaction confirmation status
 *
 * Backend call to check Stellar for transaction confirmation
 * Updates the tracker with current status
 *
 * Status Codes:
 * - 200: Status updated
 * - 404: Transaction not found
 */
app.get("/submission/:tx_hash/confirm", async (req: Request, res: Response) => {
  try {
    const { tx_hash } = req.params;

    const submission = confirmationTracker.getSubmission(tx_hash);
    if (!submission) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Query contract to check current consent state
    const consentActive = await consentService.queryConsent({
      idHash: submission.consentHash,
    });

    // Update confirmation status based on current state
    // In production, would also check Horizon for actual tx confirmation
    const expectedActive = submission.operation === "register" ? true : false;
    const isConfirmed = consentActive === expectedActive;

    confirmationTracker.updateStatus(
      tx_hash,
      isConfirmed ? ConfirmationStatus.CONFIRMED : ConfirmationStatus.PENDING,
      consentActive,
    );

    const confirmation = confirmationTracker.getStatus(tx_hash);

    res.json({
      txHash: tx_hash,
      status: confirmation?.status,
      consentActiveOnChain: consentActive,
      expectedAfterOperation: expectedActive,
      confirmationTime: confirmation?.confirmationTime,
    });
  } catch (error: any) {
    console.error("Error confirming submission:", error);
    res.status(500).json({ error: "Failed to confirm submission" });
  }
});

/**
 * GET /stats/submissions
 * Get submission tracker statistics
 *
 * Returns counts of pending, confirmed, and failed submissions
 *
 * Status Codes:
 * - 200: Statistics retrieved
 */
app.get("/stats/submissions", (req: Request, res: Response) => {
  try {
    const stats = confirmationTracker.getStats();

    res.json({
      totalSubmissions: stats.totalSubmissions,
      pending: stats.pendingCount,
      confirmed: stats.confirmedCount,
      failed: stats.failedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * POST /verify-donor/:id_hash
 * Hospital verification endpoint
 *
 * Hospital systems submit a donor ID hash to verify consent before procedures.
 * Returns verification status and organs list if consent is active.
 *
 * Body:
 * {
 *   "hospitalId": "hospital-001",
 *   "procedureType": "kidney_transplant" (optional)
 * }
 *
 * Response:
 * {
 *   "status": "verified|not_verified|error",
 *   "donorIdHash": "a3f8d2...",
 *   "consentActive": true,
 *   "organs": ["kidney", "liver"],
 *   "verifiedAt": "2025-09-14T10:23:00Z",
 *   "procedureAllowed": true,
 *   "message": "Donor consent verified for: kidney, liver..."
 * }
 *
 * Status Codes:
 * - 200: Verification completed (regardless of result)
 * - 400: Invalid hash format or missing fields
 * - 401: Hospital not authorized
 * - 503: Registry unavailable
 */
app.post(
  "/verify-donor/:id_hash",
  requirePermission("verify_donor"),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id_hash } = req.params;
      const { hospitalId, procedureType } = req.body;

      // Validate hospital can access this endpoint
      if (
        user.role === Role.HOSPITAL &&
        !rbacService.authorizeHospitalAccess(user, hospitalId)
      ) {
        return res.status(403).json({
          error: "Forbidden: Hospital can only verify with own hospitalId",
        });
      }

      // Validate required fields
      if (!id_hash || !hospitalId) {
        return res.status(400).json({
          error: "Missing required fields: id_hash and hospitalId",
        });
      }

      // Validate hash format
      if (id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
        return res.status(400).json({
          error: "Invalid ID hash format (must be 64-char hex SHA-256)",
        });
      }

      // Verify consent and get response
      const verificationResponse = await verificationService.verifyDonor(
        id_hash,
        hospitalId,
        procedureType,
      );

      // Return verification result (always 200, status field indicates result)
      res.json(verificationResponse);
    } catch (error: any) {
      console.error("Error verifying donor:", error);

      if (error instanceof ConsentValidationError) {
        return res.status(400).json({
          error: "Invalid request format",
        });
      }

      if (error instanceof ConsentServiceError) {
        return res.status(503).json({
          status: "error",
          donorIdHash: req.params.id_hash,
          consentActive: false,
          organs: [],
          verifiedAt: new Date().toISOString(),
          procedureAllowed: false,
          message: "Registry unavailable. Cannot verify consent.",
        });
      }

      res.status(503).json({
        status: "error",
        donorIdHash: req.params.id_hash,
        consentActive: false,
        organs: [],
        verifiedAt: new Date().toISOString(),
        procedureAllowed: false,
        message: "Verification service error",
      });
    }
  },
);

/**
 * GET /verify/stats
 * Get verification statistics
 *
 * Returns verification counts and metrics
 *
 * Status Codes:
 * - 200: Statistics retrieved
 */
app.get("/verify/stats", (req: Request, res: Response) => {
  try {
    const stats = verificationService.getVerificationStats();

    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching verification stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
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
  console.log(`  POST /submission/:tx_hash (record submission)`);
  console.log(`  GET /submission/:tx_hash (get status)`);
  console.log(`  GET /submission/:tx_hash/confirm (poll status)`);
  console.log(`  GET /stats/submissions (tracker statistics)`);
  console.log(`  POST /verify-donor/:id_hash (hospital verification)`);
  console.log(`  GET /verify/stats (verification statistics)`);
});
