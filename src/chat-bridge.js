// Runs only in the explicitly selected ChatGPT tab's isolated extension world.
export function chatPage(action, request) {
  const key = '__paperbridgeChatRequest';
  const streaming = () => !!document.querySelector('[data-testid="stop-button"], button[aria-label="Stop streaming"]');
  if (action === 'start') {
    if (location.origin !== 'https://chatgpt.com') throw new Error('Select a ChatGPT website tab.');
    if (streaming()) throw new Error('ChatGPT is already responding. Wait before retrying.');
    const editor = document.querySelector('#prompt-textarea');
    if (!editor || editor.getAttribute('contenteditable') !== 'true') throw new Error('ChatGPT composer unavailable. Sign in and open a conversation.');
    if (editor.textContent.trim()) throw new Error('ChatGPT has an unsent draft. Send or clear it first.');
    const previous = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const state = { id: request.id, href: location.href, previous, response: null, text: '', stable: 0 };
    // Insert plain text via the editor so its framework observes the change.
    editor.focus();
    const selection = getSelection(), range = document.createRange();
    range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
    if (!document.execCommand('insertText', false, request.prompt)) throw new Error('Cannot insert the ChatGPT prompt. Use manual mode.');
    globalThis[key] = state;
    return { ready: true };
  }
  const state = globalThis[key];
  if (!state || state.id !== request.id) throw new Error('ChatGPT request was lost. Nothing will be filled.');
  if (action === 'send') {
    const editor = document.querySelector('#prompt-textarea');
    if (editor?.textContent !== request.prompt) throw new Error('The ChatGPT draft changed. Nothing was sent.');
    const button = document.querySelector('[data-testid="send-button"]');
    if (!button || button.disabled) return { waiting: true };
    button.click(); state.sent = true;
    return { sent: true };
  }
  if (action === 'poll') {
    if (!state.sent) throw new Error('The prompt was not sent.');
    const candidates = [...document.querySelectorAll('[data-message-author-role="assistant"]')].filter(n => !state.previous.includes(n));
    const response = candidates.at(-1);
    if (!response) return { waiting: true };
    const text = response.innerText || response.textContent || '';
    if (response === state.response && text === state.text && !streaming()) state.stable++;
    else state.stable = 0;
    state.response = response; state.text = text;
    // Require a complete structured response as well as an idle, stable message.
    const complete = text.includes(request.scanId) && text.includes('"answers"') && text.trim().match(/}\s*(?:```)?\s*$/);
    return state.stable >= 3 && complete ? { text } : { waiting: true };
  }
  if (action === 'clear') { delete globalThis[key]; return {}; }
  throw new Error('Unknown chat bridge operation.');
}

export async function exchangeWithChat(tabId, prompt, scanId, signal, api = chrome) {
  const id = crypto.randomUUID();
  const request = { id, prompt, scanId };
  const run = async action => {
    signal.throwIfAborted();
    const tab = await api.tabs.get(tabId);
    if (new URL(tab.url).origin !== 'https://chatgpt.com') throw new Error('The selected ChatGPT tab changed sites.');
    const result = await api.scripting.executeScript({ target: { tabId }, func: chatPage, args: [action, request] });
    if (!result[0]?.result) throw new Error('ChatGPT did not respond to the extension.');
    return result[0].result;
  };
  const pause = () => new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    await run('start');
    const deadline = Date.now() + 300000;
    let sent = false;
    while (Date.now() < deadline) {
      await pause();
      if (!sent) { sent = !!(await run('send')).sent; continue; }
      const response = await run('poll');
      if (response.text) return response.text;
    }
    throw new Error('ChatGPT timed out. Check its tab for a usage limit or error. Nothing was filled.');
  } finally {
    await api.scripting.executeScript({ target: { tabId }, func: chatPage, args: ['clear', request] }).catch(() => {});
  }
}

export function automaticRows(scan, rows) {
  const fields = new Map(scan.fields.map(f => [f.id, f]));
  return rows.filter(row => {
    const field = fields.get(row.fieldId);
    return field && !field.blockedReason && !field.filled && !row.error && row.value !== null &&
      (!field.userAnswerOnly || row.trustedUser) &&
      (row.trustedUser || row.matched || (row.sourceType === 'chat' && row.quote.trim().length >= 4));
  }).map(row => ({ fieldId: row.fieldId, value: row.value, userConfirmed: !!row.trustedUser }));
}
