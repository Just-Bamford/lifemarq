import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StellarClient } from "./stellar-client";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stellar client
const stellarClient = new StellarClient(
  process.env.CONTRACT_ID || "",
  process.env.NETWORK || "testnet",
);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Query consent status
app.get("/consent/:id_hash", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;

    if (!id_hash || id_hash.length !== 64) {
      return res
        .status(400)
        .json({ error: "Invalid ID hash format (must be 64-char hex)" });
    }

    // Query the Soroban contract
    const result = await stellarClient.queryConsent(id_hash);

    res.json({
      active: result.active,
      organs: result.organs || [],
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    console.error("Error querying consent:", error);
    res.status(500).json({ error: "Failed to query consent record" });
  }
});

// Get full consent record (for authorized queries)
app.get("/consent/:id_hash/full", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params;
    const apiKey = req.headers["x-api-key"];

    // TODO: Implement API key validation for hospital providers
    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const result = await stellarClient.getFullRecord(id_hash);

    if (!result) {
      return res.status(404).json({ error: "Consent record not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching full record:", error);
    res.status(500).json({ error: "Failed to fetch consent record" });
  }
});

// Audit log endpoint (for compliance)
app.get("/audit/queries", (req: Request, res: Response) => {
  // TODO: Implement audit log retrieval
  res.json({ queries: [] });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(port, () => {
  console.log(`Lifemarq API running on http://localhost:${port}`);
  console.log(`Contract ID: ${process.env.CONTRACT_ID}`);
  console.log(`Network: ${process.env.NETWORK}`);
});
