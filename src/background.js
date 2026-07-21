importScripts("rules.js");

async function sync() {
  applyRules(await loadRules());
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);

// The popup writes to storage; the service worker owns the dynamic rules so
// they stay in sync even when the popup is closed mid-edit.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    applyRules(changes[STORAGE_KEY].newValue || []);
  }
});
