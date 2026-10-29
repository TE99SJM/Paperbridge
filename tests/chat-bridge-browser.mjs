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
  await assert.rejects(run('poll'), /request was lost/);
  await assert.rejects(run('start'), /unsent draft/);
  console.log('Chat bridge browser fixture passed: editor insertion, one send, streaming wait, response collection, cleanup, draft preservation.');
} finally { await browser.close(); }
