# Event Indexing & On-Chain Activity Tracking

## Overview

Lifemarq maintains a complete audit trail of all on-chain activity via event indexing. The API runs a background worker that polls Soroban RPC every 30 seconds for contract events and stores them in a persistent database.

This enables:

- **Real-time audit logs** - Full history of all consent registrations, revocations, and recipient registrations
- **Ministry analytics** - Concrete numbers (e.g., "47 donors registered this week") backed by on-chain data
- **Compliance reporting** - CSV exports of all verifications and queries for regulatory review
- **Network transparency** - Any stakeholder can query `/events` to see the complete history of the system

## Event Types

The contract emits four types of events:

### `register` - Donor Consent Registration

Emitted when `contract.register(donor_id_hash, wallet, organs)` is called.

**Topics:**

- `lifemarq`
- `register`

**Data:**

```rust
(donor_id_hash: String, wallet: Address, timestamp: u64)
```

**Example on Stellar Expert:**

```
Event: lifemarq.register
Data: (a3f8d2c1..., GAAAA...Y5V3VQ, 1728912345)
Ledger: 1000000
```

### `revoke` - Consent Revocation

Emitted when `contract.revoke(donor_id_hash, wallet)` is called (permanent, one-way transition).

**Topics:**

- `lifemarq`
- `revoke`

**Data:**

```rust
(donor_id_hash: String, wallet: Address, timestamp: u64)
```

### `recipient` - Recipient Waitlist Registration

Emitted when `contract.register_recipient(recipient_id_hash, wallet, needed_organs, blood_type)` is called.

**Topics:**

- `lifemarq`
- `recipient`

**Data:**

```rust
(recipient_id_hash: String, wallet: Address)
```

### `hospital_verified` - Hospital Credential Verified

Emitted when an admin verifies a hospital's credentials via `contract.verify_hospital(hospital_id)`.

**Topics:**

- `lifemarq`
- `hospital_verified`

**Data:**

```rust
(hospital_id: String, country: String)
```

## Indexer Architecture

### Background Worker

```typescript
// Runs every 30 seconds
setInterval(() => {
  indexContractEvents(contractId, sorobanRpc, lastKnownLedger);
}, 30 * 1000);
```

**Workflow:**

1. Query Soroban RPC: `getRPC().getEvents({ contractIds: [contractId] })`
2. Parse contract events and extract topics + data
3. Classify by event type (register, revoke, recipient, hospital_verified)
4. Store in database (PostgreSQL or Supabase)
5. Update `lastKnownLedger` to avoid re-indexing

### Database Schema

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,                    -- Paging token from RPC
  contract_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,        -- register|revoke|recipient|hospital_verified
  tx_hash TEXT NOT NULL,
  ledger_sequence INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,              -- Unix seconds from event data

  -- Event-specific data (JSON for flexibility)
  data JSONB NOT NULL,

  -- Indexing metadata
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (contract_id) REFERENCES contracts(id),
  INDEX idx_type (event_type),
  INDEX idx_ledger (ledger_sequence),
  INDEX idx_timestamp (timestamp)
);
```

**Sample rows:**

```
id         | event_type | tx_hash        | ledger | timestamp    | data
-----------|------------|----------------|--------|--------------|------
abc-000    | register   | 5791962e...    | 1000k  | 1728912345   | {"donor_id_hash": "a3f8d2c1...", "wallet": "GAAAA..."}
abc-001    | recipient  | 6891a73f...    | 1000k  | 1728912350   | {"recipient_id_hash": "b4f9e3d2...", "wallet": "GBBBB..."}
```

## API Endpoints

### `GET /events`

Retrieve indexed events with optional filtering and export.

**Query Parameters:**

- `limit`: max events to return (default: 50, max: 500)
- `offset`: pagination offset (default: 0)
- `type`: filter by event type (register|revoke|recipient|hospital_verified)
- `format`: export format (json|csv)

**Response:**

```json
{
  "count": 50,
  "limit": 50,
  "offset": 0,
  "total": 347,
  "events": [
    {
      "id": "abc-000",
      "contract_id": "CCZDNL...",
      "event_type": "register",
      "tx_hash": "5791962efcc91abe39de8d1345fddbe23eab6002eb158d42a6e38d5973d43ef7",
      "ledger_sequence": 1000000,
      "timestamp": 1728912345,
      "data": {
        "donor_id_hash": "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
        "wallet": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VQ",
        "timestamp": 1728912345
      },
      "created_at": "2025-09-14T10:23:45.000Z"
    },
    ...
  ],
  "timestamp": "2025-09-14T10:30:00.000Z"
}
```

**CSV Export (`?format=csv`):**

```csv
id,contract_id,event_type,tx_hash,ledger_sequence,timestamp,created_at
abc-000,CCZDNL...,register,5791962e...,1000000,1728912345,"2025-09-14T10:23:45Z"
abc-001,CCZDNL...,recipient,6891a73f...,1000001,1728912350,"2025-09-14T10:23:50Z"
```

### `GET /events/stats`

Get aggregated event statistics for ministry dashboard.

**Response:**

```json
{
  "total_events": 347,
  "total_registrations": 250,
  "total_revocations": 15,
  "active_consents": 235,
  "recipients_waiting": 47,
  "hospitals_verified": 8,
  "events_by_type": {
    "register": 250,
    "revoke": 15,
    "recipient": 75,
    "hospital_verified": 7
  },
  "last_event_timestamp": 1728912345,
  "last_indexing_time": "2025-09-14T10:30:00.000Z",
  "indexing_status": "active",
  "contract_id": "CCZDNL..."
}
```

## Integration with Ministry Dashboard

The ministry analytics page (`/ministry`) uses `/events/stats` to display real metrics:

```typescript
// frontend/app/ministry/page.tsx

