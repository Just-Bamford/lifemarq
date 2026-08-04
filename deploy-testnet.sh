#!/bin/bash
# Lifemarq Contract Deployment to Stellar Testnet
# This script builds and deploys the contract, then outputs configuration

set -e

echo "======================================"
echo "Lifemarq Contract Deployment"
echo "======================================"

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v soroban &> /dev/null; then
    echo "❌ ERROR: Soroban CLI not found"
    echo "Install from: https://soroban.stellar.org/docs/learn/setup"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ ERROR: Rust cargo not found"
    echo "Install from: https://www.rust-lang.org/tools/install"
    exit 1
fi

NETWORK="testnet"
SOURCE_ACCOUNT="testnet-account"

echo "✓ Soroban CLI: $(soroban --version)"
echo "✓ Rust: $(cargo --version)"

# Step 1: Build contract
echo ""
echo "Step 1: Building contract WASM..."
cd contract
cargo build --target wasm32-unknown-unknown --release

WASM_FILE="target/wasm32-unknown-unknown/release/lifemarq_contract.wasm"
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ ERROR: WASM file not found at $WASM_FILE"
    exit 1
fi

WASM_SIZE=$(du -h "$WASM_FILE" | cut -f1)
echo "✓ Built: $WASM_FILE ($WASM_SIZE)"

# Step 2: Verify testnet account exists
echo ""
echo "Step 2: Verifying testnet account..."

if ! soroban config identity show $SOURCE_ACCOUNT --network $NETWORK &> /dev/null; then
    echo "⚠ Account '$SOURCE_ACCOUNT' not found"
    echo "Creating account..."
    soroban config identity generate --global $SOURCE_ACCOUNT --network $NETWORK
    
    echo ""
    echo "Account created! Now fund it with testnet XLM:"
    ACCOUNT_ID=$(soroban config identity show $SOURCE_ACCOUNT --network $NETWORK)
    echo "  Account ID: $ACCOUNT_ID"
    echo ""
    echo "1. Go to: https://laboratory.stellar.org"
    echo "2. Paste account ID and create a testnet account, OR"
    echo "3. Use friendbot: curl https://friendbot.stellar.org?addr=$ACCOUNT_ID"
    echo ""
    read -p "Press Enter after funding the account..."
fi

# Check balance
BALANCE=$(soroban config identity balance $SOURCE_ACCOUNT --network $NETWORK 2>/dev/null || echo "0")
echo "✓ Account balance: $BALANCE XLM"

if [ "$BALANCE" = "0" ]; then
    echo "❌ ERROR: Account has no balance. Fund it first"
    exit 1
fi

# Step 3: Deploy contract
echo ""
echo "Step 3: Deploying contract to $NETWORK..."

CONTRACT_ID=$(soroban contract deploy \
    --network $NETWORK \
    --source $SOURCE_ACCOUNT \
    $WASM_FILE \
    2>&1 | tail -1)

if [[ ! $CONTRACT_ID =~ ^C[A-Z2-7]{55}$ ]]; then
    echo "❌ ERROR: Invalid contract ID: $CONTRACT_ID"
    exit 1
fi

echo "✓ Contract deployed successfully!"
echo ""
echo "======================================"
echo "CONTRACT DEPLOYMENT SUCCESSFUL"
echo "======================================"
echo ""
echo "Contract ID: $CONTRACT_ID"
echo "Network: $NETWORK"
echo "Explorer: https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""

# Step 4: Generate configuration
echo "Step 4: Generating configuration files..."

cat > ../api/.env << EOF
NETWORK=testnet
CONTRACT_ID=$CONTRACT_ID
PORT=3001
EOF

cat > ../frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
NEXT_PUBLIC_NETWORK=testnet
EOF

echo "✓ Created api/.env"
echo "✓ Created frontend/.env.local"

# Step 5: Output README section
echo ""
echo "======================================"
echo "UPDATE README.md WITH THIS SECTION:"
echo "======================================"
cat << EOF

## Testnet Deployment

**Contract ID:** \`$CONTRACT_ID\`

**Network:** Stellar Testnet

**Explorer:** https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID

Query consent status:
\`\`\`bash
curl http://localhost:3001/consent/a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7
\`\`\`

EOF

echo ""
echo "======================================"
echo "NEXT STEPS"
echo "======================================"
echo ""
echo "1. Update README.md with contract ID above"
echo "2. Start API: cd api && npm install && npm run dev"
echo "3. Start Frontend: cd frontend && npm install && npm run dev"
echo "4. Test at: http://localhost:3000/donor"
echo ""
echo "Deploy API publicly:"
echo "  cd api && npm run build && vercel deploy --prod"
echo ""
echo "Deploy Frontend publicly:"
echo "  cd frontend && npm run build && vercel deploy --prod"
echo ""
