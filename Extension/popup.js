const slider = document.getElementById('timerInput');
const display = document.getElementById('tVal');
const saveBtn = document.getElementById('saveBtn');
const methodSelect = document.getElementById('methodSelect');
const methodDesc = document.getElementById('methodDesc');

const methodDescriptions = {
    fresh: "Checks for wallets with less than 5 transactions",
    funded: "Checks if wallets were funded within similar timeframes"
};

console.log("[Bundle Scanner] Popup opened");

chrome.storage.local.get(['ui_timer', 'detection_method'], (data) => {
    if (data.ui_timer) {
        slider.value = data.ui_timer;
        display.innerText = data.ui_timer + 's';
        console.log("[Bundle Scanner] Loaded saved timer:", data.ui_timer);
    } else {
        console.log("[Bundle Scanner] No saved timer, using default: 5s");
    }
    
    if (data.detection_method) {
        methodSelect.value = data.detection_method;
        methodDesc.innerText = methodDescriptions[data.detection_method];
        console.log("[Bundle Scanner] Loaded detection method:", data.detection_method);
    } else {
        console.log("[Bundle Scanner] No saved method, using default: fresh");
    }
});

slider.addEventListener('input', () => {
    display.innerText = slider.value + 's';
    console.log("[Bundle Scanner] Slider moved to:", slider.value);
});

methodSelect.addEventListener('change', () => {
    methodDesc.innerText = methodDescriptions[methodSelect.value];
    console.log("[Bundle Scanner] Method changed to:", methodSelect.value);
});

saveBtn.addEventListener('click', () => {
    const timerValue = parseInt(slider.value);
    const method = methodSelect.value;
    console.log("[Bundle Scanner] Saving settings - Timer:", timerValue, "Method:", method);
    
    chrome.storage.local.set({ 
        ui_timer: timerValue,
        detection_method: method
    }, () => {
        console.log("[Bundle Scanner] Settings saved successfully");
        
        saveBtn.innerText = "SAVED!";
        saveBtn.style.background = "white";
        
        setTimeout(() => {
            saveBtn.innerText = "APPLY CHANGES";
            saveBtn.style.background = "#00ff88";
        }, 1000);
    });
});