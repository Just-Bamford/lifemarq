"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ConsentRecord {
  id_hash: string;
  consent_active: boolean;
  organs: string[];
  queried_at: string;
  registered_at?: string;
}

type LoadState = "loading" | "success" | "not_found" | "error";

export default function ConsentStatusPage({
  params,
}: {
  params: { id_hash: string };
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [error, setError] = useState("");
  const { id_hash } = params;

  // Validate hash format
  const isValidHash = /^[a-f0-9]{64}$/i.test(id_hash);

  useEffect(() => {
    if (!isValidHash) {
      setState("error");
      setError("Invalid hash format. Must be 64-character hexadecimal.");
      return;
    }

    const fetchConsent = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/consent/${id_hash}`);

        if (!response.ok) {
          if (response.status === 503) {
            setState("error");
            setError("Registry temporarily unavailable. Please try again.");
            return;
          }
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setRecord(data);

        if (data.consent_active) {
          setState("success");
        } else {
          setState("not_found");
        }
      } catch (err: any) {
        console.error("Error fetching consent:", err);
        setState("error");
        setError(err.message || "Failed to fetch consent status");
      }
    };

    fetchConsent();
  }, [id_hash, isValidHash]);

  if (!isValidHash) {
    return (
      <div>
        <div
          className="card"
          style={{
            backgroundColor: "#f8d7da",
            borderLeft: "4px solid #f5c6cb",
          }}
        >
          <h2 style={{ color: "#721c24" }}>Invalid Hash</h2>
          <p style={{ color: "#721c24" }}>
            The consent hash format is invalid. It must be exactly 64
            hexadecimal characters.
          </p>
          <Link href="/donor">
            <button>Register a Donor</button>
          </Link>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div>
        <div className="card">
          <h2>Checking consent status...</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div>
        <div
          className="card"
          style={{
            backgroundColor: "#f8d7da",
            borderLeft: "4px solid #f5c6cb",
          }}
        >
          <h2 style={{ color: "#721c24" }}>Error</h2>
          <p style={{ color: "#721c24" }}>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (state === "success" && record && record.consent_active) {
    return (
      <div>
        <div
          className="card"
          style={{
            backgroundColor: "#d4edda",
            borderLeft: "4px solid #28a745",
          }}
        >
          <h2 style={{ color: "#155724" }}>✓ Donor Consent Verified</h2>
          <p style={{ color: "#155724", marginBottom: "15px" }}>
            This donor has registered organ donation consent on the Stellar
            blockchain.
          </p>

          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "4px",
              marginBottom: "15px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Consent Details</h3>

            <div style={{ marginBottom: "15px" }}>
              <p style={{ marginBottom: "5px" }}>
                <strong>Consent ID Hash:</strong>
              </p>
              <code
                style={{
                  display: "block",
                  padding: "10px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  wordBreak: "break-all",
                  fontSize: "12px",
                }}
              >
                {id_hash}
              </code>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <p style={{ marginBottom: "5px" }}>
                <strong>Organs Registered for Donation:</strong>
              </p>
              <ul style={{ marginLeft: "20px" }}>
                {record.organs.map((organ) => (
                  <li key={organ}>
                    {organ.charAt(0).toUpperCase() + organ.slice(1)}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p style={{ marginBottom: "5px" }}>
                <strong>Status:</strong> Active
              </p>
              <p style={{ color: "#28a745", fontWeight: "bold" }}>
                ✓ Registered on Stellar blockchain
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#e8f5e9",
              padding: "15px",
              borderRadius: "4px",
              marginBottom: "15px",
            }}
          >
            <p style={{ color: "#2e7d32", marginTop: 0 }}>
              <strong>Important:</strong> This consent is immutable and
              protected by the Stellar blockchain. Family members cannot
              override this decision. Only the original wallet holder can revoke
              consent.
            </p>
          </div>

          <p style={{ fontSize: "12px", color: "#666" }}>
            Verified: {new Date(record.queried_at).toLocaleString()}
          </p>
        </div>

        <div className="card">
          <h3>What This Means</h3>
          <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
            <li>
              This donor has explicitly registered consent to donate organs
            </li>
            <li>
              Hospitals can rely on this decision for transplant procedures
            </li>
            <li>
              The decision is legally binding and protected by cryptography
            </li>
            <li>No family member can override this decision in an emergency</li>
            <li>
              The donor can revoke this consent at any time using their wallet
            </li>
          </ul>
        </div>

        <div className="card">
          <h3>Privacy</h3>
          <p>
            This page shows only the consent hash and registration status. No
            personal information is displayed or stored on the blockchain. The
            donor's national ID was hashed before registration and is not
            recoverable from this hash.
          </p>
        </div>

        <div className="card">
          <Link href="/">
            <button>Back to Home</button>
          </Link>
        </div>
      </div>
    );
  }

  // Not found or revoked
  return (
    <div>
      <div
        className="card"
        style={{ backgroundColor: "#e2e3e5", borderLeft: "4px solid #6c757d" }}
      >
        <h2 style={{ color: "#383d41" }}>No Active Consent</h2>
        <p style={{ color: "#383d41", marginBottom: "15px" }}>
          This donor does not have an active organ donation consent registered
          in the Lifemarq system.
        </p>

        <p style={{ color: "#383d41", marginBottom: "15px" }}>
          This could mean:
        </p>
        <ul
          style={{ color: "#383d41", marginLeft: "20px", marginBottom: "15px" }}
        >
          <li>The donor has not yet registered</li>
          <li>The donor previously revoked their consent</li>
          <li>The hash may be incorrect</li>
        </ul>

        <p style={{ color: "#383d41" }}>
          <strong>Note:</strong> The absence of a record does not mean the
          person is not a donor — they may have registered through another
          system or have not yet registered with Lifemarq.
        </p>
      </div>

      <div className="card">
        <h3>Want to Register?</h3>
        <p>
          If you are a donor and want to register your consent with Lifemarq,
          visit the donor portal.
        </p>
        <Link href="/donor">
          <button style={{ backgroundColor: "#28a745" }}>
            Register as Donor
          </button>
        </Link>
      </div>

      <div className="card">
        <Link href="/">
          <button>Back to Home</button>
        </Link>
      </div>
    </div>
  );
}
