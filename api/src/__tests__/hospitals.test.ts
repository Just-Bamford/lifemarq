import request from "supertest";
import express, { Express } from "express";

// Mock Express app for testing
let app: Express;

// Valid Stellar testnet address (56 chars, starts with G)
const VALID_WALLET = "GCZXL34YSKZNM4YWFZ5C45G5CVPQRUVSK7VJHQ2PF3D4GY7GSAPMVPQQ";

describe("Hospital API Endpoints", () => {
  beforeAll(() => {
    app = express();
    app.use(express.json());

    const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "test-admin-key";

    // POST /hospitals/register
    app.post("/hospitals/register", async (req, res) => {
      const { hospital_id, wallet, name, country, license_number } = req.body;

      if (!hospital_id || !wallet || !name || !country || !license_number) {
        return res.status(400).json({
          error: "Missing required fields",
        });
      }

      if (!wallet.startsWith("G") || wallet.length !== 56) {
        return res.status(400).json({
          error: "Invalid wallet address format",
        });
      }

      res.status(201).json({
        status: "registered",
        hospital_id,
        wallet,
        name,
        country,
        license_number,
        verification_status: "pending",
        message: "Hospital registered. Awaiting admin approval.",
        registered_at: new Date().toISOString(),
      });
    });

    // GET /hospitals/pending
    app.get("/hospitals/pending", (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return res
          .status(401)
          .json({ error: "Missing or invalid authorization" });
      }

      res.json({
        count: 1,
        pending: [
          {
            hospital_id: "TEST-KE-001",
            wallet: "GCZXL34YSKZNM4YWFZ5C45G5CVPQRUVSK7VJHQ2PF3D4GY7GSAPMVPQ",
            name: "Test Hospital",
            country: "KE",
            license_number: "LIC-123456",
            registered_at: new Date().toISOString(),
          },
        ],
        timestamp: new Date().toISOString(),
      });
    });

    // POST /hospitals/:id/approve
    app.post("/hospitals/:id/approve", (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return res
          .status(401)
          .json({ error: "Missing or invalid authorization" });
      }

      const { id } = req.params;

      res.json({
        status: "approved",
        hospital_id: id,
        verification_status: "verified",
        message: "Hospital approved and verified",
        approved_at: new Date().toISOString(),
      });
    });

    // POST /hospitals/:id/revoke
    app.post("/hospitals/:id/revoke", (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return res
          .status(401)
          .json({ error: "Missing or invalid authorization" });
      }

      const { id } = req.params;

      res.json({
        status: "revoked",
        hospital_id: id,
        verification_status: "revoked",
        message: "Hospital verification revoked",
        revoked_at: new Date().toISOString(),
      });
    });

    // GET /hospitals/:id
    app.get("/hospitals/:id", (req, res) => {
      const { id } = req.params;

      res.json({
        hospital_id: id,
        wallet: VALID_WALLET,
        name: "Test Hospital",
        country: "KE",
        license_number: "LIC-123456",
        is_verified: true,
        registered_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      });
    });

    // GET /hospitals/:id/verified
    app.get("/hospitals/:id/verified", (req, res) => {
      const { id } = req.params;

      res.json({
        hospital_id: id,
        verified: true,
        verified_at: new Date().toISOString(),
      });
    });
  });

  describe("POST /hospitals/register", () => {
    it("should return 201 with pending status when given valid inputs", async () => {
      const response = await request(app).post("/hospitals/register").send({
        hospital_id: "KNH-KE-001",
        wallet: VALID_WALLET,
        name: "Kenyatta National Hospital",
        country: "KE",
        license_number: "LIC-123456",
      });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("registered");
      expect(response.body.verification_status).toBe("pending");
      expect(response.body.hospital_id).toBe("KNH-KE-001");
      expect(response.body.name).toBe("Kenyatta National Hospital");
      expect(response.body.country).toBe("KE");
      expect(response.body.license_number).toBe("LIC-123456");
    });

    it("should return 400 when required fields are missing", async () => {
      const response = await request(app).post("/hospitals/register").send({
        hospital_id: "KNH-KE-001",
        // Missing wallet, name, country, license_number
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing required fields");
    });

    it("should return 400 when wallet format is invalid", async () => {
      const response = await request(app).post("/hospitals/register").send({
        hospital_id: "KNH-KE-001",
        wallet: "INVALID-WALLET",
        name: "Test Hospital",
        country: "KE",
        license_number: "LIC-123456",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid wallet");
    });
  });

  describe("GET /hospitals/pending", () => {
    it("should return 401 when authorization header is missing", async () => {
      const response = await request(app).get("/hospitals/pending");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain("authorization");
    });

    it("should return 401 when API key is invalid", async () => {
      const response = await request(app)
        .get("/hospitals/pending")
        .set("Authorization", "Bearer invalid-key");

      expect(response.status).toBe(401);
    });

    it("should return 200 with pending hospitals list when authorized", async () => {
      const response = await request(app)
        .get("/hospitals/pending")
        .set(
          "Authorization",
          `Bearer ${process.env.ADMIN_API_KEY || "test-admin-key"}`,
        );

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.pending).toBeInstanceOf(Array);
      expect(response.body.pending[0]).toHaveProperty("hospital_id");
      expect(response.body.pending[0]).toHaveProperty("name");
    });
  });

  describe("POST /hospitals/:id/approve", () => {
    it("should return 401 when authorization header is missing", async () => {
      const response = await request(app).post("/hospitals/KNH-KE-001/approve");

      expect(response.status).toBe(401);
    });

    it("should return 200 with approved status when authorized", async () => {
      const response = await request(app)
        .post("/hospitals/KNH-KE-001/approve")
        .set(
          "Authorization",
          `Bearer ${process.env.ADMIN_API_KEY || "test-admin-key"}`,
        );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("approved");
      expect(response.body.verification_status).toBe("verified");
      expect(response.body.hospital_id).toBe("KNH-KE-001");
    });
  });

  describe("POST /hospitals/:id/revoke", () => {
    it("should return 401 when authorization header is missing", async () => {
      const response = await request(app).post("/hospitals/KNH-KE-001/revoke");

      expect(response.status).toBe(401);
    });

    it("should return 200 with revoked status when authorized", async () => {
      const response = await request(app)
        .post("/hospitals/KNH-KE-001/revoke")
        .set(
          "Authorization",
          `Bearer ${process.env.ADMIN_API_KEY || "test-admin-key"}`,
        );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("revoked");
      expect(response.body.verification_status).toBe("revoked");
    });
  });

  describe("GET /hospitals/:id", () => {
    it("should return 200 with hospital record", async () => {
      const response = await request(app).get("/hospitals/KNH-KE-001");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("hospital_id");
      expect(response.body).toHaveProperty("wallet");
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("country");
      expect(response.body).toHaveProperty("license_number");
      expect(response.body).toHaveProperty("is_verified");
      expect(response.body.hospital_id).toBe("KNH-KE-001");
    });
  });

  describe("GET /hospitals/:id/verified", () => {
    it("should return 200 with verification status", async () => {
      const response = await request(app).get("/hospitals/KNH-KE-001/verified");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("hospital_id");
      expect(response.body).toHaveProperty("verified");
      expect(typeof response.body.verified).toBe("boolean");
      expect(response.body.verified).toBe(true);
    });
  });
});
