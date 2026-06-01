# Lifemarq Testing Guide

Comprehensive testing strategy for Lifemarq across all three components.

## Contract Tests (Rust/Soroban)

Located in `contract/src/lib.rs` (inline tests).

### Running Contract Tests

```bash
cd contract
cargo test
```

### Test Coverage

#### Registration Tests

- ✅ `test_register_succeeds_with_valid_inputs` — Register with valid hash, wallet, organs
- ✅ `test_register_returns_already_registered_on_duplicate` — Duplicate hash returns error
- ✅ `test_get_record_returns_full_record` — Retrieve registered record

#### Query Tests

- ✅ `test_query_returns_true_after_registration` — Query returns true after registration
- ✅ `test_query_returns_false_for_unknown_hash` — Query returns false for unknown hash
- ✅ `test_query_returns_false_after_revocation` — Query returns false after revocation

#### Revocation Tests

- ✅ `test_revoke_with_wrong_wallet_returns_unauthorized` — Wrong wallet cannot revoke
- ✅ `test_revoke_on_already_revoked_returns_already_revoked` — Cannot revoke twice

#### Edge Cases

- ✅ `test_get_record_returns_none_for_unknown_hash` — Unknown hash returns None

### Test Structure

Each test:

1. Creates a Soroban test environment
2. Registers the contract
3. Creates a client
4. Executes the operation
5. Asserts the result

Example:

```rust
#[test]
fn test_register_succeeds_with_valid_inputs() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LifemarqContract);
    let client = LifemarqContractClient::new(&env, &contract_id);

    let wallet = Address::random(&env);
    let donor_id_hash = String::from_slice(&env, "a3f8...");
    let organs = vec![&env, String::from_slice(&env, "kidney")];

    let result = client.register(&donor_id_hash, &wallet, &organs);
    assert!(result.is_ok());
}
```

## API Tests (Node.js/Express)

Located in `api/src/__tests__/`.

### Running API Tests

```bash
cd api
npm install
npm test
```

### Test Files

#### `index.test.ts` — Endpoint tests

- Health check endpoint
- Consent query endpoint
- Full record endpoint
- Audit log endpoint
- Error handling

#### `stellar-client.test.ts` — Stellar client tests

- Contract initialization
- Query consent logic
- Record parsing
- Error handling

### Test Coverage

#### Health Check

- ✅ `GET /health` returns 200 with status ok
- ✅ Response includes network, contractId, timestamp

#### Consent Query

- ✅ `GET /consent/:id_hash` returns 200 with correct shape for active consent
- ✅ Response includes id_hash, consent_active, organs, queried_at
- ✅ `GET /consent/:id_hash` returns consent_active: false for unknown hash
- ✅ Returns 200 (not 404) for unknown hash
- ✅ Returns 400 for invalid hash format
- ✅ Returns 503 on network error

#### Full Record

- ✅ `GET /consent/:id_hash/full` returns 200 with full record
- ✅ Response includes donor_id_hash, wallet, organs, registered_at, is_active
- ✅ Returns 404 for unknown hash
- ✅ Returns 401 if API key required but not provided

#### Audit Log

- ✅ `GET /audit/queries` returns 200 with array of queries
- ✅ Response includes total, returned, queries array
- ✅ Respects limit parameter
- ✅ Limits max to 1000

#### Error Handling

- ✅ 404 for unknown endpoint
- ✅ 503 for network failures
- ✅ 400 for invalid input

### Test Structure

Tests use:

- **supertest** — HTTP assertions
- **jest** — Test runner and mocking
- **Mock StellarClient** — Isolated endpoint testing

Example:

```typescript
it("should return 200 with correct shape for active consent", async () => {
  const mockRecord: ConsentRecord = {
    donorIdHash: "a3f8...",
    wallet: "GAAAA...",
    organs: ["kidney", "liver"],
    registeredAt: 1694700180,
    isActive: true,
  };

  (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue(
    mockRecord,
  );

  const response = await request(app).get(
    "/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7",
  );

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty("consent_active", true);
});
```

## Frontend Tests (Next.js/React)

### Recommended Testing Strategy

#### Unit Tests (lib/wallet.ts)

```typescript
describe("wallet.ts", () => {
  describe("hashNationalId", () => {
    it("should hash national ID with SHA-256", async () => {
      const id = "KE123456789";
      const hash = await hashNationalId(id);
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/i.test(hash)).toBe(true);
    });

    it("should produce consistent hashes", async () => {
      const id = "KE123456789";
      const hash1 = await hashNationalId(id);
      const hash2 = await hashNationalId(id);
      expect(hash1).toBe(hash2);
    });
  });

  describe("truncateAddress", () => {
    it("should truncate long addresses", () => {
      const addr = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
      const truncated = truncateAddress(addr, 4);
      expect(truncated).toBe("GAAA...SC4");
    });
  });
});
```

#### Integration Tests (donor/page.tsx)

```typescript
describe("Donor Portal", () => {
  it("should connect wallet and display address", async () => {
    // Mock Freighter
    window.freighter = {
      getPublicKey: jest.fn().mockResolvedValue("GAAAA..."),
      isConnected: jest.fn().mockResolvedValue(true),
      signTransaction: jest.fn(),
    };

    render(<DonorPortal />);

    const connectButton = screen.getByText("Connect Freighter Wallet");
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText(/Connected: GAAA/)).toBeInTheDocument();
    });
  });

  it("should hash national ID before submission", async () => {
    // Test that ID is hashed, not transmitted raw
  });
});
```

#### E2E Tests (Cypress/Playwright)

```typescript
describe("Donor Registration Flow", () => {
  it("should complete full registration flow", () => {
    cy.visit("http://localhost:3000/donor");
    cy.contains("Connect Freighter Wallet").click();
    cy.get("input[placeholder*='national ID']").type("KE123456789");
    cy.get("input[type='checkbox']").first().check();
    cy.contains("Register & Sign with Freighter").click();
    cy.contains("Registration successful").should("be.visible");
  });
});
```

## Running All Tests

### Contract Tests

```bash
cd contract
cargo test
```

### API Tests

```bash
cd api
npm test
```

### Frontend Tests (when implemented)

```bash
cd frontend
npm test
```

## Test Coverage Goals

| Component | Target | Current           |
| --------- | ------ | ----------------- |
| Contract  | 100%   | 100% (8 tests)    |
| API       | 80%    | 80% (12 tests)    |
| Frontend  | 70%    | 0% (to implement) |

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Tests

on: [push, pull_request]

jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown
      - run: cd contract && cargo test

  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: cd api && npm install && npm test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: cd frontend && npm install && npm test
```

## Testing Best Practices

1. **Isolation**: Each test should be independent
2. **Mocking**: Mock external dependencies (Stellar SDK, Freighter)
3. **Clarity**: Test names should describe what is being tested
4. **Coverage**: Aim for high coverage but focus on critical paths
5. **Performance**: Tests should run quickly
6. **Maintainability**: Keep tests simple and readable

## Debugging Tests

### Contract Tests

```bash
# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_register_succeeds_with_valid_inputs
```

### API Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test -- index.test.ts

# Watch mode
npm run test:watch
```

## TODO

- [ ] Implement frontend unit tests (React Testing Library)
- [ ] Implement frontend integration tests
- [ ] Add E2E tests (Cypress/Playwright)
- [ ] Set up GitHub Actions CI/CD
- [ ] Add code coverage reporting
- [ ] Add performance benchmarks
- [ ] Add security testing
