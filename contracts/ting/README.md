# TING Token

AI collaboration token for creative economies on SUI.

## Philosophy

**Dumb token, smart ecosystem.** This contract is intentionally minimal:
- Mint (treasury cap holder)
- Burn
- Transfer (standard Coin)

All the smart stuff (minting rules, agent wallets, rewards) lives in separate, upgradeable contracts/backend logic.

## Setup

### 1. Install SUI CLI

```bash
# macOS
brew install sui

# Or from source
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

### 2. Create a wallet (if you don't have one)

```bash
sui client new-address ed25519
```

### 3. Switch to testnet

```bash
sui client switch --env testnet
```

If testnet isn't configured:
```bash
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet
```

### 4. Get testnet SUI (for gas)

```bash
sui client faucet
```

Wait ~30 seconds, then check:
```bash
sui client gas
```

## Deployment

### Deploy to Testnet

```bash
cd contracts/ting
sui client publish --gas-budget 100000000
```

**Save the output!** You'll see:
- `PackageID` - The deployed contract address
- `TreasuryCap` object ID - Keep this safe!
- `MintCap` object ID - For delegating mint authority later

Example output:
```
----- Object changes ----
Created Objects:
  - ObjectType: 0x2::coin::TreasuryCap<PACKAGE_ID::ting::TING>
    ObjectId: 0xabc123...  <-- YOUR TREASURY CAP
  - ObjectType: PACKAGE_ID::ting::MintCap
    ObjectId: 0xdef456...  <-- YOUR MINT CAP
```

## Using TING

### Mint tokens

```bash
# Mint 1000 TING to an address
# Note: amount is in smallest units (1 TING = 1_000_000_000 units with 9 decimals)
sui client call \
  --package <PACKAGE_ID> \
  --module ting \
  --function mint \
  --args <TREASURY_CAP_ID> 1000000000000 <RECIPIENT_ADDRESS> \
  --gas-budget 10000000
```

This mints 1000 TING (1000 * 10^9 = 1000000000000 smallest units).

### Check balance

```bash
sui client objects <WALLET_ADDRESS>
```

Look for objects of type `Coin<PACKAGE_ID::ting::TING>`.

### Transfer TING

TING uses standard SUI Coin, so transfer works normally:
```bash
sui client transfer \
  --object-id <TING_COIN_OBJECT_ID> \
  --to <RECIPIENT_ADDRESS> \
  --gas-budget 10000000
```

### Burn tokens

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module ting \
  --function burn \
  --args <TREASURY_CAP_ID> <TING_COIN_OBJECT_ID> \
  --gas-budget 10000000
```

## Architecture: Future Contracts

TING is designed to be composed with other contracts:

### 1. Agent Wallet Factory (future)
- Creates wallets for AI agents
- Pre-loads with initial TING allocation
- Uses TreasuryCap (or delegated MintCap)

### 2. Rewards Contract (future)
- Mints TING when certain actions happen
- e.g., AI curates a playlist → mint 10 TING
- Can have complex rules, upgradeable

### 3. Marketplace (future)
- AI agents spend TING to license content
- AI agents earn TING for contributions
- All transactions in TING

The beauty: TING stays stable while ecosystem evolves.

## Mainnet Deployment

Once testnet is verified:

```bash
sui client switch --env mainnet
sui client publish --gas-budget 100000000
```

**IMPORTANT:**
- You need real SUI for gas
- Treasury cap goes to deployer wallet
- Store treasury cap securely!

## Environment Variables

After deployment, add to `.env.local`:
```
TING_PACKAGE_ID=0x...
TING_TREASURY_CAP_ID=0x...
TING_MINT_CAP_ID=0x...
```
