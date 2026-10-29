import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { chatPage } from '../src/chat-bridge.js';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('https://chatgpt.com/**', route => route.fulfill({ contentType: 'text/html', body: '<div data-message-author-role="assistant">Old answer</div><div id="prompt-textarea" contenteditable="true"></div><button data-testid="send-button">Send</button>' }));
  await page.goto('https://chatgpt.com/c/fictional');
  const request = { id: 'test', scanId: 'fictional-scan', prompt: 'A fictional prompt' };
  const run = action => page.evaluate(({ fn, action, request }) => (0, eval)(`(${fn})`)(action, request), { fn: chatPage.toString(), action, request });
  await run('start');
  assert.equal(await page.locator('#prompt-textarea').innerText(), request.prompt);
  await page.evaluate(() => {
    document.querySelector('button').onclick = () => {
      globalThis.sent = (globalThis.sent || 0) + 1;
      const reply = document.createElement('div');
      reply.dataset.messageAuthorRole = 'assistant';
      reply.textContent = '{"scanId":"fictional-scan","answers":[]}';
      document.body.append(reply);
      const stop = document.createElement('button'); stop.dataset.testid = 'stop-button'; document.body.append(stop);
    };
  });
  assert.equal((await run('send')).sent, true);
  for (let i = 0; i < 5; i++) assert.equal((await run('poll')).waiting, true, 'Streaming reply must not be used');
  await page.locator('[data-testid="stop-button"]').evaluate(n => n.remove());
  let result;
  for (let i = 0; i < 4; i++) result = await run('poll');
  assert.equal(JSON.parse(result.text).scanId, request.scanId);
  assert.equal(await page.evaluate(() => globalThis.sent), 1);
  await run('clear');
  assert.match((await run('poll')).error, /request was lost/);
  assert.match((await run('start')).error, /unsent draft/);
  // Alternate composers: no fixed ID, and textarea-based controlled inputs.
  for (const markup of [
    '<div contenteditable="true" role="textbox" aria-label="Work with ChatGPT"></div>',
    '<textarea placeholder="Work with ChatGPT"></textarea>'
  ]) {
    await page.evaluate(markup => { document.body.innerHTML = markup + '<button type="submit" aria-label="Send">Send</button>'; }, markup);
    request.prompt = 'Fictional form prompt\n\nWith multiple paragraphs.';
    const started = await run('start');
    assert.equal(started.ready, true, JSON.stringify(started));
    const editor = page.locator('[contenteditable], textarea');
    const inserted = await editor.evaluate(node => node.tagName === 'TEXTAREA' ? node.value : node.innerHTML);
    await editor.evaluate(node => { if (node.tagName === 'TEXTAREA') node.value += 'Changed'; else node.append(document.createTextNode('Changed')); });
    assert.match((await run('send')).error, /draft changed/);
    await editor.evaluate((node, inserted) => { if (node.tagName === 'TEXTAREA') node.value = inserted; else node.innerHTML = inserted; }, inserted);
    await page.locator('button').evaluate(button => { button.onclick = () => { globalThis.sent++; }; });
    assert.equal((await run('send')).sent, true);
    assert.match((await run('send')).error, /already sent/);
    await run('clear');
  }
  // Reproduce the paragraph-based composer and JSON indentation used by ChatGPT.
  // Its innerText differs from inserted plain text even when all content arrived.
  request.prompt = 'Draft truthful form answers.\nReturn only JSON.\n\nBEGIN_UNTRUSTED_FORM_DATA_JSON\n' + JSON.stringify({
    scanId: request.scanId,
    fields: Array.from({ length: 120 }, (_, i) => ({ id: `field-${i}`, label: `Fictional field ${i}`, options: [] }))
  }, null, 2) + '\nEND_UNTRUSTED_FORM_DATA_JSON';
  for (const truncate of [false, true]) {
    await page.evaluate(({ prompt, truncate }) => {
      document.body.innerHTML = '<div id="prompt-textarea" contenteditable="true" role="textbox"><p><br></p></div><button id="composer-submit-button" aria-label="Send prompt">Send</button>';
      globalThis.fixtureSends = 0;
      document.querySelector('button').onclick = () => { globalThis.fixtureSends++; };
      const editor = document.querySelector('#prompt-textarea');
      editor.addEventListener('input', () => {
        const text = truncate ? prompt.slice(0, -10) : prompt;
        editor.replaceChildren(...text.split('\n').map(line => {
          const p = document.createElement('p');
          if (line) p.textContent = line.replace(/ /g, '\u00a0');
          else p.append(document.createElement('br'));
          return p;
        }));
      }, { once: true });
    }, { prompt: request.prompt, truncate });
    const started = await run('start');
    if (truncate) {
      assert.match(started.error, /complete prompt/);
      assert.equal(await page.evaluate(() => globalThis.fixtureSends), 0);
    } else {
      assert.equal(started.ready, true, JSON.stringify(started));
      // Deferred framework rendering may replace the composer entirely.
      await page.evaluate(prompt => {
        const editor = document.querySelector('#prompt-textarea');
        const replacement = editor.cloneNode(false);
        replacement.style.whiteSpace = 'pre-wrap';
        replacement.textContent = prompt;
        editor.replaceWith(replacement);
      }, request.prompt);
      const send = await run('send');
      assert.equal(send.sent, true, JSON.stringify(send));
      assert.equal(await page.evaluate(() => globalThis.fixtureSends), 1, 'Prompt must send automatically, exactly once');
      assert.match((await run('send')).error, /already sent/);
      assert.equal(await page.evaluate(() => globalThis.fixtureSends), 1);
      await run('clear');
      // Replacement must still reject changed message content.
      await page.evaluate(() => { document.querySelector('#prompt-textarea').textContent = ''; });
      assert.equal((await run('start')).ready, true);
      await page.evaluate(() => {
        const editor = document.querySelector('#prompt-textarea');
        const replacement = editor.cloneNode(true);
        replacement.append(document.createTextNode(' UNAUTHORIZED CHANGE'));
        editor.replaceWith(replacement);
      });
      assert.match((await run('send')).error, /draft changed/);
      assert.equal(await page.evaluate(() => globalThis.fixtureSends), 1);
      await run('clear');
    }
  }
  await page.evaluate(() => { document.body.innerHTML = '<div contenteditable="true" role="textbox"></div><div contenteditable="true" role="textbox"></div>'; });
  assert.match((await run('start')).error, /Multiple ChatGPT message boxes/);
  console.log('Chat bridge browser fixture passed: editor insertion, one send, streaming wait, response collection, cleanup, draft preservation.');
} finally { await browser.close(); }
