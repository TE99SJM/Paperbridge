async function privateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}
chrome.runtime.onInstalled.addListener(() => privateStorage().catch(() => {}));
chrome.runtime.onStartup.addListener(() => privateStorage().catch(() => {}));

let opening = false;
chrome.action.onClicked.addListener(async tab => {
  if (opening) return;
  opening = true;
  try {
    await privateStorage();
    if (!tab.id || !/^https?:\/\//.test(tab.url || "")) {
      // A workspace can still be opened to manage documents on restricted pages.
      await chrome.storage.session.set({ target: null });
    } else await chrome.storage.session.set({ target: { tabId: tab.id, origin: new URL(tab.url).origin, title: tab.title || "" } });
    const { workspaceWindowId } = await chrome.storage.session.get("workspaceWindowId");
    if (Number.isInteger(workspaceWindowId)) {
      try {
        await chrome.windows.update(workspaceWindowId, { focused: true });
        await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" }).catch(() => {});
        return;
      } catch { /* Closed workspace: create a fresh window. */ }
    }
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("index.html"), type: "popup",
      width: 1080, height: 840, focused: true
    });
    await chrome.storage.session.set({ workspaceWindowId: win.id });
  } finally { opening = false; }
});
