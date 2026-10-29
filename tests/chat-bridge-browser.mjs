import { browserOptions } from "../tests/browser-options.mjs";
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { chatPage } from '../src/chat-bridge.js';
const browser = await chromium.launch({ headless: true, ...browserOptions });
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
    await page.evaluate(markup => { document.body.innerHTML = markup + '<button aria-label="Send message">Send</button>'; }, markup);
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
  await page.evaluate(() => { document.body.innerHTML = '<div contenteditable="true" role="textbox"></div><div contenteditable="true" role="textbox"></div>'; });
  assert.match((await run('start')).error, /Multiple ChatGPT message boxes/);
  console.log('Chat bridge browser fixture passed: editor insertion, one send, streaming wait, response collection, cleanup, draft preservation.');
} finally { await browser.close(); }
