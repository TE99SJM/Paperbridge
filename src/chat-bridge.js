// Runs only in the explicitly selected ChatGPT tab's isolated extension world.
export function chatPage(action, request) {
  // Return errors explicitly: some Chromium/Opera versions omit thrown errors
  // from executeScript results, leaving the caller with an undefined result.
  try {
  const key = '__paperbridgeChatRequest';
  const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const editorText = node => node.tagName === 'TEXTAREA' ? node.value : node.innerText || node.textContent || '';
  // Rich-text editors render each line as a paragraph and can use NBSP
  // for indentation. Compare that formatting without discarding any words.
  const renderedText = text => text.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').replace(/\n+/g, '\n').replace(/^\n|\n$/g, '');
  const findEditor = () => {
    const selectors = [
      '#prompt-textarea',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][data-placeholder="Work with ChatGPT"]',
      '[contenteditable="true"][aria-label="Work with ChatGPT"]',
      'textarea[placeholder="Work with ChatGPT"]',
      'textarea[placeholder="Message ChatGPT"]',
      'textarea[data-testid="prompt-textarea"]'
    ];
    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)].filter(node =>
        visible(node) && !node.disabled && !node.readOnly &&
        (node.tagName === 'TEXTAREA' || node.getAttribute('contenteditable') === 'true'));
      if (candidates.length > 1) throw new Error('Multiple ChatGPT message boxes found. Close extra chat panels before retrying.');
      if (candidates.length === 1) return candidates[0];
    }
    throw new Error('ChatGPT message box not recognized. Open a regular ChatGPT conversation and try again.');
  };
  const streaming = () => !!document.querySelector('[data-testid="stop-button"], button[aria-label="Stop streaming"]');
  if (action === 'start') {
    if (location.origin !== 'https://chatgpt.com') throw new Error('Select a ChatGPT website tab.');
    if (streaming()) throw new Error('ChatGPT is already responding. Wait before retrying.');
    const editor = findEditor();
    if (editorText(editor).trim()) throw new Error('ChatGPT has an unsent draft. Send or clear it first.');
    const previous = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const state = { id: request.id, href: location.href, previous, response: null, text: '', stable: 0 };
    // Insert plain text via the editor so its framework observes the change.
    editor.focus();
    if (editor.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(editor, request.prompt);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const selection = getSelection(), range = document.createRange();
      range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
      if (!document.execCommand('insertText', false, request.prompt)) throw new Error('Cannot insert the ChatGPT prompt. Use manual mode.');
    }
    if (renderedText(editorText(editor)) !== renderedText(request.prompt)) throw new Error('ChatGPT did not accept the complete prompt. Nothing was sent.');
    globalThis[key] = state;
    return { ready: true };
  }
  const state = globalThis[key];
  if (!state || state.id !== request.id) throw new Error('ChatGPT request was lost. Nothing will be filled.');
  if (action === 'send') {
    if (state.sent) throw new Error('This ChatGPT prompt was already sent.');
    if (location.href !== state.href) throw new Error('The ChatGPT conversation changed. Nothing was sent.');
    // The chat framework can replace the composer or normalize its paragraphs
    // after the input event. Re-find it and compare content, not DOM identity
    // or a pre-render snapshot. Substantive edits still stop the run.
    const editor = findEditor();
    if (renderedText(editorText(editor)) !== renderedText(request.prompt)) throw new Error('The ChatGPT draft changed. Nothing was sent.');
    const buttons = [...document.querySelectorAll('[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button#composer-submit-button, button[type="submit"][aria-label="Send"]')].filter(visible);
    if (buttons.length !== 1 || buttons[0].disabled || buttons[0].getAttribute('aria-disabled') === 'true') return { waiting: true };
    const button = buttons[0];
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
  } catch (error) { return { error: error.message || 'ChatGPT tab operation failed.' }; }
}

export async function exchangeWithChat(tabId, prompt, scanId, signal, api = chrome) {
  const id = crypto.randomUUID();
  const request = { id, prompt, scanId };
  const run = async action => {
    signal.throwIfAborted();
    const tab = await api.tabs.get(tabId);
    if (new URL(tab.url).origin !== 'https://chatgpt.com') throw new Error('The selected ChatGPT tab changed sites.');
    const result = await api.scripting.executeScript({ target: { tabId }, func: chatPage, args: [action, request] });
    if (result[0]?.result?.error) throw new Error(result[0].result.error);
    if (!result[0]?.result) throw new Error('ChatGPT tab script returned no result. Reload the ChatGPT tab and try again.');
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
