import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function background(native = true) {
  const source = (await fs.readFile(new URL('../src/background.js', import.meta.url), 'utf8')).replace(/^import .*\n/, '');
  const listeners = {}, state = {}, calls = [];
  const event = name => ({ addListener: fn => { listeners[name] = fn; } });
  const chrome = {
    storage: { local: { setAccessLevel: async () => {} }, session: { setAccessLevel: async () => {}, set: async data => Object.assign(state, data) } },
    runtime: { id: 'fixture', onInstalled:event('installed'), onStartup:event('startup'), onConnect:event('connect'), onMessage:event('message'), sendMessage:async msg => calls.push(msg), getURL:p => `chrome-extension://fixture/${p}` },
    action: { onClicked:event('click'), setBadgeText:async x => calls.push(x), setTitle:async x => calls.push(x) },
    scripting:{ executeScript:async x => calls.push(x) },
    sidePanel:native ? { open: x => { calls.push({open:x}); return Promise.resolve(); }, onClosed:event('closed') } : undefined
  };
  vm.runInNewContext(source, {chrome, navigator:{userAgent:native?'Chromium':'OPR/137'},crypto,console,mountDock:()=>{},URL});
  return {listeners,state,calls};
}
const settle = () => new Promise(r => setTimeout(r, 10));
test('toolbar opens native panel synchronously; ChatGPT never replaces target', async () => {
  const h = await background();
  h.listeners.click({id:7,windowId:1,url:'https://form.test/app',title:'Form'});
  assert.ok(h.calls[0].open); await settle();
  assert.equal(h.state.target.tabId,7);
  h.listeners.click({id:8,windowId:1,url:'https://chatgpt.com/c/test'}); await settle();
  assert.equal(h.state.target.tabId,7);
});
test('Opera uses an injected dock; no popup/window API exists in harness', async () => {
  const h = await background(false);
  h.listeners.click({id:7,windowId:1,url:'https://form.test/app'}); await settle();
  assert.equal(h.calls.find(x=>x.target)?.target.tabId,7);
  assert.match(h.calls.find(x=>x.args)?.args[0], /index.html\?dock=/);
  let permitted;
  h.listeners.message({type:'dock-authorize',token:'invalid'},{id:'fixture',tab:{id:7}},x=>permitted=x);
  assert.equal(permitted,false);
});
test('disconnect revokes write lease and panel close revokes active leases', async () => {
  const h = await background(); let disconnect;
  h.listeners.connect({name:'panel:secret',onDisconnect:{addListener:f=>disconnect=f},disconnect:()=>disconnect()});
  let live; const check=()=>h.listeners.message({type:'panel-lease',token:'secret'},{id:'fixture'},x=>live=x);
  check(); assert.equal(live,true); h.listeners.closed(); check(); assert.equal(live,false);
});
