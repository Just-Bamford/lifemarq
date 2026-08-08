# Lifemarq Cross-Border Consent Federation

## Overview

Multiple African countries will run independent Lifemarq instances on Soroban.
Hospitals need to query donors registered in other countries' registries.

This document describes the federation model and API routing.

## Registry Instance Mapping

Each country runs its own contract instance on Stellar testnet/mainnet:

```
Country Code → Registry Contract Address Mapping
┌─────────────┬──────────────────────────────────────────────┐
│ Country     │ Registry Contract ID (Testnet)               │
├─────────────┼──────────────────────────────────────────────┤
│ KE (Kenya)  │ CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA... │
│ NG (Nigeria)│ CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB... │
│ SN (Senegal)│ CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC... │
│ DRC (Congo) │ CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD... │
│ GH (Ghana)  │ CEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE... │
└─────────────┴──────────────────────────────────────────────┘
```

## API Layer Implementation

### 1. Registry Configuration

Store contract addresses for each country:

```typescript
// lib/registry-config.ts
export const REGISTRY_CONTRACTS: Record<string, string> = {
  KE: process.env.REGISTRY_KE!,
  NG: process.env.REGISTRY_NG!,
  SN: process.env.REGISTRY_SN!,
  DRC: process.env.REGISTRY_DRC!,
  GH: process.env.REGISTRY_GH!,
};

export function getRegistryForCountry(countryCode: string): string {
  const contract = REGISTRY_CONTRACTS[countryCode];
  if (!contract) {
    throw new Error(`No registry configured for country: ${countryCode}`);
  }
  return contract;
}
```

### 2. Hospital Registry (Local)

Hospitals are registered locally with their country code:

```typescript
interface HospitalRecord {
  hospital_id: string;
  wallet: Address;
  name: string;
  country: string; // ← Country code (KE, NG, etc)
  license_number: string;
  is_verified: boolean;
  registered_at: u64;
}
```

### 3. Federated Query Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Hospital in Kenya queries donor in Nigeria                   │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ API: POST /consent/federated-query  │
        │ {                                   │
        │   donor_id_hash,                    │
        │   hospital_id,                      │
        │   donor_country_code: "NG"          │
        │ }                                   │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ Verify hospital in LOCAL registry   │
        │ (must be verified in Kenya)         │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ Look up Nigeria registry contract   │
        │ from REGISTRY_CONTRACTS['NG']       │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ Call contract.federated_query()     │
        │ on Nigeria registry with:           │
        │ - donor_id_hash                     │
        │ - hospital_id                       │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ Nigeria registry verifies hospital  │
        │ is in Kenya registry (via callback) │
        └─────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ Return consent status to Kenya API  │
        └─────────────────────────────────────┘
```

### 4. API Endpoint Implementation

```typescript
// api/routes/consent.ts

interface FederatedQueryRequest {
  donor_id_hash: string; // SHA-256 hash of donor's national ID
  hospital_id: string; // Querying hospital's ID
  donor_country_code: string; // Where donor is registered (e.g., "NG")
}

interface FederatedQueryResponse {
  is_consented: boolean;
  hospital_verified: boolean;
  donor_country: string;
  registry_contract: string;
  timestamp: number;
}

// POST /api/consent/federated-query
export async function federatedQuery(
  req: FederatedQueryRequest,
): Promise<FederatedQueryResponse> {
  const { donor_id_hash, hospital_id, donor_country_code } = req;

  // Step 1: Verify hospital in LOCAL registry
  const localRegistry = getRegistryForCountry(HOSPITAL_COUNTRY); // e.g., 'KE'
  const hospital = await client.get_hospital(localRegistry, hospital_id);

  if (!hospital || !hospital.is_verified) {
    throw new Error("Hospital not verified in local registry");
  }

  // Step 2: Get foreign registry contract
  const foreignRegistry = getRegistryForCountry(donor_country_code);
  if (!foreignRegistry) {
    throw new Error(`No registry found for country: ${donor_country_code}`);
  }

  // Step 3: Call federated_query on foreign registry
  const isConsented = await client.federated_query(
    localRegistry, // Local registry (for verification callback)
    foreignRegistry, // Foreign registry contract
    donor_id_hash, // Donor's hash
    hospital_id, // Hospital ID
  );

  return {
    is_consented: isConsented,
    hospital_verified: hospital.is_verified,
    donor_country: donor_country_code,
    registry_contract: foreignRegistry,
    timestamp: Date.now(),
  };
}
```

### 5. Hospital Verification Callback

When Nigeria registry receives federated_query, it needs to verify the hospital.

Since Soroban contracts can't make outbound calls directly, the verification is done by:

1. **Option A: Trust Chain** (Recommended for v1)
   - Assume all verified registries trust each other's verification
   - If hospital_id is in Nigeria's registry and verified locally, allow query
   - No callback needed

2. **Option B: Oracle/Backend Verification** (For v2+)
   - Backend maintains a "trusted hospitals" list
   - Each registry updates its trusted list periodically
   - Contracts reference the trusted list

For v1, use **Option A** - if hospital is verified in ANY registry, they can query across borders.

## Environment Configuration

```bash
# .env.local
REGISTRY_KE=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...
REGISTRY_NG=CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB...
REGISTRY_SN=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
REGISTRY_DRC=CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD...
REGISTRY_GH=CEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE...

