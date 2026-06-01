# Lifemarq Code Standards

Coding standards and best practices for all components.

## TypeScript Standards

### No `any` Types

❌ **Bad:**

```typescript
function processData(data: any): any {
  return data.value;
}
```

✅ **Good:**

```typescript
interface DataPayload {
  value: string;
}

function processData(data: DataPayload): string {
  return data.value;
}
```

### Define Interfaces for All API Responses

❌ **Bad:**

```typescript
const response = await fetch("/consent/hash");
const data = response.json();
console.log(data.consent_active);
```

✅ **Good:**

```typescript
interface ConsentResponse {
  id_hash: string;
  consent_active: boolean;
  organs: string[];
  queried_at: string;
}

const response = await fetch("/consent/hash");
const data: ConsentResponse = await response.json();
console.log(data.consent_active);
```

### Define Interfaces for Contract Return Values

❌ **Bad:**

```typescript
const record = await contract.get_record(hash);
console.log(record.is_active);
```

✅ **Good:**

```typescript
interface ConsentRecord {
  donorIdHash: string;
  wallet: string;
  organs: string[];
  registeredAt: number;
  isActive: boolean;
}

const record: ConsentRecord = await contract.get_record(hash);
console.log(record.isActive);
```

## Error Handling Standards

### All Async Functions Must Have Try/Catch

❌ **Bad:**

```typescript
async function queryConsent(hash: string) {
  const response = await fetch(`/consent/${hash}`);
  return response.json();
}
```

✅ **Good:**

```typescript
async function queryConsent(hash: string): Promise<ConsentResponse> {
  try {
    const response = await fetch(`/consent/${hash}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error querying consent:", error);
    throw error;
  }
}
```

### Errors Must Surface to User, Not Console

❌ **Bad:**

```typescript
try {
  await registerDonor(data);
} catch (error) {
  console.error("Registration failed:", error);
  // User sees nothing
}
```

✅ **Good:**

```typescript
try {
  await registerDonor(data);
  setMessage("Registration successful");
  setMessageType("success");
} catch (error: any) {
  const userMessage = error.message || "Registration failed";
  setMessage(userMessage);
  setMessageType("error");
}
```

### Error Messages Must Be User-Friendly

❌ **Bad:**

```typescript
throw new Error("ECONNREFUSED: Connection refused at 127.0.0.1:3001");
```

✅ **Good:**

```typescript
throw new Error("Unable to reach the registry. Please try again.");
```

## Privacy Standards

### National ID Must Never Appear in Logs

❌ **Bad:**

```typescript
const nationalId = "KE123456789";
console.log("Registering donor:", nationalId);
const hash = await hashNationalId(nationalId);
```

✅ **Good:**

```typescript
const nationalId = "KE123456789";
const hash = await hashNationalId(nationalId);
console.log("Registering donor with hash:", hash.substring(0, 16) + "...");
```

### National ID Must Never Be Transmitted Raw

❌ **Bad:**

```typescript
const response = await fetch("/register", {
  method: "POST",
  body: JSON.stringify({
    nationalId: "KE123456789",
    organs: ["kidney"],
  }),
});
```

✅ **Good:**

```typescript
const nationalId = "KE123456789";
const idHash = await hashNationalId(nationalId);

const response = await fetch("/register", {
  method: "POST",
  body: JSON.stringify({
    idHash,
    organs: ["kidney"],
  }),
});
```

### National ID Must Never Be Stored in Component State

❌ **Bad:**

```typescript
const [nationalId, setNationalId] = useState("");
const [idHash, setIdHash] = useState("");

const handleRegister = async () => {
  const hash = await hashNationalId(nationalId);
  setIdHash(hash);
  // nationalId still in state
};
```

✅ **Good:**

```typescript
const [idHash, setIdHash] = useState("");

const handleRegister = async (nationalId: string) => {
  const hash = await hashNationalId(nationalId);
  setIdHash(hash);
  // nationalId is local variable, not stored
};
```

## Rust/Soroban Standards

### Use DataKey Enum for Storage Keys

❌ **Bad:**

```rust
env.storage()
  .persistent()
  .set(&"consent_" + &donor_id_hash, &record);
```

✅ **Good:**

```rust
env.storage()
  .persistent()
  .set(&DataKey::Consent(donor_id_hash), &record);
