# Contributing to Lifemarq

Thank you for your interest in contributing to Lifemarq. We're building immutable organ donor infrastructure on Stellar, and we welcome contributors from all backgrounds.

## Getting Started

1. **Read the architecture** — Start with [`docs/architecture.md`](docs/architecture.md) to understand the system design
2. **Clone the repo** — `git clone https://github.com/Just-Bamford/lifemarq.git`
3. **Set up your environment** — See [`docs/environment.md`](docs/environment.md) for tooling requirements

## Project Structure

```
lifemarq/
├── contract/          # Rust Soroban smart contract
├── api/               # Node.js hospital query API
├── frontend/          # Next.js donor portal & hospital dashboard
└── docs/              # Architecture, spec, deployment guides
```

## Making Contributions

### Small Fixes (typos, docs, simple bugs)

1. Create a branch: `git checkout -b fix/your-fix-name`
2. Make your change
3. Commit: `git commit -m "fix: clear description"`
4. Push and open a PR

### Features (new functionality)

1. **Check for an open issue** — We may already be working on it
2. **Open an issue first** — Describe what you want to build and why
3. **Get feedback** — Wait for maintainer approval before starting
4. **Create a branch** — `git checkout -b feat/your-feature-name`
5. **Build and test** — See testing guide below
6. **Open a PR** — Link to the issue, describe your approach

### Testing

#### Contract (Rust)

```bash
cd contract
cargo test
```

All tests must pass. Add new tests for any new functionality.

#### API (Node.js)

```bash
cd api
npm install
npm test
```

#### Frontend (Next.js)

```bash
cd frontend
npm install
npm run build
```

## Code Standards

- **Rust** — Follow Rust conventions. Run `cargo fmt` before committing.
- **TypeScript** — Use strict mode, explicit types. Follow [`docs/standards.md`](docs/standards.md)
- **Tests** — New code must include tests. Aim for >80% coverage.
- **Commits** — Use clear, conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`)

## Issue Labels

- **`good first issue`** — Perfect for newcomers. Well-scoped, low complexity.
- **`help wanted`** — We actively need help with this.
- **`enhancement`** — Feature request or improvement.
- **`bug`** — Something is broken.
- **`testing`** — Tests, coverage, or CI improvements.
- **`documentation`** — Docs or README updates.
- **`devops`** — Deployment, infrastructure, or build tooling.

## Submitting a PR

1. **Branch naming** — Use `fix/`, `feat/`, `docs/`, `test/`, `chore/` prefixes
2. **Title** — Concise, under 70 characters
3. **Description** — Explain what changed and why
4. **Tests** — All tests pass (`cargo test`, `npm test`)
5. **Linked issue** — Reference the issue you're fixing (e.g., `Fixes #42`)

Example PR:

```
fix: query endpoint returns 200 for revoked consent

Previously, GET /consent/:id_hash returned 404 for revoked donors.
Now returns 200 with consent_active: false for better hospital integration.

Fixes #18
```

## Deployment

Do not deploy to production without:

- [ ] All tests passing
- [ ] Another maintainer approval
- [ ] Security review (for auth, data, or contract changes)

See [`docs/deployment.md`](docs/deployment.md) for deployment procedures.

## Questions?

Open an issue, leave a comment, or reach out. We're here to help.

---

**Code of Conduct** — Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). We're committed to a welcoming, inclusive community.
