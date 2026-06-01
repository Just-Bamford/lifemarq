"use client";

import { useState } from "react";
import crypto from "crypto";

export default function DonorPortal() {
  const [nationalId, setNationalId] = useState("");
  const [organs, setOrgans] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );

  const organOptions = [
    "Heart",
    "Kidney",
    "Liver",
    "Lungs",
    "Pancreas",
    "Corneas",
  ];

  const handleOrganToggle = (organ: string) => {
    setOrgans((prev) =>
      prev.includes(organ) ? prev.filter((o) => o !== organ) : [...prev, organ],
    );
  };

  const hashNationalId = (id: string): string => {
    return crypto.createHash("sha256").update(id).digest("hex");
  };

  const handleRegister = async () => {
    if (!nationalId.trim()) {
      setMessage("Please enter your national ID");
      setMessageType("error");
      return;
    }

    if (organs.length === 0) {
      setMessage("Please select at least one organ");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Hash national ID client-side
      const idHash = hashNationalId(nationalId);

      // TODO: Connect to Freighter wallet and call contract
      setMessage(
        `Hashed ID: ${idHash.substring(0, 16)}... (Ready to sign with Freighter)`,
      );
      setMessageType("info");
    } catch (error) {
      setMessage("Error processing registration");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Donor Registration Portal</h2>
        <p>
          Register your organ donation preferences securely on the Stellar
          blockchain.
        </p>
      </div>

      <div className="card">
        {message && <div className={`alert ${messageType}`}>{message}</div>}

        <div className="form-group">
          <label htmlFor="nationalId">National ID (will be hashed)</label>
          <input
            id="nationalId"
            type="text"
            placeholder="Enter your national ID"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Select Organs to Donate</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {organOptions.map((organ) => (
              <label
                key={organ}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <input
                  type="checkbox"
                  checked={organs.includes(organ)}
                  onChange={() => handleOrganToggle(organ)}
                  disabled={loading}
                />
                {organ}
              </label>
            ))}
          </div>
        </div>

        <button onClick={handleRegister} disabled={loading}>
          {loading ? "Processing..." : "Register & Sign with Freighter"}
        </button>
      </div>

      <div className="card">
        <h3>Privacy & Security</h3>
        <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>
            Your national ID is hashed using SHA-256 before any on-chain write
          </li>
          <li>No personal information is stored on the blockchain</li>
          <li>Only you can revoke your consent using your private key</li>
          <li>All transactions are immutable and auditable</li>
        </ul>
      </div>
    </div>
  );
}
