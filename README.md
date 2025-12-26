# Bundle Scanner Extension

A Chrome extension that detects bundled tokens on Solana DEXs by analyzing patterns among top holders.

## Features

- Real-time bundle detection on popular Solana DEXs (Padre, DexScreener, BullX, Pump.fun)
- **Two bundle detection methods (filterable):**
  - **Fresh Wallet Method** – detects wallets with very low activity
  - **Funded Time Method** – detects wallets funded within similar timeframes
- Analyzes top 15 token holders
- Customizable notification display duration (3–10 seconds)
- Clean, minimal UI with clear risk indicators

## Installation

1. Download or clone this repository
2. Open `config.json` and replace `YOUR_API_KEY_HERE` with your Helius API key
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** and select the `Extension` folder
6. Done! The extension is now active

## Getting a Helius API Key

1. Go to https://www.helius.dev/
2. Sign up for a free account
3. Create a new API key
4. Copy the key and paste it into `config.json`

## How It Works

The extension:
1. Detects when you visit a token page on a supported DEX
2. Fetches the top 15 token holders via Helius RPC
3. Applies one or more bundle detection methods
4. Calculates a bundle risk score based on detected patterns

### Bundle Detection Methods

- **Fresh Wallet Method** Checks for wallets with **less than 5 total transactions** → High fresh wallet presence = higher bundle risk

- **Funded Time Method** Checks if wallets were **funded within similar timeframes** → Similar funding times often indicate coordinated wallet creation

### Risk Indicators

The extension uses a color-coded notification system to indicate bundle risk:

- **🔴 RED (High Risk)** **Score > 70%** Strong evidence of a bundled launch. A large percentage of top holders are fresh wallets or funded simultaneously.

- **🟠 ORANGE (Caution)** **Score 30% - 70%** Common for "graduating" coins or active trader communities. Indicates some fresh wallets, but could be organic snipers or burner wallets (standard for Pump.fun/migrations).

- **🟢 GREEN (Safe)** **Score < 30%** Top holders are mostly established wallets with long transaction histories. Low probability of a coordinated bundle.

## Settings

Click the extension icon to:
- Adjust notification display duration (3–10 seconds)
- Toggle between detection methods (Fresh Wallet vs. Funded Time)