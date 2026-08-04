"use client";

import { useState } from "react";

interface ConsentResult {
  id_hash: string;
  consent_active: boolean;
  organs: string[];
  queried_at: string;
}

type QueryState = "idle" | "loading" | "success" | "error" | "not_found";

interface QueryLogEntry {
  timestamp: string;
  idHash: string;
  consentActive: boolean;
  organs: string[];
}

export default function HospitalQuery() {
  const [patientIdHash, setPatientIdHash] = useState("");
  const [state, setState] = useState<QueryState>("idle");
  const [result, setResult] = useState<ConsentResult | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [hasQueried, setHasQueried] = useState(false);
  const [queryLog, setQueryLog] = useState<QueryLogEntry[]>([]);

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

    setState("loading");
    setMessage("");
    setResult(null);
    setHasQueried(true);

    try {
      // Query the hospital API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/consent/${patientIdHash}`);

      if (!response.ok) {
        if (response.status === 503) {
          setState("error");
          setMessage(
            "Registry unavailable - Stellar network may be down. Please retry.",
          );
          setMessageType("error");
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data: ConsentResult = await response.json();
      setResult(data);

      // Add to query log
      setQueryLog((prev) =>
        [
          {
            timestamp: new Date().toLocaleTimeString(),
            idHash: patientIdHash,
            consentActive: data.consent_active,
            organs: data.organs,
          },
          ...prev,
        ].slice(0, 20),
      ); // Keep last 20 queries

      if (data.consent_active) {
        setState("success");
        setMessage(
          `✓ Consent verified: ${data.organs.length} organ(s) available`,
        );
        setMessageType("success");
      } else {
        setState("not_found");
        setMessage("No active consent record found");
        setMessageType("info");
      }
    } catch (error: any) {
      console.error("Query error:", error);
      setState("error");
      setMessage(error.message || "Error querying consent record");
      setMessageType("error");
      setResult(null);
    }
  };

  const handleClear = () => {
    setPatientIdHash("");
    setResult(null);
    setMessage("");
    setHasQueried(false);
    setState("idle");
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
            disabled={state === "loading"}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Enter the SHA-256 hash of the patient's national ID
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleQuery}
            disabled={state === "loading"}
            style={{ flex: 1 }}
          >
            {state === "loading" ? "Querying..." : "Query Consent Status"}
          </button>
          {hasQueried && (
            <button
              onClick={handleClear}
              disabled={state === "loading"}
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

      {queryLog.length > 0 && (
        <div className="card">
          <h3>Query History (This Session)</h3>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>
            Last {queryLog.length} queries
          </p>
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            <table
              style={{
                width: "100%",
                fontSize: "12px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f5f5f5",
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <th style={{ padding: "8px", textAlign: "left" }}>Time</th>
                  <th style={{ padding: "8px", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "8px", textAlign: "left" }}>
                    Hash (first 8)
                  </th>
                </tr>
              </thead>
              <tbody>
                {queryLog.map((entry, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #eee",
                      backgroundColor: entry.consentActive
                        ? "#f0fdf4"
                        : "#fef2f2",
                    }}
                  >
                    <td style={{ padding: "8px" }}>{entry.timestamp}</td>
                    <td style={{ padding: "8px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          backgroundColor: entry.consentActive
                            ? "#bbf7d0"
                            : "#fecaca",
                          color: entry.consentActive ? "#166534" : "#991b1b",
                        }}
                      >
                        {entry.consentActive ? "✓ Verified" : "✗ Not Found"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>
                      {entry.idHash.substring(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
