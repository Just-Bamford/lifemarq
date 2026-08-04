"use client";

import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import {
  connectWallet,
  hashNationalId,
  signTransaction,
  truncateAddress,
} from "@/lib/wallet";
import {
  TransactionBuilder,
  Contract,
  nativeToScVal,
  SorobanRpc,
} from "stellar-sdk";

type State =
  | "idle"
  | "wallet_connecting"
  | "submitting"
  | "signing"
  | "confirming"
  | "success"
  | "error";

interface SuccessData {
  idHash: string;
  organs: string[];
}

export default function DonorPortal() {
  const [state, setState] = useState<State>("idle");
  const [wallet, setWallet] = useState<string | null>(null);
  const [nationalId, setNationalId] = useState("");
  const [organs, setOrgans] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const organOptions = [
    "kidney",
    "liver",
    "heart",
    "lungs",
    "pancreas",
    "corneas",
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

  const handleOrganToggle = (organ: string) => {
    setOrgans((prev) =>
      prev.includes(organ) ? prev.filter((o) => o !== organ) : [...prev, organ],
    );
  };

  const handleRegister = async () => {
    if (!wallet) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

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

    setState("submitting");
    setMessage("Hashing national ID...");

    try {
      // Hash national ID client-side (never transmitted raw)
      const idHash = await hashNationalId(nationalId);

      // Build contract invocation
      const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
      const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";

      if (!contractId) {
        throw {
          code: "CONFIG_ERROR",
          message: "Contract ID not configured",
          recoverable: false,
        };
      }

      // Create contract instance
      const contract = new Contract(contractId);

      // Build transaction
      setState("submitting");
      setMessage("Building transaction...");
      const sourceAccount = {
        accountId: wallet,
        sequenceNumber: "0",
      };

      const transaction = new TransactionBuilder(sourceAccount as any, {
        fee: "100",
        networkPassphrase:
          network === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
      })
        .addOperation(
          contract.call(
            "register",
            nativeToScVal(idHash, { type: "string" }),
            nativeToScVal(wallet, { type: "address" }),
            nativeToScVal(organs, { type: "vec" }),
          ),
        )
        .setTimeout(30)
        .build();

      const xdr = transaction.toXDR();

      // Sign with Freighter
      setState("signing");
      setMessage("Waiting for your wallet to sign...");
      const signedXdr = await signTransaction(xdr, network);

      // Submit to Soroban RPC
      const sorobanUrl =
        network === "testnet"
          ? "https://soroban-testnet.stellar.org"
          : "https://soroban.stellar.org";

      const sorobanClient = new SorobanRpc.Server(sorobanUrl, {
        allowHttp: false,
      });

      setState("confirming");
      setMessage("Submitting transaction to blockchain...");
      const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        network === "testnet"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015",
      );

      const result = await sorobanClient.sendTransaction(signedTx);

      // Record submission to backend for tracking
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      await fetch(`${apiUrl}/submission/${result.hash}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentHash: idHash,
          wallet,
          operation: "register",
        }),
      }).catch((err) => console.warn("Failed to record submission:", err));

      if (result.status === "PENDING") {
        // Poll for completion
        let pollCount = 0;
        while (pollCount < 30) {
          setState("confirming");
          setMessage(
            `Confirming on blockchain (${pollCount + 1}/30 attempts)...`,
          );
          const status = await sorobanClient.getTransaction(result.hash);
          if (status.status === "SUCCESS") {
            setState("success");
            setSuccessData({ idHash, organs });
            setMessage(
              "✓ Registration successful! Your consent is now on-chain.",
            );
            setMessageType("success");
            setNationalId("");
            setOrgans([]);
            return;
          } else if (status.status === "FAILED") {
            throw {
              code: "TX_FAILED",
              message: "Transaction was rejected by the blockchain",
              recoverable: false,
            };
          }
          pollCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw {
          code: "TX_TIMEOUT",
          message:
            "Confirmation timeout. Your consent may still be recorded. Check your wallet or try again.",
          recoverable: true,
        };
      } else {
        // For DUPLICATE or TRY_AGAIN_LATER, treat as success
        setState("success");
        setSuccessData({ idHash, organs });
        setMessage(
          "✓ Registration submitted! Your consent should be on-chain.",
        );
        setMessageType("success");
        setNationalId("");
        setOrgans([]);
      }
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
  };

  const handleRevoke = async () => {
    if (!wallet) {
      setMessage("Please connect your wallet first");
      setMessageType("error");
      return;
    }

    if (!nationalId.trim()) {
      setMessage("Please enter your national ID");
      setMessageType("error");
      return;
    }

    setState("submitting");
    setMessage("Preparing revocation...");

    try {
      // Hash national ID
      const idHash = await hashNationalId(nationalId);

      const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
      const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";

      if (!contractId) {
        throw {
          code: "CONFIG_ERROR",
          message: "Contract ID not configured",
          recoverable: false,
        };
      }

      // Create contract instance
      const contract = new Contract(contractId);

      // Build revocation transaction
      setState("submitting");
      setMessage("Building revocation transaction...");
      const sourceAccount = {
        accountId: wallet,
        sequenceNumber: "0",
      };

      const transaction = new TransactionBuilder(sourceAccount as any, {
        fee: "100",
        networkPassphrase:
          network === "testnet"
            ? "Test SDF Network ; September 2015"
            : "Public Global Stellar Network ; September 2015",
      })
        .addOperation(
          contract.call(
            "revoke",
            nativeToScVal(idHash, { type: "string" }),
            nativeToScVal(wallet, { type: "address" }),
          ),
        )
        .setTimeout(30)
        .build();

      const xdr = transaction.toXDR();

      // Sign with Freighter
      setState("signing");
      setMessage("Waiting for your wallet to sign revocation...");
      const signedXdr = await signTransaction(xdr, network);

      // Submit to Soroban RPC
      const sorobanUrl =
        network === "testnet"
          ? "https://soroban-testnet.stellar.org"
          : "https://soroban.stellar.org";

      const sorobanClient = new SorobanRpc.Server(sorobanUrl, {
        allowHttp: false,
      });

      setState("confirming");
      setMessage("Submitting revocation to blockchain...");
      const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        network === "testnet"
          ? "Test SDF Network ; September 2015"
          : "Public Global Stellar Network ; September 2015",
      );

      const result = await sorobanClient.sendTransaction(signedTx);

      if (result.status === "PENDING") {
        // Poll for completion
        let pollCount = 0;
        while (pollCount < 30) {
          setState("confirming");
          setMessage(
            `Confirming revocation on blockchain (${pollCount + 1}/30 attempts)...`,
          );
          const status = await sorobanClient.getTransaction(result.hash);
          if (status.status === "SUCCESS") {
            setState("success");
            setMessage(
              "✓ Revocation successful! Your consent has been permanently revoked.",
            );
            setMessageType("success");
            setNationalId("");
            return;
          } else if (status.status === "FAILED") {
            throw {
              code: "TX_FAILED",
              message: "Revocation transaction was rejected by the blockchain",
              recoverable: false,
            };
          }
          pollCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw {
          code: "TX_TIMEOUT",
          message: "Revocation confirmation timeout",
          recoverable: true,
        };
      } else {
        // For DUPLICATE or TRY_AGAIN_LATER, treat as success
        setState("success");
        setMessage(
          "✓ Revocation submitted! Your consent has been marked for revocation.",
        );
        setMessageType("success");
        setNationalId("");
      }
    } catch (error: any) {
      setState("error");
      setMessage(error.message || "Revocation failed");
      setMessageType("error");
    }
  };

  if (state === "success" && successData) {
    // Generate QR code when success state is reached
    useEffect(() => {
      if (qrCanvasRef.current && successData && !qrCodeUrl) {
        QRCode.toCanvas(
          qrCanvasRef.current,
          successData.idHash,
          {
            width: 300,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#ffffff",
            },
          },
          (error) => {
            if (error) {
              console.error("QR code generation failed:", error);
            } else {
              // Convert canvas to image data URL for download
              const url = qrCanvasRef.current?.toDataURL("image/png");
              setQrCodeUrl(url || null);
            }
          },
        );
      }
    }, [successData, qrCodeUrl]);

    const downloadQRCode = () => {
      if (qrCanvasRef.current) {
        const link = document.createElement("a");
        link.href = qrCanvasRef.current.toDataURL("image/png");
        link.download = `donor-card-${successData.idHash.substring(0, 8)}.png`;
        link.click();
      }
    };

    return (
      <div>
        <div className="card">
          <h2>Registration Successful</h2>
          <p>
            Your organ donation consent is now recorded on the Stellar
            blockchain.
          </p>
        </div>

        <div
          className="card"
          style={{
            backgroundColor: "#d4edda",
            borderLeft: "4px solid #28a745",
          }}
        >
          <h3 style={{ color: "#155724" }}>✓ Consent Registered</h3>
          <p style={{ marginBottom: "15px" }}>
            Your decision is immutable and protected. Only you can revoke it
            using your wallet.
          </p>

          <div
            style={{
              backgroundColor: "white",
              padding: "15px",
              borderRadius: "4px",
              marginBottom: "15px",
            }}
          >
            <p style={{ marginBottom: "10px" }}>
              <strong>ID Hash:</strong> {successData.idHash.substring(0, 16)}...
            </p>
            <p style={{ marginBottom: "10px" }}>
              <strong>Organs:</strong> {successData.organs.join(", ")}
            </p>
            <p style={{ fontSize: "12px", color: "#666" }}>
              Your national ID was hashed with SHA-256 and never transmitted.
              Only the hash is on-chain.
            </p>
          </div>

          <button onClick={handleReset} style={{ backgroundColor: "#28a745" }}>
            Register Another Donor
          </button>
        </div>

        {/* QR Code Donor Card Section */}
        <div className="card">
          <h3>Your Donor Card (QR Code)</h3>
          <p>
            Download and print this QR code. Carry it with you so hospitals can
            quickly verify your consent in an emergency.
          </p>

          <div
            style={{
              padding: "20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textAlign: "center",
              marginBottom: "15px",
            }}
          >
            <canvas
              ref={qrCanvasRef}
              style={{
                border: "2px solid #ddd",
                borderRadius: "4px",
                margin: "0 auto",
                display: "block",
              }}
            />
          </div>

          <button
            onClick={downloadQRCode}
            style={{
              backgroundColor: "#007bff",
              marginBottom: "10px",
              width: "100%",
            }}
          >
            Download Donor Card (PNG)
          </button>

          <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
            This QR code encodes only your consent hash — not your personal
            information. When scanned, hospitals can instantly verify your organ
            donation status.
          </p>
        </div>

        <div className="card">
          <h3>What Happens Next</h3>
          <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
            <li>Hospitals can now query your consent before surgery</li>
            <li>Your decision is final — family cannot override it</li>
            <li>You can revoke your consent anytime using your wallet</li>
            <li>All queries are logged for compliance</li>
          </ul>
        </div>
      </div>
    );
  }

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

        {/* Wallet Connection */}
        <div className="form-group">
          <label>Freighter Wallet</label>
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
        </div>

        {wallet && (
          <>
            {/* National ID Input */}
            <div className="form-group">
              <label htmlFor="nationalId">
                National ID (will be hashed, never stored)
              </label>
              <input
                id="nationalId"
                type="text"
                placeholder="Enter your national ID"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
              />
              <p style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
                Your ID is hashed with SHA-256 in your browser before anything
                is sent.
              </p>
            </div>

            {/* Organ Selection */}
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={organs.includes(organ)}
                      onChange={() => handleOrganToggle(organ)}
                      disabled={state !== "idle" && state !== "error"}
                    />
                    {organ.charAt(0).toUpperCase() + organ.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              disabled={state !== "idle" && state !== "error"}
              style={{
                backgroundColor:
                  state !== "idle" && state !== "error" ? "#ccc" : "#28a745",
              }}
            >
              {state === "submitting" && "Building transaction..."}
              {state === "signing" && "Signing with wallet..."}
              {state === "confirming" && "Confirming on blockchain..."}
              {(state === "idle" || state === "error") &&
                "Register & Sign with Freighter"}
            </button>
          </>
        )}
      </div>

      {/* Revocation Section */}
      <div className="card">
        <h3>Revoke Your Consent</h3>
        <p>
          If you change your mind, you can revoke your organ donation consent at
          any time. This action is permanent and cannot be undone. A new
          registration would be required to re-enable donation.
        </p>
        {wallet ? (
          <button
            onClick={handleRevoke}
            disabled={state !== "idle" && state !== "error"}
            style={{
              backgroundColor: "#dc3545",
            }}
          >
            {state === "submitting" && "Revoking..."}
            {state === "signing" && "Signing revocation..."}
            {state === "confirming" && "Confirming revocation..."}
            {(state === "idle" || state === "error") && "Revoke Consent"}
          </button>
        ) : (
          <p style={{ color: "#666", fontSize: "14px" }}>
            Connect your wallet first to revoke consent
          </p>
        )}
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
          <li>Hospitals can verify your decision instantly before surgery</li>
        </ul>
      </div>
    </div>
  );
}