```

### require_auth() Must Be First in Mutating Functions

❌ **Bad:**

```rust
pub fn register(
    env: Env,
    donor_id_hash: String,
    wallet: Address,
    organs: Vec<String>,
) -> Result<(), ContractError> {
    // Check if already registered
    if env.storage().persistent().has(&DataKey::Consent(donor_id_hash.clone())) {
        return Err(ContractError::AlreadyRegistered);
    }

    // THEN require auth
    wallet.require_auth();

    // ...
}
```

✅ **Good:**

```rust
pub fn register(
    env: Env,
    donor_id_hash: String,
    wallet: Address,
    organs: Vec<String>,
) -> Result<(), ContractError> {
    // require_auth() FIRST
    wallet.require_auth();

    // Then check if already registered
    if env.storage().persistent().has(&DataKey::Consent(donor_id_hash.clone())) {
        return Err(ContractError::AlreadyRegistered);
    }

    // ...
}
```

### Use Result Types for Error Handling

❌ **Bad:**

```rust
pub fn revoke(env: Env, donor_id_hash: String, wallet: Address) -> ConsentRecord {
    let record = env.storage().persistent().get(&DataKey::Consent(donor_id_hash))
        .expect("Record not found");
    // ...
}
```

✅ **Good:**

```rust
pub fn revoke(
    env: Env,
    donor_id_hash: String,
    wallet: Address,
) -> Result<(), ContractError> {
    let record = env.storage().persistent()
        .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash))
        .ok_or(ContractError::NotFound)?;
    // ...
}
```

## Node.js/Express Standards

### Define Request/Response Types

❌ **Bad:**

```typescript
app.get("/consent/:id_hash", async (req, res) => {
  const result = await stellarClient.getRecord(req.params.id_hash);
  res.json(result);
});
```

✅ **Good:**

```typescript
interface ConsentQueryRequest {
  id_hash: string;
}

interface ConsentQueryResponse {
  id_hash: string;
  consent_active: boolean;
  organs: string[];
  queried_at: string;
}

app.get("/consent/:id_hash", async (req: Request, res: Response) => {
  try {
    const { id_hash } = req.params as ConsentQueryRequest;
    const record = await stellarClient.getRecord(id_hash);
    const response: ConsentQueryResponse = {
      id_hash,
      consent_active: record?.isActive || false,
      organs: record?.organs || [],
      queried_at: new Date().toISOString(),
    };
    res.json(response);
  } catch (error) {
    res.status(503).json({ error: "registry_unavailable" });
  }
});
```

### Validate All Inputs

❌ **Bad:**

```typescript
app.get("/consent/:id_hash", async (req, res) => {
  const record = await stellarClient.getRecord(req.params.id_hash);
  res.json(record);
});
```

✅ **Good:**

```typescript
app.get("/consent/:id_hash", async (req, res) => {
  const { id_hash } = req.params;

  // Validate format
  if (!id_hash || id_hash.length !== 64 || !/^[a-f0-9]{64}$/i.test(id_hash)) {
    return res.status(400).json({
      error: "Invalid ID hash format (must be 64-char hex SHA-256)",
    });
  }

  try {
    const record = await stellarClient.getRecord(id_hash);
    res.json(record);
  } catch (error) {
    res.status(503).json({ error: "registry_unavailable" });
  }
});
```

## Testing Standards

### All Tests Must Pass

- No skipped tests (`.skip`)
- No pending tests (`.todo`)
- All assertions must pass

### Test Names Must Be Descriptive

❌ **Bad:**

```rust
#[test]
fn test1() {
    // ...
}
```

✅ **Good:**

```rust
#[test]
fn test_register_succeeds_with_valid_inputs() {
    // ...
}
```

### Mock External Dependencies

❌ **Bad:**

```typescript
it("should query consent", async () => {
  const response = await request(app).get("/consent/hash");
  // Depends on real Stellar RPC
});
```

✅ **Good:**

```typescript
it("should query consent", async () => {
  (StellarClient.prototype.getRecord as jest.Mock).mockResolvedValue({
    donorIdHash: "hash",
    isActive: true,
    organs: ["kidney"],
  });

  const response = await request(app).get("/consent/hash");
  expect(response.status).toBe(200);
});
```

## Documentation Standards

### All Public Functions Must Have JSDoc/Comments

❌ **Bad:**

```typescript
export async function hashNationalId(id: string): Promise<string> {
  const encoded = new TextEncoder().encode(id.trim().toUpperCase());
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

✅ **Good:**

```typescript
/**
 * Hash a national ID using SHA-256
 * @param id - National ID to hash
 * @returns SHA-256 hash as hex string (64 characters)
 */
export async function hashNationalId(id: string): Promise<string> {
  const encoded = new TextEncoder().encode(id.trim().toUpperCase());
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

## Code Review Checklist

- [ ] No `any` types
- [ ] All interfaces defined
- [ ] All async functions have try/catch
- [ ] Errors surface to user
- [ ] No PII in logs
- [ ] No raw national IDs transmitted
- [ ] DataKey enum used for storage
- [ ] require_auth() is first
- [ ] All inputs validated
- [ ] All tests pass
- [ ] JSDoc comments present
- [ ] No console.log in production code

## Linting

### TypeScript

```bash
npm run lint
```

### Rust

```bash
cargo clippy
```

## Formatting

### TypeScript

```bash
npx prettier --write src/
```

### Rust

```bash
cargo fmt
```
