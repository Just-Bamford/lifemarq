"use client";

import { useState } from "react";

interface ConsentResult {
  id_hash: string;
  consent_active: boolean;
  organs: string[];
  queried_at: string;
}

export default function HospitalQuery() {
  const [patientIdHash, setPatientIdHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsentResult | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [hasQueried, setHasQueried] = useState(false);

  const handleQuery = async () => {
    if (!patientIdHash.trim()) {
      setMessage("Please enter the patient ID hash");
      setMessageType("error");
      return;
    }

    // Validate hash format (64-char hex)
    if (patientIdHash.length !== 64 || !/^[a-f0-9]{64}$/i.test(patientIdHash)) {
      setMessage(
        "Invalid hash format. Must be 64-character hexadecimal (SHA-256).",
      );
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);
    setHasQueried(true);

    try {
      // Query the hospital API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/consent/${patientIdHash}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ConsentResult = await response.json();
      setResult(data);

      if (data.consent_active) {
        setMessage("Consent record found");
        setMessageType("success");
      } else {
        setMessage("No active consent record found for this patient");
        setMessageType("info");
      }
    } catch (error: any) {
      setMessage(
        error.message?.includes("API error")
          ? "Unable to reach the registry. Please try again."
          : "Error querying consent record",
      );
      setMessageType("error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPatientIdHash("");
    setResult(null);
    setMessage("");
    setHasQueried(false);
  };

  return (
    <div>
      <div className="card">
        <h2>Hospital Consent Query</h2>
        <p>Query a patient's organ donation consent status before surgery.</p>
      </div>

      <div className="card">
        {message && <div className={`alert ${messageType}`}>{message}</div>}

        <div className="form-group">
          <label htmlFor="patientIdHash">Patient ID Hash (SHA-256)</label>
          <input
            id="patientIdHash"
            type="text"
            placeholder="Enter hashed patient ID (64-char hex)"
            value={patientIdHash}
            onChange={(e) => setPatientIdHash(e.target.value.toLowerCase())}
            disabled={loading}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Enter the SHA-256 hash of the patient's national ID
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleQuery} disabled={loading} style={{ flex: 1 }}>
            {loading ? "Querying..." : "Query Consent Status"}
          </button>
          {hasQueried && (
            <button
              onClick={handleClear}
              disabled={loading}
              style={{ backgroundColor: "#6c757d" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Consent Status</h3>

          {result.consent_active ? (
            <div
              style={{
                padding: "20px",
                backgroundColor: "#d4edda",
                borderRadius: "4px",
                borderLeft: "4px solid #28a745",
              }}
            >
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  marginBottom: "15px",
                  color: "#155724",
                }}
              >
                ✓ Consent Active
              </p>

              <div style={{ marginBottom: "15px" }}>
                <p style={{ marginBottom: "10px", fontWeight: "500" }}>
                  Organs registered for donation:
                </p>
                <ul
                  style={{
                    marginLeft: "20px",
                    color: "#155724",
                  }}
                >
                  {result.organs.map((organ) => (
                    <li key={organ}>
                      {organ.charAt(0).toUpperCase() + organ.slice(1)}
                    </li>
                  ))}
                </ul>
              </div>

              <p style={{ fontSize: "12px", color: "#155724" }}>
                This consent is immutable and protected by the Stellar
                blockchain. Family members cannot override this decision.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: "20px",
                backgroundColor: "#e2e3e5",
                borderRadius: "4px",
                borderLeft: "4px solid #6c757d",
              }}
            >
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                  color: "#383d41",
                }}
              >
                No Active Consent Found
              </p>

              <p style={{ color: "#383d41", marginBottom: "10px" }}>
                This patient does not have an active organ donation consent
                registered in the system.
              </p>

              <p style={{ fontSize: "12px", color: "#383d41" }}>
                This does not mean the patient is not a donor — they may have
                registered through another system or have not yet registered.
              </p>
            </div>
          )}

          <p
            style={{
              marginTop: "15px",
              fontSize: "12px",
              color: "#666",
            }}
          >
            Queried: {new Date(result.queried_at).toLocaleString()}
          </p>
        </div>
      )}

      <div className="card">
        <h3>How to Use</h3>
        <ol style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>Obtain the patient's national ID</li>
          <li>Hash it using SHA-256 to get a 64-character hex string</li>
          <li>Enter the hash above and click "Query Consent Status"</li>
          <li>The system will return the patient's consent status instantly</li>
        </ol>
      </div>

      <div className="card">
        <h3>Important Notes</h3>
        <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>This query is read-only and does not require authentication</li>
          <li>All queries are logged for audit and compliance purposes</li>
          <li>
            Consent status is verified directly from the Stellar blockchain
          </li>
          <li>Family members cannot override a registered decision</li>
          <li>Results are returned in real-time</li>
        </ul>
      </div>
    </div>
  );
}
