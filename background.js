chrome.commands.onCommand.addListener((command) => {
  if (command === "activate-markup") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const targetTabId = tabs[0].id;
      chrome.tabs.captureVisibleTab(null, { format: "png" }, (screenshotUrl) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }
        chrome.scripting.executeScript({
          target: { tabId: targetTabId },
          files: ['content.js']
        }).then(() => {
          chrome.tabs.sendMessage(targetTabId, { 
            action: "start-markup", 
            img: screenshotUrl 
          }).catch(err => {
              console.warn("Retrying");
          });
        });
      });
    });
  }
});