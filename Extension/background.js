let HELIUS_API_KEY = "";
let apiKeyLoaded = false;

console.log("[Bundle Scanner] Background service worker started");

// Load Config with retry
async function loadConfig(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(chrome.runtime.getURL('config.json'));
            const config = await response.json();
            HELIUS_API_KEY = config.HELIUS_API_KEY;
            apiKeyLoaded = true;
            console.log("[Bundle Scanner] API key loaded successfully");
            return true;
        } catch (err) {
            console.error(`[Bundle Scanner] Config load attempt ${i + 1} failed:`, err);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    console.error("[Bundle Scanner] Failed to load config after all retries");
    return false;
}

loadConfig();

// Keep-alive
setInterval(() => console.log("[Bundle Scanner] Ping"), 20000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_MINT") {
        handleScanWithRetry(request.mint, request.method, 0)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message, shouldRetry: false }));
        return true;
    }
});

async function handleScanWithRetry(address, method, attempt) {
    // Wait for API key if not loaded yet (up to 5 seconds)
    if (!apiKeyLoaded) {
        console.log("[Bundle Scanner] API key not ready, waiting...");
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (apiKeyLoaded) break;
        }
    }
    
    // After waiting, check if we have a valid API key
    if (!apiKeyLoaded || !HELIUS_API_KEY || HELIUS_API_KEY === "YOUR_API_KEY_HERE") {
        return { error: "API key not configured", shouldRetry: false };
    }

    try {
        return await handleScan(address, method);
    } catch (err) {
        console.error(`[Bundle Scanner] Scan attempt ${attempt + 1} failed:`, err);
        
        // Retry on network errors, but not on data errors
        if (attempt < 2 && (err.message.includes('fetch') || err.message.includes('network'))) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            return handleScanWithRetry(address, method, attempt + 1);
        }
        
        throw err;
    }
}

async function handleScan(address, method = "fresh") {
    let mint = address;
    try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${address}`);
        const dexData = await dexRes.json();
        if (dexData.pair?.baseToken) mint = dexData.pair.baseToken.address;
    } catch (e) { 
        console.log("[Bundle Scanner] DexScreener lookup failed, using direct address");
    }
    
    return await analyzeMint(mint, method);
}

async function analyzeMint(mint, method = "fresh") {
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    
    let holdRes, holdData;
    try {
        holdRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                jsonrpc: "2.0", id: 1, 
                method: "getTokenLargestAccounts", 
                params: [mint] 
            })
        });
        holdData = await holdRes.json();
    } catch (err) {
        throw new Error("Network error: Unable to fetch holder data");
    }
    
    if (!holdData.result || !holdData.result.value || holdData.result.value.length === 0) {
        throw new Error("No holder data available for this token");
    }

    const allHolders = holdData.result.value;
    const holders = allHolders.slice(0, 15);
    
    if (method === "funded") {
        return await analyzeFundedTime(holders, allHolders.length, url);
    } else {
        return await analyzeFreshWallets(holders, allHolders.length, url);
    }
}

async function analyzeFreshWallets(holders, totalHolders, url) {
    const results = await Promise.all(holders.map(async (h) => {
        try {
            const body = {
                jsonrpc: "2.0", id: 1,
                method: "getSignaturesForAddress",
                params: [h.address, { limit: 10 }]
            };
            const res = await fetch(url, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify(body)
            });
            const data = await res.json();
            return (data.result && data.result.length < 5) ? 1 : 0;
        } catch (e) { 
            console.error("[Bundle Scanner] Error checking wallet:", h.address, e);
            return 0; 
        }
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

async function analyzeFundedTime(holders, totalHolders, url) {
    console.log("[Bundle Scanner] Starting Optimized Funded Time Analysis...");

    async function getCreationTime(wallet) {
        try {
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

            if (data.result.length === 1000) {
                return "OLD";
            }

            const oldestTx = data.result[data.result.length - 1];
            return oldestTx.blockTime;
        } catch (e) {
            console.error("Error fetching history for", wallet, e);
            return null;
        }
    }

    const times = await Promise.all(holders.map(h => getCreationTime(h.address)));
    
    const validTimes = times.filter(t => t && t !== "OLD");
    const oldWalletsCount = times.filter(t => t === "OLD").length;

    console.log(`[Bundle Scanner] Times found: ${validTimes.length}, Established Wallets: ${oldWalletsCount}`);

    if (validTimes.length < 2) {
        return {
            score: 0,
            freshWallets: 0,
            totalChecked: holders.length,
            veryNew: totalHolders < 10,
            method: "funded"
        };
    }

    validTimes.sort((a, b) => a - b);

    const WINDOW_SIZE = 7200; 
    let maxCluster = 0;
    let clusterTime = 0;

    for (let i = 0; i < validTimes.length; i++) {
        let currentCluster = 1;
        for (let j = i + 1; j < validTimes.length; j++) {
            if (validTimes[j] - validTimes[i] <= WINDOW_SIZE) {
                currentCluster++;
            } else {
                break;
            }
        }
        
        if (currentCluster > maxCluster) {
            maxCluster = currentCluster;
            clusterTime = validTimes[i];
        }
    }

    console.log(`[Bundle Scanner] Max Cluster Size: ${maxCluster}`);

    if (maxCluster > 1) {
        const score = Math.round((maxCluster / holders.length) * 100);
        
        const now = Math.floor(Date.now() / 1000);
        const diff = now - clusterTime;
        const hoursAgo = Math.floor(diff / 3600);
        
        return {
            score,
            freshWallets: maxCluster,
            totalChecked: holders.length,
            veryNew: totalHolders < 10,
            method: "funded",
            timeWindow: hoursAgo < 1 ? "<1" : hoursAgo
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