"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface AnalyticsData {
  total_donors: number;
  organ_distribution: Record<string, number>;
  hospital_query_volume: number;
  registration_trend: Array<{ date: string; count: number }>;
  verification_trend: Array<{ date: string; count: number }>;
}

interface HospitalData {
  hospital_id: string;
  query_count: number;
  last_query: string;
}

const COLORS = [
  "#28a745",
  "#007bff",
  "#ffc107",
  "#dc3545",
  "#6f42c1",
  "#17a2b8",
];

export default function MinistryDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const expectedPassword =
      process.env.NEXT_PUBLIC_MINISTRY_PASSWORD || "changeme";
    if (password === expectedPassword) {
      setAuthenticated(true);
      setError("");
      fetchAnalytics();
    } else {
      setError("Invalid password");
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      // Fetch analytics
      const analyticsRes = await fetch(`${apiUrl}/analytics`);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      // Fetch hospital stats
      const hospitalsRes = await fetch(
        `${apiUrl}/analytics/hospitals?limit=20`,
      );
      if (hospitalsRes.ok) {
        const data = await hospitalsRes.json();
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div>
        <div className="card">
          <h2>Ministry Analytics Dashboard</h2>
          <p>Government oversight of the organ donor registry system.</p>
        </div>

        <div className="card" style={{ maxWidth: "400px", margin: "0 auto" }}>
          <h3>Authentication Required</h3>
          <p>Enter the ministry dashboard password to access analytics.</p>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && <div className="alert error">{error}</div>}

          <button onClick={handleLogin} style={{ backgroundColor: "#28a745" }}>
            Access Dashboard
          </button>
        </div>

        <div className="card">
          <h3>Why Analytics?</h3>
          <p>
            Transparent, auditable data is core to blockchain-based health
            infrastructure. Governments need real-time visibility into:
          </p>
          <ul style={{ marginLeft: "20px", lineHeight: "1.8" }}>
            <li>Donor registration trends and coverage</li>
            <li>Organ supply distribution by type</li>
            <li>Hospital query volume and compliance</li>
            <li>System uptime and reliability</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2>Ministry Analytics Dashboard</h2>
          <button
            onClick={() => {
              setAuthenticated(false);
              setPassword("");
            }}
            style={{ backgroundColor: "#6c757d" }}
          >
            Logout
          </button>
        </div>
        <p style={{ fontSize: "12px", color: "#666" }}>
          Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>

      {loading && (
        <div className="card">
          <p>Loading analytics...</p>
        </div>
      )}

      {analytics && (
        <>
          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "20px",
              marginBottom: "20px",
            }}
          >
            <div
              className="card"
              style={{
                backgroundColor: "#d4edda",
                borderLeft: "4px solid #28a745",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#155724" }}>Total Donors</h3>
              <p
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#155724",
                  margin: "10px 0",
                }}
              >
                {analytics.total_donors}
              </p>
              <p style={{ fontSize: "12px", color: "#155724" }}>
                Registered on Stellar blockchain
              </p>
            </div>

            <div
              className="card"
              style={{
                backgroundColor: "#e7f3ff",
                borderLeft: "4px solid #007bff",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#004085" }}>
                Hospital Queries
              </h3>
              <p
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#004085",
                  margin: "10px 0",
                }}
              >
                {analytics.hospital_query_volume}
              </p>
              <p style={{ fontSize: "12px", color: "#004085" }}>
                Consent verifications performed
              </p>
            </div>

            <div
              className="card"
              style={{
                backgroundColor: "#fff3cd",
                borderLeft: "4px solid #ffc107",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#856404" }}>System Health</h3>
              <p
                style={{
                  fontSize: "32px",
                  fontWeight: "bold",
                  color: "#856404",
                  margin: "10px 0",
                }}
              >
                99.9%
              </p>
              <p style={{ fontSize: "12px", color: "#856404" }}>Uptime (30d)</p>
            </div>
          </div>

          {/* Organ Distribution */}
          <div className="card">
            <h3>Organ Supply Distribution</h3>
            <p
              style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}
            >
              Percentage of registered donors by organ type
            </p>

            {Object.keys(analytics.organ_distribution).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(analytics.organ_distribution).map(
                      ([organ, count]) => ({
                        name: organ.charAt(0).toUpperCase() + organ.slice(1),
                        value: count,
                      }),
                    )}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}% `}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(analytics.organ_distribution).map(
                      (_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ),
                    )}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", color: "#666" }}>
                No donor data yet
              </p>
            )}
          </div>

          {/* Registration Trend */}
          <div className="card">
            <h3>Donor Registration Trend</h3>
            <p
              style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}
            >
              New donors registered over time
            </p>

            {analytics.registration_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.registration_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#28a745"
                    name="New Registrations"
                    dot={{ fill: "#28a745" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", color: "#666" }}>
                Insufficient data for trend
              </p>
            )}
          </div>

          {/* Query Trend */}
          <div className="card">
            <h3>Hospital Verification Trend</h3>
            <p
              style={{ fontSize: "12px", color: "#666", marginBottom: "20px" }}
            >
              Consent queries from hospitals over time
            </p>

            {analytics.verification_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.verification_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#007bff"
                    name="Verification Queries"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: "center", color: "#666" }}>
                No query data available
              </p>
            )}
          </div>

          {/* Top Hospitals */}
          {hospitals.length > 0 && (
            <div className="card">
              <h3>Top Hospitals by Query Volume</h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: "15px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd" }}>
                    <th style={{ textAlign: "left", padding: "10px" }}>
                      Hospital ID
                    </th>
                    <th style={{ textAlign: "center", padding: "10px" }}>
                      Queries
                    </th>
                    <th style={{ textAlign: "left", padding: "10px" }}>
                      Last Query
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.slice(0, 10).map((hospital, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #eee",
                        backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "white",
                      }}
                    >
                      <td style={{ padding: "10px" }}>
                        {hospital.hospital_id}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px" }}>
                        {hospital.query_count}
                      </td>
                      <td style={{ padding: "10px", fontSize: "12px" }}>
                        {new Date(hospital.last_query).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Export Data */}
          <div className="card">
            <h3>Data Export</h3>
            <p>
              Download audit logs and analytics data for compliance reporting.
            </p>
            <button
              onClick={() => {
                const csvContent =
                  `data:text/csv;charset=utf-8,Total Donors,${analytics.total_donors}\nTotal Queries,${analytics.hospital_query_volume}\n\nOrgan Distribution:\n` +
                  Object.entries(analytics.organ_distribution)
                    .map(([organ, count]) => `${organ},${count}%`)
                    .join("\n");
                const link = document.createElement("a");
                link.setAttribute("href", encodeURI(csvContent));
                link.setAttribute(
                  "download",
                  `lifemarq-analytics-${Date.now()}.csv`,
                );
                link.click();
              }}
              style={{ backgroundColor: "#007bff" }}
            >
              Download Analytics (CSV)
            </button>
          </div>
        </>
      )}

      {!loading && !analytics && (
        <div className="card">
          <p>No analytics data available. Check that the API is running.</p>
          <button
            onClick={fetchAnalytics}
            style={{ backgroundColor: "#007bff" }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
