# Lifemarq Hospital Query API

REST API for hospitals to query organ donor consent status from the Lifemarq Soroban contract.

## Setup

```bash
npm install
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```env
NETWORK=testnet
CONTRACT_ID=<deployed-contract-id>
PORT=3001
```

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Endpoints

### Health Check

```
GET /health
```

Returns API status.

### Query Consent Status

```
GET /consent/:id_hash
```

Query a patient's organ donation consent status.

**Parameters:**

- `id_hash` (path): SHA-256 hash of patient national ID (64-char hex string)

**Response:**

```json
{
  "active": true,
  "organs": ["Heart", "Kidney"],
  "timestamp": 1234567890
}
```

### Get Full Consent Record

```
GET /consent/:id_hash/full
```

Retrieve the complete consent record (requires API key).

**Headers:**

- `X-API-Key`: Hospital provider API key

**Response:**

```json
{
  "active": true,
  "organs": ["Heart", "Kidney"],
  "timestamp": 1234567890,
  "wallet": "GXXXXXX..."
}
```

### Audit Log

```
GET /audit/queries
```

Retrieve query audit log (for compliance).

## Integration Example

```javascript
// Query consent status
const response = await fetch("http://localhost:3001/consent/abc123...def456");
const result = await response.json();

if (result.active) {
  console.log("Donor consents to donate:", result.organs);
} else {
  console.log("No active consent found");
}
```

## Security

- All queries are logged for audit purposes
- Hospital provider authentication (optional, via API key)
- Read-only access to consent status
- No PII exposed in responses

## Error Handling

- `400`: Invalid ID hash format
- `401`: Missing or invalid API key
- `404`: Consent record not found
- `500`: Server error

## TODO

- [ ] Implement actual Soroban contract queries
- [ ] Add hospital provider registry and API key validation
- [ ] Implement audit log persistence
- [ ] Add rate limiting
- [ ] Add request logging and monitoring
