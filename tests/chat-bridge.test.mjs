import test from 'node:test';
import assert from 'node:assert/strict';
import { automaticRows, exchangeWithChat } from '../src/chat-bridge.js';

test('automatic fill includes valid chat and saved answers, preserving manual and existing fields', () => {
  const fields = [ { id: 'name' }, { id: 'eligibility', userAnswerOnly: true }, { id: 'saved', userAnswerOnly: true }, { id: 'existing', filled: true }, { id: 'blocked', blockedReason: 'Signature' }, { id: 'unknown' } ];
  const rows = fields.map(f => ({ fieldId: f.id, value: 'Example', sourceType: 'chat', quote: 'User supplied fact', error: '' }));
  rows[2].trustedUser = true;
  rows[5].quote = '';
  assert.deepEqual(automaticRows({ fields }, rows).map(r => r.fieldId), ['name', 'saved']);
  assert.equal(automaticRows({ fields }, rows)[1].userConfirmed, true);
});

test('cancellation prevents sending or polling and clears isolated state', async () => {
  const controller = new AbortController(); controller.abort(new Error('Cancelled'));
  const calls = [];
  const api = { tabs: { get: async () => { throw new Error('Should not query'); } }, scripting: { executeScript: async args => { calls.push(args.args[0]); return []; } } };
  await assert.rejects(exchangeWithChat(1, 'prompt', 'scan', controller.signal, api), /Cancelled/);
  assert.deepEqual(calls, ['clear']);
});

test('navigation away from ChatGPT prevents sending', async () => {
  const calls = [];
  const api = { tabs: { get: async () => ({ url: 'https://example.com' }) }, scripting: { executeScript: async args => { calls.push(args.args[0]); return []; } } };
  await assert.rejects(exchangeWithChat(1, 'prompt', 'scan', new AbortController().signal, api), /changed sites/);
  assert.deepEqual(calls, ['clear']);
});


test('injected composer errors reach the user instead of a generic no-response message', async () => {
  const actions = [];
  const api = {
    tabs: { get: async () => ({ url: 'https://chatgpt.com/c/fictional' }) },
    scripting: { executeScript: async args => {
      actions.push(args.args[0]);
      return [{ result: args.args[0] === 'start' ? { error: 'ChatGPT message box not recognized.' } : {} }];
    } }
  };
  await assert.rejects(exchangeWithChat(1, 'prompt', 'scan', new AbortController().signal, api), /message box not recognized/);
  assert.deepEqual(actions, ['start', 'clear']);
});
