# Lifemarq Frontend

Next.js frontend for the Lifemarq organ donor registry. Includes donor portal and hospital query interface.

## Features

- **Donor Portal** (`/donor`): Register organ donation preferences via Freighter wallet
- **Hospital Query** (`/hospital`): Query patient consent status before surgery
- **Client-Side Hashing**: National IDs hashed with SHA-256 before any on-chain write
- **Privacy-First**: No PII stored on-chain or transmitted to servers
- **Freighter Integration**: Secure wallet signing for transactions

## Setup

```bash
npm install
```

## Configuration

Create `.env.local` (copy from `.env.local.example`):

```env
NEXT_PUBLIC_CONTRACT_ID=<deployed-contract-id>
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Running

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
npm run build
npm start
```

## Pages

### Home (`/`)

Overview of Lifemarq and links to donor portal and hospital query.

### Donor Portal (`/donor`)

**Flow:**

1. Connect Freighter wallet
2. Enter national ID (hashed client-side with SHA-256)
3. Select organs to donate
4. Sign transaction with Freighter
5. Submit to Soroban contract
6. Confirmation with hashed ID

**Key Features:**

- National ID never leaves browser (hashed before transmission)
- Freighter wallet integration for secure signing
- Real-time transaction status
- Success confirmation with audit trail

### Hospital Query (`/hospital`)

**Flow:**

1. Enter patient ID hash (SHA-256)
2. Query the API
3. Display consent status and organs
4. Show audit timestamp

**Key Features:**

- Simple, clear consent status display
- Organ list if consent is active
- Neutral messaging if no consent found
- Error handling without technical jargon

## Wallet Integration

The frontend uses Freighter wallet for signing transactions.

**Requirements:**

- Freighter browser extension installed
- Wallet configured for Stellar Testnet (during development)

**Functions** (in `lib/wallet.ts`):

- `connectWallet()` — Connect to Freighter
- `isConnected()` — Check connection status
- `signTransaction(xdr, network)` — Sign transaction
- `hashNationalId(id)` — Hash ID with SHA-256
- `truncateAddress(address)` — Format address for display

## API Integration

The hospital query page connects to the backend REST API.

**Endpoints:**

- `GET /health` — Health check
- `GET /consent/:id_hash` — Query consent status
- `GET /consent/:id_hash/full` — Get full record (auth optional)
- `GET /audit/queries` — Audit log

## Privacy & Security

- **Client-Side Hashing**: National IDs hashed with SHA-256 in browser
- **No PII Transmission**: Only hashed IDs sent to servers
- **Wallet Signing**: All transactions signed with Freighter
- **No Local Storage**: Sensitive data not persisted
- **HTTPS Only**: Production deployment requires HTTPS

## Build

```bash
npm run build
npm start
```

## Troubleshooting

### Freighter not detected

- Ensure Freighter extension is installed: https://freighter.app
- Refresh the page after installing Freighter
- Check browser console for errors

### Contract ID not configured

- Verify `NEXT_PUBLIC_CONTRACT_ID` is set in `.env.local`
- Ensure contract is deployed to testnet
- Check contract ID format (should start with `C`)

### API connection failed

- Verify `NEXT_PUBLIC_API_URL` is correct
- Ensure API server is running on the configured port
- Check CORS configuration on API

### Transaction signing failed

- Ensure Freighter is connected to Stellar Testnet
- Check that wallet has sufficient XLM for fees
- Verify contract ID matches deployed contract

## Architecture

```
Frontend (Next.js)
├── Donor Portal
│   ├── Freighter wallet connection
│   ├── SHA-256 hashing (client-side)
│   ├── Transaction building
│   ├── Freighter signing
│   └── Soroban RPC submission
└── Hospital Query
    ├── Hash input validation
    ├── API query
    └── Result display
```

## Implementation Details

### lib/wallet.ts

- Freighter wallet integration
- SHA-256 hashing using Web Crypto API
- Address truncation for display

### app/donor/page.tsx

- Three-state UI (idle, submitting, success)
- Wallet connection flow
- Transaction building and signing
- Success confirmation

### app/hospital/page.tsx

- Hash input validation
- API query with error handling
- Clear consent status display
- Audit trail timestamp

## TODO

- [ ] Add revocation flow (donor can revoke consent)
- [ ] Implement persistent wallet connection
- [ ] Add transaction history
- [ ] Implement caching for queries
- [ ] Add mobile-responsive improvements
- [ ] Add accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Implement analytics
