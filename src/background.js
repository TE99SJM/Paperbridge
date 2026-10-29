async function privateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}
chrome.runtime.onInstalled.addListener(() => privateStorage().catch(() => {}));
chrome.runtime.onStartup.addListener(() => privateStorage().catch(() => {}));

let opening = false;

async function setTarget(tab) {
  if (!tab?.id || !/^https?:\\/\\//.test(tab.url || "")) {
    await chrome.storage.session.set({ target: null });
    return;
  }
  await chrome.storage.session.set({
    target: { tabId: tab.id, origin: new URL(tab.url).origin, title: tab.title || "" }
  });
}

chrome.action.onClicked.addListener(async tab => {
  if (opening) return;
  opening = true;
  try {
    await privateStorage();
    // Open the panel immediately while the toolbar-click user gesture is active.
    // Store the target in parallel so the side-panel app can attach to this tab.
    if (chrome.sidePanel?.open && tab?.id && /^https?:\\/\\//.test(tab.url || "")) {
      const openingPanel = chrome.sidePanel.open({ tabId: tab.id });
      await setTarget(tab);
      await openingPanel;
      await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" }).catch(() => {});
      return;
    }

    // Compatibility fallback for Chromium-based browsers without the Side Panel API.
    await setTarget(tab);
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("index.html"), type: "popup",
      width: 460, height: 840, focused: true
    });
    await chrome.storage.session.set({ workspaceWindowId: win.id });
  } catch (err) {
    // If a browser advertises the API but refuses to open it, keep the extension usable.
    try {
      await setTarget(tab);
      const win = await chrome.windows.create({
        url: chrome.runtime.getURL("index.html"), type: "popup",
        width: 460, height: 840, focused: true
      });
      await chrome.storage.session.set({ workspaceWindowId: win.id });
    } catch (fallbackError) {
      console.error("Paperbridge could not open its side panel or fallback workspace.", fallbackError || err);
    }
  } finally {
    opening = false;
  }
});
