const slider = document.getElementById('timerInput');
const display = document.getElementById('tVal');
const saveBtn = document.getElementById('saveBtn');

console.log("[Bundle Scanner] Popup opened");

chrome.storage.local.get(['ui_timer'], (data) => {
    if (data.ui_timer) {
        slider.value = data.ui_timer;
        display.innerText = data.ui_timer + 's';
        console.log("[Bundle Scanner] Loaded saved timer:", data.ui_timer);
    } else {
        console.log("[Bundle Scanner] No saved timer, using default: 5s");
    }
});

slider.addEventListener('input', () => {
    display.innerText = slider.value + 's';
    console.log("[Bundle Scanner] Slider moved to:", slider.value);
});

saveBtn.addEventListener('click', () => {
    const timerValue = parseInt(slider.value);
    console.log("[Bundle Scanner] Saving timer value:", timerValue);
    
    chrome.storage.local.set({ ui_timer: timerValue }, () => {
        console.log("[Bundle Scanner] Timer saved successfully");
        
        saveBtn.innerText = "SAVED!";
        saveBtn.style.background = "white";
        
        setTimeout(() => {
            saveBtn.innerText = "APPLY CHANGES";
            saveBtn.style.background = "#00ff88";
        }, 1000);
    });
});