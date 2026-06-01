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
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
PORT=3001
ENABLE_PROVIDER_AUTH=false
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

Returns API status and configuration.

**Response:**

```json
{
  "status": "ok",
  "network": "testnet",
  "contractId": "CAAAA...",
  "timestamp": "2025-09-14T10:23:00Z"
}
```

### Query Consent Status

```
GET /consent/:id_hash
```

Query a patient's organ donation consent status.

**Parameters:**

- `id_hash` (path): SHA-256 hash of patient national ID (64-char hex string)

**Response (Consent Active):**

```json
{
  "id_hash": "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
  "consent_active": true,
  "organs": ["kidney", "liver"],
  "queried_at": "2025-09-14T10:23:00Z"
}
```

**Response (No Consent):**

```json
{
  "id_hash": "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
  "consent_active": false,
  "organs": [],
  "queried_at": "2025-09-14T10:23:00Z"
}
```

**Note:** Returns 200 regardless of consent status. A 404 would be ambiguous.

### Get Full Consent Record

```
GET /consent/:id_hash/full
```

Retrieve the complete consent record (optional API key required).

**Headers:**

- `X-API-Key` (optional): Hospital provider API key

**Response:**

```json
{
  "donor_id_hash": "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
  "wallet": "GAAAA...",
  "organs": ["kidney", "liver"],
  "registered_at": 1694700180,
  "is_active": true
}
```

### Audit Log

```
GET /audit/queries
```

Retrieve query audit log for compliance.

**Query Parameters:**

- `limit` (optional): Maximum number of entries to return (default: 100, max: 1000)

**Response:**

```json
{
  "total": 42,
  "returned": 10,
  "queries": [
    {
      "id_hash": "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
      "queried_at": "2025-09-14T10:23:00Z",
      "result": {
        "consent_active": true,
        "organs": ["kidney", "liver"]
      }
    }
  ]
}
```

## Integration Example

```javascript
// Query consent status
const response = await fetch(
  "http://localhost:3001/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
);
const result = await response.json();

if (result.consent_active) {
  console.log("Donor consents to donate:", result.organs);
} else {
  console.log("No active consent found");
}
```

## Error Handling

| Status | Error                    | Meaning                                   |
| ------ | ------------------------ | ----------------------------------------- |
| 400    | Invalid ID hash format   | Hash must be 64-char hex SHA-256          |
| 401    | API key required         | Provider auth enabled but no key provided |
| 404    | Consent record not found | Record doesn't exist (full endpoint only) |
| 503    | registry_unavailable     | Soroban RPC unreachable or contract error |
| 500    | Internal server error    | Unexpected error                          |

## Security

- All queries are logged for audit purposes
- Hospital provider authentication via API key (optional)
- Read-only access to consent status
- No PII exposed in responses (only hashed IDs)
- CORS enabled for hospital systems
- Rate limiting recommended for production

## Architecture

The API uses the Stellar SDK to:

1. Build contract invocation transactions
2. Simulate them against Soroban RPC (read-only, no submission)
3. Parse XDR results into TypeScript objects
4. Return JSON responses to hospital systems

All queries are logged in-memory for audit trail. For production, implement persistent storage (database).

## Implementation Details

### stellar-client.ts

- `queryConsent(idHash)` — Returns boolean (true if active)
- `getRecord(idHash)` — Returns full ConsentRecord or null
- Uses Soroban RPC for read-only contract queries
- Parses XDR responses into TypeScript objects

### index.ts

- Express server with 4 endpoints
- In-memory audit logging
- Error handling with 503 for network failures
- CORS and JSON middleware

## TODO

- [ ] Implement persistent audit log (database)
- [ ] Add hospital provider registry and API key validation
- [ ] Implement rate limiting
- [ ] Add request logging and monitoring
- [ ] Add metrics/observability
- [ ] Implement caching for frequently queried records
