export default function Home() {
  return (
    <div>
      <div className="card">
        <h2>Welcome to Lifemarq</h2>
        <p>
          Lifemarq is an immutable, blockchain-powered organ donor registry
          built on Stellar Soroban.
        </p>
        <p style={{ marginTop: "15px" }}>
          Donors register consent once. Hospitals query instantly. Family cannot
          override.
        </p>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        <div className="card">
          <h3>For Donors</h3>
          <p>
            Register your organ donation preferences securely on the blockchain.
          </p>
          <a
            href="/donor"
            style={{
              display: "inline-block",
              marginTop: "15px",
              color: "#007bff",
              textDecoration: "none",
            }}
          >
            Go to Donor Portal →
          </a>
        </div>

        <div className="card">
          <h3>For Hospitals</h3>
          <p>
            Query donor consent status before surgery. Instant, verified
            results.
          </p>
          <a
            href="/hospital"
            style={{
              display: "inline-block",
              marginTop: "15px",
              color: "#007bff",
              textDecoration: "none",
            }}
          >
            Go to Hospital Query →
          </a>
        </div>
      </div>

      <div className="card" style={{ marginTop: "20px" }}>
        <h3>How It Works</h3>
        <ol style={{ marginLeft: "20px", lineHeight: "1.8" }}>
          <li>Donor registers via Freighter wallet</li>
          <li>Consent is hashed and recorded on-chain</li>
          <li>Hospital queries the smart contract pre-surgery</li>
          <li>Contract returns verified consent status</li>
          <li>Family cannot override a registered decision</li>
        </ol>
      </div>
    </div>
  );
}