# Local registry (where THIS API is deployed)
LOCAL_COUNTRY=KE
LOCAL_REGISTRY=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA...
```

## Error Handling

```typescript
interface FederatedQueryError {
  error: string;
  code: string;
  donor_country?: string;
  hospital_verified?: boolean;
}

// Errors:
- "HOSPITAL_NOT_VERIFIED" → Hospital not verified in local registry
- "COUNTRY_NOT_CONFIGURED" → No contract for donor's country
- "FOREIGN_REGISTRY_ERROR" → Foreign contract call failed
- "INVALID_DONOR_HASH" → Donor hash format invalid
```

## Security Model

### Trust Assumptions

1. ✅ Each country's registry is secure
2. ✅ Hospital verification is authoritative in each country
3. ✅ Cross-border queries DON'T bypass local hospital verification
4. ✅ Donor privacy is maintained (no unnecessary data transfer)

### Attack Mitigation

- ❌ Fake hospital can't query: must be verified in local registry
- ❌ Unverified country can't join: needs contract deployment + routing config
- ❌ Man-in-the-middle: Stellar blockchain provides cryptographic integrity

### Privacy

- Only hospital ID and donor hash sent across borders
- No PII leaked (hashes only)
- No consent details exposed to intermediaries

## Deployment Steps

1. **Deploy registries in each country**

   ```bash
   cd contract
   soroban contract deploy --network testnet --source KE_ADMIN
   soroban contract deploy --network testnet --source NG_ADMIN
   ```

2. **Configure routing in API**

   ```bash
   cp .env.example .env.local
   # Fill in contract addresses for each country
   ```

3. **Test federated query**
   ```bash
   curl -X POST http://localhost:3000/api/consent/federated-query \
     -H "Content-Type: application/json" \
     -d '{
       "donor_id_hash": "abc123...",
       "hospital_id": "KNH-001",
       "donor_country_code": "NG"
     }'
   ```

## Future Enhancements

1. **Multi-hop queries** → Query across 3+ countries
2. **Registry discovery** → Automatic contract address resolution
3. **Consent caching** → Cache frequently queried cross-border records
4. **Analytics** → Track cross-border queries by country pair
5. **Revocation sync** → When donor revokes in one country, sync across all

## Example: Kenya Hospital Querying Nigerian Donor

```
Kenya Hospital Nairobi (verified in KE registry)
  ↓
API: POST /consent/federated-query
  ↓
Check: Hospital verified in KE? YES ✓
  ↓
Lookup: Nigeria registry contract
  ↓
Call: contract.federated_query(NG_registry, donor_hash, hospital_id)
  ↓
Nigeria registry checks: Hospital verified somewhere? YES ✓
  ↓
Nigeria registry queries: Donor consent status → ACTIVE ✓
  ↓
Return: true (donor consented)
  ↓
Kenya API returns: { is_consented: true, donor_country: "NG" }
```

## Conclusion

This federation model enables:

- 🌍 Pan-African donor registry network
- 🔗 Cross-border queries without centralized hub
- 🔐 Each country maintains sovereignty over their data
- 🏥 Hospitals can access donors across borders legally
- 📊 Privacy-preserving (no personal data leaked)

The architecture scales to any number of countries without central coordination.
