# Lifemarq Frontend

Next.js frontend for the Lifemarq organ donor registry. Includes donor portal and hospital query interface.

## Features

- **Donor Portal**: Register organ donation preferences via Freighter wallet
- **Hospital Query**: Query patient consent status before surgery
- **Client-Side Hashing**: National IDs hashed with SHA-256 before any on-chain write
- **Privacy-First**: No PII stored on-chain

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=<deployed-contract-id>
NEXT_PUBLIC_NETWORK=testnet
```

## Pages

- `/` — Home page with overview
- `/donor` — Donor registration portal
- `/hospital` — Hospital consent query interface

## Wallet Integration

The donor portal uses Freighter wallet for signing transactions. Ensure Freighter is installed and configured for Stellar Testnet.

## API Integration

The hospital query page connects to the backend REST API at `NEXT_PUBLIC_API_URL`.

## Build

```bash
npm run build
npm start
```
