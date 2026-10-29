async function privateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}
chrome.runtime.onInstalled.addListener(() => privateStorage().catch(() => {}));
chrome.runtime.onStartup.addListener(() => privateStorage().catch(() => {}));

async function setTarget(tab) {
  if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) {
    await chrome.storage.session.set({ target: null });
    return;
  }
  await chrome.storage.session.set({
    target: { tabId: tab.id, origin: new URL(tab.url).origin, title: tab.title || "" }
  });
}

let opening = false;
chrome.action.onClicked.addListener(async tab => {
  if (opening) return;
  opening = true;
  try {
    // Invoke Chromium's side-panel API directly during the toolbar click gesture.
    // Opera GX uses its manifest sidebar_action button instead.
    const isWebPage = !!tab?.id && /^https?:\/\//.test(tab.url || "");
    const panelPromise = !globalThis.opr?.sidebarAction && chrome.sidePanel?.open && isWebPage
      ? chrome.sidePanel.open({ tabId: tab.id })
      : null;

    await privateStorage();
    await setTarget(tab);
    await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" }).catch(() => {});

    if (globalThis.opr?.sidebarAction) {
      // Do not create a detached window in Opera. The user opens Paperbridge
      // from Opera's sidebar button configured by sidebar_action in manifest.json.
      return;
    }
    if (panelPromise) {
      await panelPromise;
      return;
    }

    // Browsers without a sidebar API keep the action non-disruptive: no surprise
    // popup window. The extension page remains available from the extension menu.
  } catch (err) {
    console.error("Paperbridge could not open its browser side panel.", err);
  } finally {
    opening = false;
  }
});

// Keep the active application target current while the sidebar remains open.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await setTarget(await chrome.tabs.get(tabId));
    await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" }).catch(() => {});
  } catch { /* Tab may close before it can be read. */ }
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  try {
    const { target } = await chrome.storage.session.get("target");
    if (target?.tabId !== tabId) return;
    await setTarget(tab);
    await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" }).catch(() => {});
  } catch { /* Ignore tabs removed during navigation. */ }
});
