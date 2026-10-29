import { mountDock } from './dock.js';
async function privateStorage() {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}
chrome.runtime.onInstalled.addListener(() => privateStorage().catch(console.error));
chrome.runtime.onStartup.addListener(() => privateStorage().catch(console.error));
const leases = new Map();
const docks = new Map();
chrome.runtime.onConnect.addListener(port => {
  if (!port.name.startsWith('panel:')) return;
  const token = port.name.slice(6);
  leases.set(token, port);
  port.onMessage?.addListener(() => {});
  port.onDisconnect.addListener(() => leases.delete(token));
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === 'dock-authorize') reply(docks.get(msg.token) === sender.tab?.id);
  if (msg.type === 'panel-lease') reply(leases.has(msg.token));
});
chrome.sidePanel?.onClosed?.addListener(() => {
  for (const port of leases.values()) port.disconnect();
  leases.clear();
});
const isForm = tab => tab?.id && /^https?:\/\//.test(tab.url || '') && !/^https:\/\/(chatgpt.com|chat.openai.com)(\/|$)/.test(tab.url);
chrome.action.onClicked.addListener(tab => {
  // Call open synchronously within the user gesture; never create a window.
  const native = chrome.sidePanel?.open && !/OPR\//.test(navigator.userAgent);
  const opened = native ? chrome.sidePanel.open({ windowId: tab.windowId }) : Promise.resolve();
  (async () => {
    await privateStorage();
    // ChatGPT clicks must preserve the application, including during a run.
    if (isForm(tab)) {
      await chrome.storage.session.set({ target: { tabId: tab.id, origin: new URL(tab.url).origin, title: tab.title || '' } });
      await chrome.runtime.sendMessage({ type: 'paperbridge-target-changed' }).catch(() => {});
    }
    await opened;
    if (!native) {
      if (!isForm(tab)) throw new Error('Open Paperbridge on an ordinary application webpage.');
      const token = crypto.randomUUID();
      docks.set(token, tab.id);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: mountDock, args: [chrome.runtime.getURL(`index.html?dock=${token}`)] });
    }
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  })().catch(async error => {
    console.error(error);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    await chrome.action.setTitle({ tabId: tab.id, title: `Paperbridge: ${error.message}` });
  });
});
