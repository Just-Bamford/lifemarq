@echo off
REM Lifemarq Contract Deployment to Stellar Testnet (Windows)

setlocal enabledelayedexpansion

echo ======================================
echo Lifemarq Contract Deployment
echo ======================================

echo.
echo Checking prerequisites...

REM Check soroban
soroban --version >nul 2>&1
if errorlevel 1 (
    echo X ERROR: Soroban CLI not found
    echo Install from: https://soroban.stellar.org/docs/learn/setup
    exit /b 1
)

REM Check cargo
cargo --version >nul 2>&1
if errorlevel 1 (
    echo X ERROR: Rust cargo not found
    echo Install from: https://www.rust-lang.org/tools/install
    exit /b 1
)

echo + Soroban CLI OK
echo + Rust OK

set NETWORK=testnet
set SOURCE_ACCOUNT=testnet-account

REM Step 1: Build contract
echo.
echo Step 1: Building contract WASM...
cd contract
cargo build --target wasm32-unknown-unknown --release

if not exist "target\wasm32-unknown-unknown\release\lifemarq_contract.wasm" (
    echo X ERROR: WASM file not found
    exit /b 1
)

echo + Built: target\wasm32-unknown-unknown\release\lifemarq_contract.wasm

REM Step 2: Verify testnet account
echo.
echo Step 2: Verifying testnet account...

soroban config identity show %SOURCE_ACCOUNT% --network %NETWORK% >nul 2>&1
if errorlevel 1 (
    echo Creating account %SOURCE_ACCOUNT%...
    soroban config identity generate --global %SOURCE_ACCOUNT% --network %NETWORK%
    
    echo.
    echo Account created! Fund it with testnet XLM:
    echo 1. Go to: https://laboratory.stellar.org
    echo 2. Create testnet account, OR
    echo 3. Use: curl https://friendbot.stellar.org?addr=[ACCOUNT_ID]
    echo.
    pause
)

echo + Account verified

REM Step 3: Deploy contract
echo.
echo Step 3: Deploying contract to %NETWORK%...

for /f "delims=" %%i in ('soroban contract deploy --network %NETWORK% --source %SOURCE_ACCOUNT% target\wasm32-unknown-unknown\release\lifemarq_contract.wasm 2^>^&1 ^| findstr /r "^C"') do set CONTRACT_ID=%%i

if "!CONTRACT_ID!"=="" (
    echo X ERROR: Contract deployment failed
    exit /b 1
)

echo + Contract deployed: !CONTRACT_ID!

echo.
echo ======================================
echo CONTRACT DEPLOYMENT SUCCESSFUL
echo ======================================
echo.
echo Contract ID: !CONTRACT_ID!
echo Network: %NETWORK%
echo Explorer: https://stellar.expert/explorer/testnet/contract/!CONTRACT_ID!
echo.

REM Step 4: Generate configuration
echo Step 4: Generating configuration files...

(
    echo NETWORK=testnet
    echo CONTRACT_ID=!CONTRACT_ID!
    echo PORT=3001
) > ..\api\.env

(
    echo NEXT_PUBLIC_API_URL=http://localhost:3001
    echo NEXT_PUBLIC_CONTRACT_ID=!CONTRACT_ID!
    echo NEXT_PUBLIC_NETWORK=testnet
) > ..\frontend\.env.local

echo + Created api\.env
echo + Created frontend\.env.local

echo.
echo ======================================
echo UPDATE README.md WITH THIS SECTION:
echo ======================================
echo.
echo ## Testnet Deployment
echo.
echo **Contract ID:** `!CONTRACT_ID!`
echo.
echo **Network:** Stellar Testnet
echo.
echo **Explorer:** https://stellar.expert/explorer/testnet/contract/!CONTRACT_ID!
echo.
echo.
echo ======================================
echo NEXT STEPS
echo ======================================
echo.
echo 1. Update README.md with contract ID above
echo 2. Start API: cd api ^&^& npm install ^&^& npm run dev
echo 3. Start Frontend: cd frontend ^&^& npm install ^&^& npm run dev
echo 4. Test at: http://localhost:3000/donor
echo.
echo Deploy API: cd api ^&^& npm run build ^&^& vercel deploy --prod
echo Deploy Frontend: cd frontend ^&^& npm run build ^&^& vercel deploy --prod
echo.

pause
