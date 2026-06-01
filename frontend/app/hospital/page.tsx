"use client";

import { useState } from "react";
import axios from "axios";

interface ConsentResult {
  active: boolean;
  organs?: string[];
  timestamp?: number;
}

export default function HospitalQuery() {
  const [patientIdHash, setPatientIdHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConsentResult | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );

  const handleQuery = async () => {
    if (!patientIdHash.trim()) {
      setMessage("Please enter the patient ID hash");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      // Query the hospital API
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/consent/${patientIdHash}`,
      );

      setResult(response.data);
      setMessage("Consent record retrieved successfully");
      setMessageType("success");
    } catch (error: any) {
      if (error.response?.status === 404) {
        setMessage("No consent record found for this patient");
        setMessageType("info");
        setResult({ active: false });
      } else {
        setMessage("Error querying consent record");
        setMessageType("error");
      }
    } finally {
      setLoading(false);
    }
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
            placeholder="Enter hashed patient ID"
            value={patientIdHash}
            onChange={(e) => setPatientIdHash(e.target.value)}
            disabled={loading}
          />
        </div>

        <button onClick={handleQuery} disabled={loading}>
          {loading ? "Querying..." : "Query Consent Status"}
        </button>
      </div>

      {result && (
        <div className="card">
          <h3>Consent Status</h3>
          <div
            style={{
              padding: "20px",
              backgroundColor: result.active ? "#d4edda" : "#f8d7da",
              borderRadius: "4px",
            }}
          >
            <p
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              {result.active ? "✓ Consent Active" : "✗ No Active Consent"}
            </p>
            {result.active && result.organs && (
              <div>
                <p style={{ marginBottom: "10px" }}>
                  Organs registered for donation:
                </p>
                <ul style={{ marginLeft: "20px" }}>
                  {result.organs.map((organ) => (
                    <li key={organ}>{organ}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.timestamp && (
              <p style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
                Registered: {new Date(result.timestamp * 1000).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Important Notes</h3>
        <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>This query is read-only and does not require authentication</li>
          <li>All queries are logged for audit purposes</li>
          <li>
            Consent status is verified directly from the Stellar blockchain
          </li>
          <li>Family members cannot override a registered decision</li>
        </ul>
      </div>
    </div>
  );
}
