# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Lifemarq, please do **not** open a public GitHub issue. Instead, email the maintainers directly at **security@lifemarq.dev** with:

1. Description of the vulnerability
2. Steps to reproduce (if applicable)
3. Potential impact assessment
4. Suggested fix (if you have one)

Please allow up to 72 hours for an initial response.

## Security Considerations

### Smart Contract

- The Soroban contract is the single source of truth for consent state
- All state transitions require wallet authentication via `wallet.require_auth()`
- Consent records are immutable once registered — only the original signer can revoke
- No personally identifiable information (PII) is stored on-chain
- National IDs are hashed client-side using SHA-256 before submission

### API

- Hospital query endpoints (`GET /consent/:id_hash`) are public read operations
- Full record endpoints (`GET /consent/:id_hash/full`) require hospital API key authentication
- All API calls are logged for audit purposes
- Rate limiting is enforced per API key
- HTTPS is required for all production endpoints

### Frontend

- National IDs are hashed immediately upon input using SHA-256 (via `tweetnacl.js` or similar)
- The raw national ID never leaves the browser
- Freighter wallet integration handles all transaction signing
- Wallet private keys are never stored server-side

## Security Audit

The Lifemarq contract underwent an independent security review. See [`docs/security-audit.md`](docs/security-audit.md) for findings and remediation status.

## Disclosure Timeline

We follow a coordinated disclosure policy:

1. Vulnerability reported to maintainers
2. Maintainers acknowledge receipt within 24 hours
3. Investigation and fix development (typically 7-14 days)
4. Fix deployed and verified
5. Disclosure published with credit to reporter (unless they request anonymity)

## Security Best Practices

When deploying Lifemarq:

- [ ] Use environment variables for sensitive config (API keys, RPC URLs, database credentials)
- [ ] Enable HTTPS for all endpoints
- [ ] Implement rate limiting on public API endpoints
- [ ] Regularly rotate database credentials and API keys
- [ ] Monitor audit logs for suspicious activity
- [ ] Keep Soroban SDK and dependencies up to date
- [ ] Use a hardware security module (HSM) for production wallet keys (if managing keys server-side)

## Bug Bounty

We do not currently offer a formal bug bounty program, but we recognize and credit security researchers who responsibly disclose vulnerabilities.
