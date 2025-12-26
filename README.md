# Bundle Scanner Extension

A Chrome extension that detects bundled tokens on Solana DEXs by analyzing wallet freshness among top holders.

## Features

- Real-time bundle detection on popular DEXs (Padre, DexScreener, BullX, Pump.fun)
- Analyzes top 15 token holders for fresh wallet patterns
- Customizable notification display duration (3-10 seconds)
- Clean, minimal UI with risk indicators

## Installation

1. Download or clone this repository
2. Open `config.json` and replace `YOUR_API_KEY_HERE` with your Helius API key
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the `Extension` folder
6. Done! The extension is now active

## Getting a Helius API Key

1. Go to [https://www.helius.dev/](https://www.helius.dev/)
2. Sign up for a free account
3. Create a new API key
4. Copy the key and paste it into `config.json`

## How It Works

The extension:
1. Detects when you visit a token page on supported DEXs
2. Fetches the top 15 token holders via Helius RPC
3. Checks each holder's transaction history
4. Counts "fresh wallets" (wallets with less than 5 transactions)
5. Calculates a bundle probability score based on fresh wallet percentage

**Fresh wallets in top holders = Higher bundle risk**

## Settings

Click the extension icon to adjust notification display duration from 3-10 seconds.

## Supported Platforms

- DexScreener
- Padre
- BullX
- Pump.fun

## Version

Current version: 1.61