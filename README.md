# 🚀 PATCH 1.66

## 📅 Release Date: 2025-12-27
## 🏷 Version: v1.66

This patch release focuses on **stability improvements** and **expanded platform support**. We've completely rebuilt the error handling system to eliminate false errors and added support for 3 new major trading platforms.

---

## ✨ What's New

### 🌐 Expanded Platform Support
Bundle Scanner now works on **7 major Solana DEXs**:

**New Platforms:**
- **Photon** (https://photon-sol.tinyastro.io) - Lightning-fast trading interface
- **GMGN** (https://gmgn.ai) - Advanced analytics and trading platform  
- **Sniper** (https://www.sniper.xyz) - Professional sniping tools

**Existing Platforms:**
- DexScreener, BullX, Padre, Pump.fun

The extension automatically detects token pages on all these platforms and performs real-time bundle analysis without any configuration needed.

### ⚡ Intelligent Retry System
- **🔄 Smart Retry Logic**: Automatically retries temporary failures (network issues, timing problems) up to 3 times before showing an error
- **⏱️ Progressive Delays**: Uses intelligent backoff timing (1.5s → 3s) to give the network time to recover
- **🎯 Error Classification**: Distinguishes between permanent errors (shows immediately) and temporary issues (retries automatically)
- **🚫 No More False Errors**: Eliminated the annoying "refresh page" errors that appeared even when scans would succeed

### 🔧 Background Service Worker Improvements
- **📦 Config Loading with Retry**: API key loading now retries up to 3 times if the initial load fails
- **⏳ Startup Grace Period**: Service worker waits up to 5 seconds for API key to load before processing scan requests
- **🛡️ Race Condition Prevention**: Fixed timing issues where scans happened before the extension was fully initialized
- **📊 Better Logging**: Enhanced console output for easier debugging and monitoring

### 🎨 User Experience Enhancements
- **⏳ Loading Animation**: Shows a smooth "Analyzing Token..." animation while scans are in progress
- **🔒 Scan Locking**: Prevents duplicate simultaneous scans that could waste API calls
- **📱 Responsive UI**: Better handling of quick page navigation and tab switching
- **✨ Cleaner Error Messages**: More specific error messages when real issues occur

---

## 🛠️ Technical Improvements

### Code Quality
- Refactored retry logic into dedicated `scanWithRetry()` and `handleScanWithRetry()` functions
- Improved error propagation between content script and background worker
- Added `isScanning` flag to prevent race conditions
- Better separation of concerns between UI updates and scan logic

### Performance
- Reduced unnecessary API calls through scan deduplication
- More efficient error recovery with targeted retries
- Optimized loading state rendering

### Reliability
- Fixed race condition during extension startup
- Improved handling of service worker lifecycle events
- Better recovery from network interruptions
- Enhanced compatibility with browser tab restoration

---

## 📊 Platform Compatibility Matrix

| Platform | Fresh Wallet | Funded Time | Auto-Detect | Notes |
|----------|--------------|-------------|-------------|-------|
| DexScreener | ✅ | ✅ | ✅ | Full support |
| BullX | ✅ | ✅ | ✅ | Full support |
| Padre | ✅ | ✅ | ✅ | Full support |
| Pump.fun | ✅ | ✅ | ✅ | Full support |
| Photon | ✅ | ✅ | ✅ | **NEW** |
| GMGN | ✅ | ✅ | ✅ | **NEW** |
| Sniper | ✅ | ✅ | ✅ | **NEW** |

---

## 📝 Usage Notes

### How to Update
1. Download the v1.66 source zip from GitHub
2. Unpack to your extensions folder
3. Ensure your Helius API key is configured in `config.json`
4. Go to `chrome://extensions/` and click "Reload" on Bundle Scanner
5. You're good to go!

### Configuration
- **API Key**: Still required in `config.json` - get yours free at https://helius.dev
- **Detection Method**: Choose between Fresh Wallet or Funded Time in the popup
- **Display Duration**: Adjust notification timing (3-10 seconds) in settings

### What Changed for Users
- **✅ Scans succeed more often** - No more "refresh the page" false alarms
- **✅ Better feedback** - Loading animations show progress during scans
- **✅ More platforms** - Works on 3 additional major trading interfaces
- **✅ Smoother operation** - Faster page load scanning with better timing

---

## 🐛 Known Issues
- None currently reported

---

**Trade safe, stay informed! 🛡️**