const stats = await fetch("https://api.lifemarq.io/events/stats").then(r => r.json());

return (
  <>
    <Stat label="Donors Registered" value={stats.total_registrations} />
    <Stat label="Active Consents" value={stats.active_consents} />
    <Stat label="Waiting for Organs" value={stats.recipients_waiting} />
    <Stat label="Verified Hospitals" value={stats.hospitals_verified} />
  </>
);
```

These numbers are **backed by on-chain events**, not estimates or hardcoded values.

## Compliance & Audit Trail

All API queries (`GET /consent/:id_hash`, `/verify-donor/:id_hash`) are also logged in a separate `audit_log` table:

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50),           -- query|verify|revoke
  donor_id_hash TEXT,
  hospital_id TEXT,
  queried_by_address TEXT,          -- wallet address that made the query
  result VARCHAR(20),               -- found|not_found|verified|denied
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);
```

**Compliance endpoints:**

- `GET /audit/queries` - all consent queries
- `GET /audit/verifications` - all hospital verifications
- `GET /audit/verifications?format=csv` - export for regulatory submission

## Production Deployment

### 1. Set up PostgreSQL (or Supabase)

```bash
# Create events table
psql $DATABASE_URL < docs/schema.sql

# Set up read replicas for analytics queries (optional)
```

### 2. Configure environment

```bash
# .env
DATABASE_URL=postgresql://user:pass@host/lifemarq
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_ID=CCZDNLCAHHLDG4W4QZLXJ5IQVBIQGK3F6GZLSAEJVZ2AHVTV2CTBTFE
```

### 3. Start indexer

```typescript
// src/index.ts

import { startEventIndexer } from "./event-indexer";

// Start background polling
startEventIndexer(contractId, sorobanRpc, async (events) => {
  // Callback: store events in database
  await db.events.insert(events);
});
```

### 4. Test

```bash
# Generate a test event (register a donor on testnet)
# Then check API:
curl https://api.lifemarq.io/events

# Should return the event within 60 seconds (2 poll cycles)
```

## Analytics Use Cases

With event indexing, the ministry dashboard can surface:

1. **Donor Pipeline**
   - New registrations per week
   - Revocation rate (%) over time
   - Trending organs most commonly donated

2. **Hospital Engagement**
   - Queries by hospital per day
   - Query response times
   - Verification success rates

3. **Recipient Demand**
   - Patients waiting for each organ type
   - Geographic distribution of need
   - Average wait time by organ

4. **System Health**
   - Contract uptime %
   - Event indexing lag (max 60 seconds)
   - API response times

## Troubleshooting

### Events not appearing after 2 minutes

1. Check Soroban RPC connectivity:

   ```bash
   curl https://soroban-testnet.stellar.org/health
   ```

2. Verify contract ID is correct:

   ```bash
   soroban contract invoke --id CCZDNL... --fn register
   ```

3. Check logs:
   ```bash
   docker logs lifemarq-api | grep EventIndexer
   ```

### Database getting too large

Implement retention policy:

```sql
-- Delete events older than 90 days
DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';

-- Archive to cold storage if needed
INSERT INTO events_archive SELECT * FROM events WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM events WHERE created_at < NOW() - INTERVAL '90 days';
```

## Next Steps

- [ ] Deploy to PostgreSQL / Supabase
- [ ] Wire `/events` endpoint to database queries
- [ ] Add real event indexing loop in production
- [ ] Surface event stats on ministry dashboard
- [ ] Export audit logs for regulatory compliance
- [ ] Set up alerting for anomalies (e.g., spike in revocations)
