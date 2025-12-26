let HELIUS_API_KEY = "";
let apiKeyLoaded = false;

console.log("[Bundle Scanner] Background service worker started");

// Load Config
fetch(chrome.runtime.getURL('config.json'))
    .then(response => response.json())
    .then(config => {
        HELIUS_API_KEY = config.HELIUS_API_KEY;
        apiKeyLoaded = true;
        console.log("[Bundle Scanner] API key loaded.");
    })
    .catch(err => console.error("[Bundle Scanner] Config load failed:", err));

// Keep-alive
setInterval(() => console.log("[Bundle Scanner] Ping"), 20000);

// Message Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_MINT") {
        if (!apiKeyLoaded || !HELIUS_API_KEY || HELIUS_API_KEY === "YOUR_API_KEY_HERE") {
            sendResponse({ error: "API key not configured" });
            return true;
        }

        handleScan(request.mint, request.method)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

async function handleScan(address, method = "fresh") {
    let mint = address;
    try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${address}`);
        const dexData = await dexRes.json();
        if (dexData.pair?.baseToken) mint = dexData.pair.baseToken.address;
    } catch (e) { /* ignore */ }
    
    return await analyzeMint(mint, method);
}

async function analyzeMint(mint, method = "fresh") {
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    
    // 1. Get Top Holders
    const holdRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            jsonrpc: "2.0", id: 1, 
            method: "getTokenLargestAccounts", 
            params: [mint] 
        })
    });
    const holdData = await holdRes.json();
    
    if (!holdData.result) return { error: "No holder data" };

    const allHolders = holdData.result.value;
    // Filter out token accounts, we want the owners, but this API returns accounts. 
    // Usually fine for rough scanning, but deeper logic might need `getAccountInfo` to find owner.
    // For speed, we assume standard layout.
    const holders = allHolders.slice(0, 15);
    
    if (method === "funded") {
        return await analyzeFundedTime(holders, allHolders.length, url);
    } else {
        return await analyzeFreshWallets(holders, allHolders.length, url);
    }
}

// --- FRESH WALLET METHOD (Unchanged mainly, just cleanup) ---
async function analyzeFreshWallets(holders, totalHolders, url) {
    const results = await Promise.all(holders.map(async (h) => {
        try {
            const body = {
                jsonrpc: "2.0", id: 1,
                method: "getSignaturesForAddress",
                params: [h.address, { limit: 10 }] // optimization: only need to know if < 5
            };
            const res = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
            const data = await res.json();
            return (data.result && data.result.length < 5) ? 1 : 0;
        } catch (e) { return 0; }
    }));

    const freshCount = results.reduce((a, b) => a + b, 0);
    const score = Math.round((freshCount / holders.length) * 100);

    return { 
        score, 
        freshWallets: freshCount, 
        totalChecked: holders.length,
        veryNew: totalHolders < 10,
        method: "fresh"
    };
}

// --- NEW & IMPROVED FUNDED TIME METHOD ---
async function analyzeFundedTime(holders, totalHolders, url) {
    console.log("[Bundle Scanner] Starting Optimized Funded Time Analysis...");

    // Helper: Get timestamp of the FIRST transaction (creation time)
    async function getCreationTime(wallet) {
        try {
            // Fetch signatures. Limit 1000 is generous for "fresh" wallets.
            // If a wallet has >1000 txs, it is NOT a fresh bundle wallet.
            const body = {
                jsonrpc: "2.0", id: 1,
                method: "getSignaturesForAddress",
                params: [wallet, { limit: 1000 }]
            };
            
            const res = await fetch(url, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(body) 
            });
            const data = await res.json();

            if (!data.result || data.result.length === 0) return null;

            // If we hit the limit (1000), this is an established wallet.
            // We ignore it for "Bundle" detection to avoid false positives 
            // and because searching back years is too expensive.
            if (data.result.length === 1000) {
                return "OLD";
            }

            // The last item in the list is the oldest transaction fetched
            const oldestTx = data.result[data.result.length - 1];
            return oldestTx.blockTime; // Unix timestamp
        } catch (e) {
            console.error("Error fetching history for", wallet, e);
            return null;
        }
    }

    // Run in parallel
    const times = await Promise.all(holders.map(h => getCreationTime(h.address)));
    
    // Filter valid timestamps (exclude "OLD" and errors)
    const validTimes = times.filter(t => t && t !== "OLD");
    const oldWalletsCount = times.filter(t => t === "OLD").length;

    console.log(`[Bundle Scanner] Times found: ${validTimes.length}, Established Wallets: ${oldWalletsCount}`);

    // If most wallets are old/established, risk is low
    if (validTimes.length < 2) {
        return {
            score: 0,
            freshWallets: 0,
            totalChecked: holders.length,
            veryNew: totalHolders < 10,
            method: "funded" // "Safe - Mostly Established Wallets"
        };
    }

    validTimes.sort((a, b) => a - b);

    // SLIDING WINDOW CLUSTERING
    // We look for the maximum number of wallets funded within a 2-hour window (7200s)
    const WINDOW_SIZE = 7200; 
    let maxCluster = 0;
    let clusterTime = 0;

    for (let i = 0; i < validTimes.length; i++) {
        let currentCluster = 1;
        // Look ahead
        for (let j = i + 1; j < validTimes.length; j++) {
            if (validTimes[j] - validTimes[i] <= WINDOW_SIZE) {
                currentCluster++;
            } else {
                break; // sorted, so no need to check further
            }
        }
        
        if (currentCluster > maxCluster) {
            maxCluster = currentCluster;
            clusterTime = validTimes[i];
        }
    }

    console.log(`[Bundle Scanner] Max Cluster Size: ${maxCluster}`);

    // If significant cluster found (>1 wallet)
    if (maxCluster > 1) {
        // Calculate score based on how much of the "Fresh" sample is clustered
        // We weight it against total holders checked to be fair
        const score = Math.round((maxCluster / holders.length) * 100);
        
        // Calculate human readable "Time ago" for the UI badge
        const now = Math.floor(Date.now() / 1000);
        const diff = now - clusterTime;
        const hoursAgo = Math.floor(diff / 3600);
        
        return {
            score,
            freshWallets: maxCluster,
            totalChecked: holders.length,
            veryNew: totalHolders < 10,
            method: "funded",
            timeWindow: hoursAgo < 1 ? "<1" : hoursAgo // passed to UI
        };
    }

    return {
        score: 0,
        freshWallets: 0,
        totalChecked: holders.length,
        veryNew: totalHolders < 10,
        method: "funded"
    };
}