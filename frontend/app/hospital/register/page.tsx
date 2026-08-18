"use client";

import { useState } from "react";
import { connectWallet, truncateAddress } from "@/lib/wallet";

type State = "idle" | "wallet_connecting" | "submitting" | "success" | "error";

interface HospitalData {
  hospital_id: string;
  name: string;
  country: string;
  license_number: string;
  wallet: string;
}

export default function HospitalOnboarding() {
  const [state, setState] = useState<State>("idle");
  const [wallet, setWallet] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("KE");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [successData, setSuccessData] = useState<HospitalData | null>(null);

  const countries = [
    { code: "KE", name: "Kenya" },
    { code: "NG", name: "Nigeria" },
    { code: "GH", name: "Ghana" },
    { code: "ZA", name: "South Africa" },
    { code: "TZ", name: "Tanzania" },
    { code: "UG", name: "Uganda" },
    { code: "SN", name: "Senegal" },
    { code: "CI", name: "Côte d'Ivoire" },
  ];

  const handleConnectWallet = async () => {
    try {
      setMessage("");
      setState("wallet_connecting");
      const publicKey = await connectWallet();
      setWallet(publicKey);
      setState("idle");
      setMessage("Wallet connected successfully");
      setMessageType("success");
    } catch (error: any) {
      setState("error");
      setMessage(error.message || "Failed to connect wallet");
      setMessageType("error");
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!wallet) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    if (!hospitalId.trim()) {
      setMessage("Please enter a hospital ID");
      setMessageType("error");
      return;
    }

    if (!name.trim()) {
      setMessage("Please enter the hospital name");
      setMessageType("error");
      return;
    }

    if (!licenseNumber.trim()) {
      setMessage("Please enter the license number");
      setMessageType("error");
      return;
    }

    setState("submitting");
    setMessage("Submitting hospital registration...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      const response = await fetch(`${apiUrl}/hospitals/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hospital_id: hospitalId.trim(),
          wallet,
          name: name.trim(),
          country,
          license_number: licenseNumber.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      await response.json();

      setState("success");
      setSuccessData({
        hospital_id: hospitalId.trim(),
        name: name.trim(),
        country,
        license_number: licenseNumber.trim(),
        wallet,
      });
      setMessage(
        "✓ Registration submitted! Your hospital is pending admin approval.",
      );
      setMessageType("success");

      // Clear form
      setHospitalId("");
      setName("");
      setLicenseNumber("");
    } catch (error: any) {
      setState("error");
      setMessage(error.message || "Registration failed");
      setMessageType("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setSuccessData(null);
    setMessage("");
    setHospitalId("");
    setName("");
    setLicenseNumber("");
    setCountry("KE");
  };

  if (state === "success" && successData) {
    return (
      <div>
        <div className="card">
          <h2>Registration Submitted</h2>
          <p>Your hospital registration has been submitted for admin review.</p>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: "#d4edda",
            borderLeft: "4px solid #28a745",
          }}
        >
          <h3 style={{ color: "#155724" }}>⏳ Pending Admin Approval</h3>
          <p style={{ marginBottom: "15px", color: "#155724" }}>
            Your registration details have been submitted and are awaiting admin
            verification. This typically takes 1-2 business days.
          </p>

          <div
            style={{
              backgroundColor: "white",
              padding: "15px",
              borderRadius: "4px",
              marginBottom: "15px",
              border: "1px solid #b1dfbb",
            }}
          >
            <p style={{ marginBottom: "10px", color: "#333" }}>
              <strong>Hospital ID:</strong> {successData.hospital_id}
            </p>
            <p style={{ marginBottom: "10px", color: "#333" }}>
              <strong>Name:</strong> {successData.name}
            </p>
            <p style={{ marginBottom: "10px", color: "#333" }}>
              <strong>Country:</strong>{" "}
              {countries.find((c) => c.code === successData.country)?.name}
            </p>
            <p style={{ marginBottom: "10px", color: "#333" }}>
              <strong>License Number:</strong> {successData.license_number}
            </p>
            <p style={{ marginBottom: "0", color: "#333" }}>
              <strong>Wallet:</strong> {truncateAddress(successData.wallet)}
            </p>
          </div>

          <button
            onClick={handleReset}
            style={{ backgroundColor: "#28a745", marginRight: "10px" }}
          >
            Register Another Hospital
          </button>
          <a
            href="/hospital"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Back to Hospital Portal
          </a>
        </div>

        <div className="card">
          <h3>What Happens Next</h3>
          <ul style={{ marginLeft: "20px", lineHeight: "1.8", color: "#333" }}>
            <li>Admin reviews your hospital credentials</li>
            <li>License number is verified against medical registry</li>
            <li>Once approved, your hospital can query donor consent</li>
            <li>You'll receive confirmation when verification is complete</li>
            <li>
              Until then, queries will be rejected with an access denied
              response
            </li>
          </ul>
        </div>

        <div className="card">
          <h3>Access Control</h3>
          <p>
            Once verified, your hospital wallet will be authorized to query
            donor consent records. This ensures only credentialed medical
            institutions can access sensitive health information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Hospital Registration</h2>
        <p>Register your hospital to query donor consent records.</p>
      </div>

      <div className="card">
        {message && <div className={`alert ${messageType}`}>{message}</div>}

        {/* Wallet Connection */}
        <div className="form-group">
          <label>Hospital Wallet (Freighter)</label>
          {wallet ? (
            <div
              style={{
                padding: "10px",
                backgroundColor: "#e8f5e9",
                borderRadius: "4px",
                color: "#2e7d32",
              }}
            >
              ✓ Connected: {truncateAddress(wallet)}
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={state !== "idle"}
              style={{ backgroundColor: "#1976d2" }}
            >
              {state === "wallet_connecting"
                ? "Connecting..."
                : "Connect Freighter Wallet"}
            </button>
          )}
          <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            This wallet will be used to sign queries and identify your hospital.
          </p>
        </div>

        {wallet && (
          <>
            {/* Hospital ID */}
            <div className="form-group">
              <label htmlFor="hospitalId">Hospital ID</label>
              <input
                id="hospitalId"
                type="text"
                placeholder="e.g., KNH-KE-001"
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
              />
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                Unique identifier for your hospital (e.g., KNH-KE-001)
              </p>
            </div>

            {/* Hospital Name */}
            <div className="form-group">
              <label htmlFor="name">Hospital Name</label>
              <input
                id="name"
                type="text"
                placeholder="e.g., Kenyatta National Hospital"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
              />
            </div>

            {/* Country Dropdown */}
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* License Number */}
            <div className="form-group">
              <label htmlFor="licenseNumber">Medical License Number</label>
              <input
                id="licenseNumber"
                type="text"
                placeholder="e.g., LIC-123456"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
              />
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                Official medical license or registration number from your
                country's health ministry
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleRegister}
              disabled={state !== "idle" && state !== "error"}
              style={{
                backgroundColor:
                  state !== "idle" && state !== "error" ? "#ccc" : "#28a745",
              }}
            >
              {state === "submitting" ? "Submitting..." : "Register Hospital"}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3>Registration Requirements</h3>
        <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>Valid hospital ID recognized in your country</li>
          <li>Official hospital name</li>
          <li>Active medical license number</li>
          <li>Wallet to sign queries (Freighter or other Stellar wallet)</li>
        </ul>
      </div>

      <div className="card">
        <h3>Verification Process</h3>
        <ol style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>Submit registration with your hospital credentials</li>
          <li>
            Admin verifies your license against national health ministry records
          </li>
          <li>Once approved, your wallet is authorized to query donors</li>
          <li>You can immediately begin querying donor consent records</li>
        </ol>
      </div>

      <div className="card">
        <h3>Access Control & Security</h3>
        <p>
          Lifemarq implements on-chain access control. Only verified hospitals
          can query donor records. This ensures:
        </p>
        <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>
            Privacy is protected — unverified wallets receive access denied
          </li>
          <li>
            Accountability — every query is logged with timestamp and hospital
            ID
          </li>
          <li>
            Compliance — audit trail proves only authorized institutions
            accessed data
          </li>
          <li>
            Real-time verification — no API keys, just on-chain wallet
            signatures
          </li>
        </ul>
      </div>
    </div>
  );
}
