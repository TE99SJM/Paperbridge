import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, PROVIDERS } from "../src/core.js";
import { providerRequest, callProvider, listModels } from "../src/providers.js";
const settings = id => ({ ...DEFAULT_SETTINGS, mode: "api", provider: id, apiBase: PROVIDERS[id].base || "https://api.example.com/v1", apiKey: "TEST_ONLY_NOT_A_REAL_KEY", model: "test-model" });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
test("OpenAI uses Responses with storage disabled", () => {
  const req = providerRequest(settings("openai"), "sample prompt");
  assert.equal(req.url, "https://api.openai.com/v1/responses");
  assert.equal(req.body.store, false);
  assert.equal(req.body.model, "test-model");
});
test("Anthropic adapter uses the native Messages request", () => {
  const req = providerRequest(settings("anthropic"), "sample prompt");
  assert.equal(req.url, "https://api.anthropic.com/v1/messages");
  assert.equal(req.headers["anthropic-version"], "2023-06-01");
  assert.equal(req.headers.Authorization, undefined);
  assert.equal(req.body.max_tokens, 12000);
});
test("compatible endpoints and Ollama use chat/completions", () => {
  for (const id of ["gemini", "openrouter", "ollama", "custom"]) assert.match(providerRequest(settings(id), "p").url, /\/chat\/completions$/);
  assert.ok(providerRequest({ ...settings("ollama"), apiKey: "" }, "p"));
});
test("preset host cannot be changed without choosing custom; keys are required", () => {
  assert.throws(() => providerRequest({ ...settings("openai"), apiBase: "https://evil.example/v1" }, "p"), /host has changed/);
  assert.throws(() => providerRequest({ ...settings("openai"), apiKey: "" }, "p"), /API key/);
  assert.throws(() => providerRequest({ ...settings("openai"), model: "" }, "p"), /model ID/);
});
test("Responses output is normalized and credentials never go via cookies", async () => {
  const text = await callProvider(settings("openai"), "p", undefined, async (url, opts) => {
    assert.equal(opts.credentials, "omit"); assert.equal(opts.redirect, "error");
    return response({ status: "completed", output: [{ content: [{ type: "output_text", text: "answer" }] }] });
  });
  assert.equal(text, "answer");
});
test("all adapter reply types are normalized", async () => {
  assert.equal(await callProvider(settings("anthropic"), "p", undefined, async () => response({ stop_reason: "end_turn", content: [{ type: "text", text: "answer" }] })), "answer");
  assert.equal(await callProvider(settings("custom"), "p", undefined, async () => response({ choices: [{ finish_reason: "stop", message: { content: "answer" } }] })), "answer");
});
test("truncated and incomplete output is never accepted", async () => {
  await assert.rejects(callProvider(settings("anthropic"), "p", undefined, async () => response({ stop_reason: "max_tokens", content: [] })), /ran out/);
  await assert.rejects(callProvider(settings("openai"), "p", undefined, async () => response({ status: "incomplete", output: [] })), /did not complete/);
  await assert.rejects(callProvider(settings("custom"), "p", undefined, async () => response({ choices: [{ finish_reason: "length", message: { content: "partial" } }] })), /incomplete/);
});
test("errors do not echo prompts or provider-reflected API keys", async () => {
  await assert.rejects(callProvider(settings("openai"), "PRIVATE_PROMPT", undefined, async () => response({ error: { code: "invalid_api_key", message: "TEST_ONLY_NOT_A_REAL_KEY PRIVATE_PROMPT" } }, 401)), err => {
    assert.match(err.message, /401/); assert.doesNotMatch(err.message, /PRIVATE_PROMPT|TEST_ONLY/); return true;
  });
});
test("HTML endpoint errors and model discovery are handled", async () => {
  await assert.rejects(callProvider(settings("openai"), "p", undefined, async () => new Response("<html>wrong endpoint</html>")), /non-JSON/);
  const models = await listModels(settings("openai"), undefined, async () => response({ data: [{ id: "model-a" }, { other: true }] }));
  assert.deepEqual(models, [{ id: "model-a", name: "model-a" }]);
});
