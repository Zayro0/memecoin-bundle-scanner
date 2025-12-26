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