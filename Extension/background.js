let HELIUS_API_KEY = "";
let apiKeyLoaded = false;

console.log("[Bundle Scanner] Background service worker started");
console.log("[Bundle Scanner] Attempting to load API key...");

fetch(chrome.runtime.getURL('config.json'))
    .then(response => {
        console.log("[Bundle Scanner] Fetch response status:", response.status);
        return response.json();
    })
    .then(config => {
        HELIUS_API_KEY = config.HELIUS_API_KEY;
        apiKeyLoaded = true;
        console.log("[Bundle Scanner] API key loaded successfully");
        console.log("[Bundle Scanner] API key length:", HELIUS_API_KEY.length);
        console.log("[Bundle Scanner] API key preview:", HELIUS_API_KEY.substring(0, 10) + "...");
    })
    .catch(err => {
        console.error("[Bundle Scanner] Failed to load config.json");
        console.error("[Bundle Scanner] Error details:", err);
    });

setInterval(() => {
    console.log("[Bundle Scanner] Service worker keep-alive ping");
}, 20000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_MINT") {
        console.log("[Bundle Scanner] Received scan request for:", request.mint);
        console.log("[Bundle Scanner] API key loaded:", apiKeyLoaded);
        console.log("[Bundle Scanner] API key value:", HELIUS_API_KEY ? "Present" : "Empty");
        
        if (!apiKeyLoaded) {
            console.error("[Bundle Scanner] API key not loaded yet, waiting...");
            setTimeout(() => {
                if (apiKeyLoaded && HELIUS_API_KEY && HELIUS_API_KEY !== "YOUR_API_KEY_HERE") {
                    handleScan(request.mint).then(sendResponse).catch(err => sendResponse({ error: err.message }));
                } else {
                    sendResponse({ error: "API key not configured" });
                }
            }, 1000);
            return true;
        }
        
        if (!HELIUS_API_KEY || HELIUS_API_KEY === "YOUR_API_KEY_HERE") {
            console.error("[Bundle Scanner] No valid API key found!");
            sendResponse({ error: "No API key configured" });
            return true;
        }
        
        handleScan(request.mint)
            .then(result => {
                console.log("[Bundle Scanner] Scan result:", result);
                sendResponse(result);
            })
            .catch(err => {
                console.error("[Bundle Scanner] Scan error:", err.message);
                sendResponse({ error: err.message });
            });
        return true;
    }
});

async function handleScan(address) {
    let mint = address;
    console.log("[Bundle Scanner] Checking if address is a pair...");
    
    try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${address}`);
        const dexData = await dexRes.json();
        if (dexData.pair?.baseToken) {
            mint = dexData.pair.baseToken.address;
            console.log("[Bundle Scanner] Found base token:", mint);
        } else {
            console.log("[Bundle Scanner] Using original address");
        }
    } catch (e) {
        console.log("[Bundle Scanner] DEXScreener check failed, using original address");
    }
    
    return await analyzeMint(mint);
}

async function analyzeMint(mint) {
    console.log("[Bundle Scanner] Analyzing mint:", mint);
    console.log("[Bundle Scanner] Using API key:", HELIUS_API_KEY.substring(0, 10) + "...");
    const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    
    const holdRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenLargestAccounts", params: [mint] })
    });
    const holdData = await holdRes.json();
    
    if (!holdData.result) {
        console.error("[Bundle Scanner] No holder data returned");
        console.error("[Bundle Scanner] Response:", holdData);
        return { error: "No data" };
    }

    const allHolders = holdData.result.value;
    const totalHolders = allHolders.length;
    const holders = allHolders.slice(0, 15);
    
    console.log("[Bundle Scanner] Total holders:", totalHolders);
    console.log("[Bundle Scanner] Checking top", holders.length, "holders");
    
    const results = await Promise.all(holders.map(async (h, index) => {
        try {
            const sigRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0", id: 1,
                    method: "getSignaturesForAddress",
                    params: [h.address, { limit: 5 }]
                })
            });
            const sigData = await sigRes.json();
            const isFresh = (sigData.result && sigData.result.length < 5) ? 1 : 0;
            if (isFresh) console.log("[Bundle Scanner] Holder", index + 1, "is fresh wallet");
            return isFresh;
        } catch (e) { 
            console.error("[Bundle Scanner] Error checking holder", index + 1, ":", e);
            return 0;
        }
    }));

    const freshCount = results.reduce((a, b) => a + b, 0);
    const score = Math.round((freshCount / holders.length) * 100);

    console.log("[Bundle Scanner] Analysis complete - Score:", score + "%, Fresh wallets:", freshCount);
    return { 
        score, 
        freshWallets: freshCount, 
        totalChecked: holders.length,
        veryNew: totalHolders < 5
    };
}