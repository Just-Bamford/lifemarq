"use client";

import { useState } from "react";
import {
  connectWallet,
  hashNationalId,
  signTransaction,
  truncateAddress,
} from "@/lib/wallet";
import {
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  SorobanRpc,
} from "stellar-sdk";

type State = "idle" | "submitting" | "success";

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
      const publicKey = await connectWallet();
      setWallet(publicKey);
      setMessage("Wallet connected successfully");
      setMessageType("success");
    } catch (error: any) {
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
    setMessage("");

    try {
      // Hash national ID client-side (never transmitted raw)
      const idHash = await hashNationalId(nationalId);

      // Build contract invocation
      const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
      const network = process.env.NEXT_PUBLIC_NETWORK || "testnet";

      if (!contractId) {
        throw new Error("Contract ID not configured");
      }

      // Create contract instance
      const contract = new Contract(contractId);

      // Build transaction
      const sourceAccount = {
        accountId: wallet,
        sequenceNumber: "0",
      };

      const transaction = new TransactionBuilder(sourceAccount as any, {
        fee: "100",
        networkPassphrase:
          network === "testnet"
            ? Networks.TESTNET_NETWORK_PASSPHRASE
            : Networks.PUBLIC_NETWORK_PASSPHRASE,
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
      const signedXdr = await signTransaction(xdr, network);

      // Submit to Soroban RPC
      const sorobanUrl =
        network === "testnet"
          ? "https://soroban-testnet.stellar.org"
          : "https://soroban.stellar.org";

      const sorobanClient = new SorobanRpc.Client({
        allowHttp: false,
        serverURL: sorobanUrl,
      });

      const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        network === "testnet"
          ? Networks.TESTNET_NETWORK_PASSPHRASE
          : Networks.PUBLIC_NETWORK_PASSPHRASE,
      );

      const result = await sorobanClient.sendTransaction(signedTx);

      if (result.status === "PENDING") {
        // Poll for completion
        let pollCount = 0;
        while (pollCount < 30) {
          const status = await sorobanClient.getTransaction(result.hash);
          if (status.status === "SUCCESS") {
            setState("success");
            setSuccessData({ idHash, organs });
            setMessage(
              "Registration successful! Your consent is now on-chain.",
            );
            setMessageType("success");
            setNationalId("");
            setOrgans([]);
            return;
          } else if (status.status === "FAILED") {
            throw new Error("Transaction failed");
          }
          pollCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        throw new Error("Transaction timeout");
      } else if (result.status === "SUCCESS") {
        setState("success");
        setSuccessData({ idHash, organs });
        setMessage("Registration successful! Your consent is now on-chain.");
        setMessageType("success");
        setNationalId("");
        setOrgans([]);
      } else {
        throw new Error(`Transaction failed: ${result.status}`);
      }
    } catch (error: any) {
      setState("idle");
      setMessage(error.message || "Registration failed");
      setMessageType("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setSuccessData(null);
    setMessage("");
  };

  if (state === "success" && successData) {
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
              disabled={state === "submitting"}
              style={{ backgroundColor: "#1976d2" }}
            >
              Connect Freighter Wallet
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
                disabled={state === "submitting"}
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
                      disabled={state === "submitting"}
                    />
                    {organ.charAt(0).toUpperCase() + organ.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            {/* Register Button */}
            <button
              onClick={handleRegister}
              disabled={state === "submitting"}
              style={{
                backgroundColor: state === "submitting" ? "#ccc" : "#28a745",
              }}
            >
              {state === "submitting"
                ? "Signing & Submitting..."
                : "Register & Sign with Freighter"}
            </button>
          </>
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
