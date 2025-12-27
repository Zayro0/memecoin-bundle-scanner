let lastMint = "";
let displayTime = 5;
let detectionMethod = "fresh";
let isScanning = false;

console.log("[Bundle Scanner] Content script loaded");
console.log("[Bundle Scanner] Current URL:", window.location.href);

chrome.storage.local.get(['ui_timer', 'detection_method'], (res) => { 
    if(res.ui_timer) {
        displayTime = res.ui_timer;
        console.log("[Bundle Scanner] Loaded display time:", displayTime + "s");
    } else {
        console.log("[Bundle Scanner] No saved timer, using default:", displayTime + "s");
    }
    
    if(res.detection_method) {
        detectionMethod = res.detection_method;
        console.log("[Bundle Scanner] Loaded detection method:", detectionMethod);
    } else {
        console.log("[Bundle Scanner] No saved method, using default:", detectionMethod);
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.ui_timer) {
        displayTime = changes.ui_timer.newValue;
        console.log("[Bundle Scanner] Display time updated to:", displayTime + "s");
    }
    if (changes.detection_method) {
        detectionMethod = changes.detection_method.newValue;
        console.log("[Bundle Scanner] Detection method updated to:", detectionMethod);
    }
});

const VERSION = chrome.runtime.getManifest().version;
console.log("[Bundle Scanner] Extension version:", VERSION);

function updateUI(data) {
    console.log("[Bundle Scanner] Updating UI - Score:", data.score, "Suspicious Wallets:", data.freshWallets);
    
    let ui = document.getElementById("bundle-scanner-ui");
    if (!ui) {
        ui = document.createElement("div");
        ui.id = "bundle-scanner-ui";
        document.body.appendChild(ui);
        console.log("[Bundle Scanner] Created new UI element");
    }

    const score = parseFloat(data.score) || 0;
    const color = score > 70 ? "#ff4444" : score > 30 ? "#ffbb00" : "#00ff88";
    const warning = data.veryNew ? '<div style="background: #ff4444; padding: 4px 8px; margin-top: 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-align: center;">⚠ VERY NEW TOKEN</div>' : '';
    
    const labelText = data.method === "funded" ? "Clustered:" : "Fresh Wallets:";
    const methodBadge = data.method === "funded" && data.timeWindow ? 
        `<div style="font-size:8px; color:#666; margin-top:4px;">Within ${data.timeWindow}h window</div>` : '';

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
                <span style="color:#666">${labelText}</span><span>${data.freshWallets}/${data.totalChecked || 15}</span>
            </div>
            ${methodBadge}
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

function showLoadingUI() {
    console.log("[Bundle Scanner] Showing loading state");
    
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
        <div style="background: #121212; border: 1px solid rgba(255,255,255,0.1); border-left: 3px solid #00ff88;
            padding: 12px 16px; border-radius: 8px; width: 170px;
            color: white; font-family: sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:9px; font-weight:800; color:#00ff88; text-transform:uppercase;">SCANNING</span>
                <span style="font-size:8px; opacity:0.3;">v${VERSION}</span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">Analyzing Token...</div>
            <div style="font-size:10px; color:#666;">
                <div style="width: 100%; height: 3px; background: #222; border-radius: 2px; overflow: hidden;">
                    <div style="width: 70%; height: 100%; background: #00ff88; animation: loading 1.5s ease-in-out infinite;"></div>
                </div>
            </div>
        </div>
        <style>
            @keyframes loading {
                0%, 100% { transform: translateX(-100%); }
                50% { transform: translateX(100%); }
            }
        </style>
    `;
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
        </div>
    `;

    if (ui.hideTimeout) clearTimeout(ui.hideTimeout);
    
    ui.hideTimeout = setTimeout(() => {
        ui.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        ui.style.opacity = "0";
        ui.style.transform = "translateX(20px)";
    }, displayTime * 1000);
}

async function scanWithRetry(mint, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
            console.log(`[Bundle Scanner] Retry attempt ${attempt + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { type: "SCAN_MINT", mint, method: detectionMethod }, 
                    (res) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(res);
                        }
                    }
                );
            });

            // Success case
            if (response && !response.error) {
                console.log("[Bundle Scanner] Scan successful");
                return { success: true, data: response };
            }

            // Error case - check if we should retry
            if (response.error) {
                console.log(`[Bundle Scanner] Scan error (attempt ${attempt + 1}):`, response.error);
                
                // Don't retry if it's a configuration error
                if (response.shouldRetry === false || response.error.includes("API key not configured")) {
                    return { success: false, error: response.error };
                }
                
                // Retry for other errors
                if (attempt === maxRetries - 1) {
                    return { success: false, error: response.error };
                }
            }
        } catch (err) {
            console.error(`[Bundle Scanner] Runtime error (attempt ${attempt + 1}):`, err.message);
            
            // Retry on runtime errors
            if (attempt === maxRetries - 1) {
                return { success: false, error: "Connection failed" };
            }
        }
    }
    
    return { success: false, error: "Scan failed after retries" };
}

async function scan() {
    if (isScanning) {
        console.log("[Bundle Scanner] Scan already in progress, skipping");
        return;
    }

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
    isScanning = true;
    
    // Show loading state
    showLoadingUI();
    
    // Perform scan with intelligent retry
    const result = await scanWithRetry(mint, 3);
    
    isScanning = false;
    
    if (result.success) {
        updateUI(result.data);
    } else {
        // Only show error for real persistent errors
        showErrorUI(result.error);
    }
}

console.log("[Bundle Scanner] Setting up initial scan...");
setTimeout(() => {
    console.log("[Bundle Scanner] Running initial scan");
    scan();
}, 2000);

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