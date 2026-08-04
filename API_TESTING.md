# API Testing Guide

Once the contract is deployed and API is running on localhost:3001, test these endpoints:

## 1. Health Check

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "network": "testnet",
  "contractId": "CXXXX...",
  "timestamp": "2025-09-14T10:23:00.000Z"
}
```

## 2. Query Non-Existent Donor

```bash
curl http://localhost:3001/consent/0000000000000000000000000000000000000000000000000000000000000000
```

Expected:

- Status: 200
- `consent_active: false`

## 3. Register Donor (via Frontend)

1. Open http://localhost:3000/donor
2. Click "Connect Freighter"
3. Enter national ID: `KE123456789`
4. Select organs: Kidney, Liver
5. Click "Register & Sign with Freighter"
6. Copy the hash from success message

## 4. Query Registered Donor

```bash
curl http://localhost:3001/consent/{HASH_FROM_STEP_3}
```

Expected:

```json
{
  "id_hash": "abc123...",
  "consent_active": true,
  "organs": ["kidney", "liver"],
  "queried_at": "2025-09-14T10:23:00.000Z"
}
```

## 5. Hospital Query

```bash
curl http://localhost:3001/consent/{HASH_FROM_STEP_3}
```

Should return same result as step 4.

## 6. Full Record Query

```bash
curl http://localhost:3001/consent/{HASH_FROM_STEP_3}/full
```

Expected:

```json
{
  "donor_id_hash": "abc123...",
  "wallet": "GXXXXX...",
  "organs": ["kidney", "liver"],
  "registered_at": 1234567890,
  "is_active": true
}
```

## 7. Revoke Consent (via Frontend)

1. Go back to http://localhost:3000/donor
2. Connect wallet again
3. Enter same national ID
4. Click "Revoke Consent"
5. Approve in Freighter

## 8. Verify Revocation

```bash
curl http://localhost:3001/consent/{HASH_FROM_STEP_3}
```

Expected:

- `consent_active: false`

## 9. Verify Public Status Page

Open: http://localhost:3000/status/{HASH_FROM_STEP_3}

After revocation, should show "No Active Consent"

## 10. Analytics

```bash
curl http://localhost:3001/analytics
```

Expected:

```json
{
  "donors": {
    "totalRegistered": 1,
    "registeredToday": 1,
    "registeredThisMonth": 1,
    "registeredThisYear": 1
  },
  "organDistribution": {
    "kidney": { "count": 1, "percentage": 50 },
    "liver": { "count": 1, "percentage": 50 }
  },
  "hospitals": {
    "totalQueries": 3,
    "queriesToday": 3,
    "queriesThisMonth": 3,
    "verifiedConsentCount": 2,
    "notVerifiedCount": 1,
    "errorCount": 0
  },
  "verificationTrends": [...],
  "systemHealth": {...}
}
```

## Deployment Testing

### Test API on Railway/Render

```bash
# Replace URL with your deployed API URL
curl https://your-api.railway.app/health
```

### Test Frontend on Vercel

1. Go to https://your-frontend.vercel.app/donor
2. Connect wallet and register
3. Verify query works
4. Check QR code downloads

### Test End-to-End

1. Register donor on Vercel frontend
2. Query via Vercel frontend hospital page
3. Verify Stellar Expert shows transaction: https://stellar.expert/explorer/testnet/tx/[TX_HASH]
4. Verify contract state on Stellar Expert: https://stellar.expert/explorer/testnet/contract/[CONTRACT_ID]

## Performance Monitoring

Check API response times:

```bash
time curl http://localhost:3001/consent/0000000000000000000000000000000000000000000000000000000000000000
```

Should respond in < 1 second for testnet.

## Error Scenarios

### Invalid Hash Format

```bash
curl http://localhost:3001/consent/invalid
```

Expected: 400 Bad Request with error message

### Network Error

Stop Soroban RPC or unplug network:

```bash
curl http://localhost:3001/consent/{VALID_HASH}
```

Expected: 503 Service Unavailable

### Missing Configuration

Stop API without CONTRACT_ID env var:

```bash
# Should fail at startup
npm run dev
```

Expected: Error message: "ERROR: CONTRACT_ID environment variable not set"

## Success Criteria

✅ Health check returns 200
✅ Non-existent donor returns 200 with consent_active: false
✅ Registered donor returns 200 with consent_active: true and organs list
✅ QR code generates and downloads as PNG
✅ Public status page shows verification without auth
✅ Revocation works and updates contract
✅ Query history logs in hospital dashboard
✅ Analytics endpoint aggregates metrics
✅ Both frontend and API are deployable
✅ Contract ID visible on Stellar Expert

If all tests pass, the appeal is ready to submit with live contract, API, and frontend URLs.
