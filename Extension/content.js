let lastMint = "";
let displayTime = 5;

console.log("[Bundle Scanner] Content script loaded");
console.log("[Bundle Scanner] Current URL:", window.location.href);

chrome.storage.local.get(['ui_timer'], (res) => { 
    if(res.ui_timer) {
        displayTime = res.ui_timer;
        console.log("[Bundle Scanner] Loaded display time:", displayTime + "s");
    } else {
        console.log("[Bundle Scanner] No saved timer, using default:", displayTime + "s");
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.ui_timer) {
        displayTime = changes.ui_timer.newValue;
        console.log("[Bundle Scanner] Display time updated to:", displayTime + "s");
    }
});

const VERSION = chrome.runtime.getManifest().version;
console.log("[Bundle Scanner] Extension version:", VERSION);

function updateUI(data) {
    console.log("[Bundle Scanner] Updating UI - Score:", data.score, "Fresh Wallets:", data.freshWallets);
    
    let ui = document.getElementById("bundle-scanner-ui");
    if (!ui) {
        ui = document.createElement("div");
        ui.id = "bundle-scanner-ui";
        document.body.appendChild(ui);
        console.log("[Bundle Scanner] Created new UI element");
    }

    const score = parseFloat(data.score) || 0;
    const color = score > 40 ? "#ff4444" : score > 15 ? "#ffbb00" : "#00ff88";
    const warning = data.veryNew ? '<div style="background: #ff4444; padding: 4px 8px; margin-top: 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-align: center;">⚠ VERY NEW TOKEN</div>' : '';

    ui.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        display: block !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
        transition: none !important;
    `;
    
    ui.innerHTML = `
        <div style="background: #121212; border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid ${color};
            padding: 12px 16px; border-radius: 8px; width: 170px;
            color: white; font-family: sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:9px; font-weight:800; color:${color}; text-transform:uppercase;">${score > 40 ? "HIGH RISK" : "BUNDLE SCAN"}</span>
                <span style="font-size:8px; opacity:0.3;">v${VERSION}</span>
            </div>
            <div style="font-size:22px; font-weight:900;">${score}%</div>
            <div style="font-size:10px; color:#666; margin-bottom:8px;">Bundle Probability</div>
            <div style="font-size:10px; border-top:1px solid #222; padding-top:8px; display:flex; justify-content:space-between;">
                <span style="color:#666">Fresh Wallets:</span><span>${data.freshWallets}/${data.totalChecked || 15}</span>
            </div>
            ${warning}
        </div>
    `;

    console.log("[Bundle Scanner] UI rendered successfully");

    if (ui.hideTimeout) clearTimeout(ui.hideTimeout);
    
    console.log("[Bundle Scanner] Notification will hide in", displayTime + "s");
    
    ui.hideTimeout = setTimeout(() => {
        console.log("[Bundle Scanner] Hiding notification");
        ui.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        ui.style.opacity = "0";
        ui.style.transform = "translateX(20px)";
    }, displayTime * 1000);
}

function showErrorUI(errorMsg) {
    console.log("[Bundle Scanner] Showing error UI:", errorMsg);
    
    let ui = document.getElementById("bundle-scanner-ui");
    if (!ui) {
        ui = document.createElement("div");
        ui.id = "bundle-scanner-ui";
        document.body.appendChild(ui);
    }

    ui.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        display: block !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
        transition: none !important;
    `;
    
    ui.innerHTML = `
        <div style="background: #121212; border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid #ff4444;
            padding: 12px 16px; border-radius: 8px; width: 170px;
            color: white; font-family: sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:9px; font-weight:800; color:#ff4444; text-transform:uppercase;">ERROR</span>
                <span style="font-size:8px; opacity:0.3;">v${VERSION}</span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">Scan Failed</div>
            <div style="font-size:10px; color:#666; margin-bottom:8px;">${errorMsg}</div>
            <div style="font-size:9px; color:#888; text-align:center;">Try refreshing or check another coin</div>
        </div>
    `;

    if (ui.hideTimeout) clearTimeout(ui.hideTimeout);
    
    ui.hideTimeout = setTimeout(() => {
        ui.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        ui.style.opacity = "0";
        ui.style.transform = "translateX(20px)";
    }, displayTime * 1000);
}

function scan() {
    const url = window.location.href;
    console.log("[Bundle Scanner] Scanning URL:", url);
    
    const match = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const mint = match ? match[0] : null;

    if (!mint) {
        console.log("[Bundle Scanner] No mint address found in URL");
        return;
    }

    if (url.includes("address")) {
        console.log("[Bundle Scanner] Skipping - URL contains 'address'");
        return;
    }

    if (mint === lastMint) {
        console.log("[Bundle Scanner] Skipping - same mint as last scan:", mint);
        return;
    }

    console.log("[Bundle Scanner] New mint detected:", mint);
    lastMint = mint;
    
    chrome.runtime.sendMessage({ type: "SCAN_MINT", mint }, (res) => {
        if (chrome.runtime.lastError) {
            console.error("[Bundle Scanner] Runtime error:", chrome.runtime.lastError.message);
            console.log("[Bundle Scanner] Service worker may be inactive, retrying...");
            
            setTimeout(() => {
                chrome.runtime.sendMessage({ type: "SCAN_MINT", mint }, (retryRes) => {
                    if (chrome.runtime.lastError) {
                        showErrorUI("Connection failed");
                        return;
                    }
                    if (retryRes && !retryRes.error) {
                        console.log("[Bundle Scanner] Retry successful");
                        updateUI(retryRes);
                    } else {
                        showErrorUI(retryRes?.error || "Scan failed");
                    }
                });
            }, 1000);
            return;
        }
        
        if (res && !res.error) {
            console.log("[Bundle Scanner] Scan successful");
            updateUI(res);
        } else {
            console.error("[Bundle Scanner] Scan failed:", res?.error || "Unknown error");
            showErrorUI(res?.error || "Scan failed");
        }
    });
}

console.log("[Bundle Scanner] Setting up initial scan...");
setTimeout(() => {
    console.log("[Bundle Scanner] Running initial scan");
    scan();
}, 1500);

let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        console.log("[Bundle Scanner] URL changed to:", location.href);
        lastUrl = location.href;
        setTimeout(scan, 500);
    }
}, 500);

console.log("[Bundle Scanner] Setting up event listeners...");
window.addEventListener('click', () => setTimeout(scan, 100));
window.addEventListener('popstate', () => setTimeout(scan, 100));
window.addEventListener('hashchange', () => setTimeout(scan, 100));

setInterval(() => {
    console.log("[Bundle Scanner] Running backup scan...");
    scan();
}, 3000);

console.log("[Bundle Scanner] Initialization complete");