import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserOptions } from './browser-options.mjs';
import { mountDock } from '../src/dock.js';
const root = path.resolve(new URL('..',import.meta.url).pathname);
const server = http.createServer(async (req,res) => {
  const file = path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if (!file.startsWith(root+'/preview/') && !file.startsWith(root+'/examples/')) {res.writeHead(404).end();return;}
  try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));} catch {res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true,...browserOptions});
try {
  const p = await browser.newPage();
  await p.goto(`${base}/preview/index.html`);
  await p.locator('nav').waitFor();
  for (const width of [320,375,420]) {
    await p.setViewportSize({width,height:700});
    for (const view of ['page','documents','saved','connection','review']) {
      await p.locator(`[data-view="${view}"]`).click();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${view} overflows at ${width}`);
    }
    assert.equal(await p.locator('[data-action=backup]').isVisible(),true);
  }
  await p.setViewportSize({width:1280,height:900});
  await p.goto(`${base}/examples/practice-form.html`);
  const prior = await p.evaluate(()=>document.documentElement.style.marginRight);
  await p.evaluate(mountDock,`${base}/preview/index.html`);
  const dock = await p.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/preview/index.html')});
  await dock.locator('nav').waitFor();
  assert.equal(await dock.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.evaluate(mountDock,`${base}/preview/index.html`);
  await p.waitForFunction(()=>!document.getElementById('__paperbridgeDock'));
  assert.equal(await p.evaluate(()=>document.documentElement.style.marginRight),prior);
  console.log('Dock DOM and 320/375/420px preview layouts passed. This does not verify Opera APIs or an installed extension.');
} finally {await browser.close();server.close();}
