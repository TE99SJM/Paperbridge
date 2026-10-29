import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import http from "node:http";
import { createHelper, collectResponseStream } from "../helper/server.mjs";

const origin = "chrome-extension://" + "a".repeat(32);
const discovery = {
  issuer: "https://auth.openai.com", authorization_endpoint: "https://auth.openai.com/api/accounts/authorize",
  token_endpoint: "https://auth.openai.com/api/accounts/oauth/token", revocation_endpoint: "https://auth.openai.com/api/accounts/oauth/revoke",
  jwks_uri: "https://auth.openai.com/.well-known/jwks.json"
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
function streamChunks(strings) {
  const encoder = new TextEncoder();
  return new ReadableStream({ start(c) { strings.forEach(s => c.enqueue(encoder.encode(s))); c.close(); } });
}
const events = 'data: {"type":"response.output_text.delta","delta":"{\\"answers\\":[]}"}\n\ndata: {"type":"response.completed","response":{"status":"completed"}}\n\ndata: [DONE]\n\n';
test("SSE parser handles split chunks and requires completion", async () => {
  const output = await collectResponseStream(streamChunks([events.slice(0, 19), events.slice(19, 70), events.slice(70)]));
  assert.equal(output, '{"answers":[]}');
  await assert.rejects(collectResponseStream(streamChunks(['data: {"type":"response.output_text.delta","delta":"partial"}\n\n'])), /before a complete/);
  await assert.rejects(collectResponseStream(streamChunks(['data: {"type":"response.failed"}\n\n'])), /did not finish/);
  await assert.rejects(collectResponseStream(streamChunks(["data: not-json\n\n"])), /malformed/);
});
test("SSE parser handles CRLF split across buffers and final complete output", async () => {
  const body = 'data: {"type":"response.completed","response":{"status":"completed","output":[{"content":[{"type":"output_text","text":"complete"}]}]}}\r\n\r\n';
  assert.equal(await collectResponseStream(streamChunks([body.slice(0, -3), body.slice(-3)])), "complete");
});
test("helper enforces pairing, loopback host, OAuth PKCE, verified identity, logout", async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "paperbridge-test-"));
  let nonce = "", expectedClient = "", challenge = "", refreshes = 0, revoked = 0, generations = 0;
  const fetchImpl = async (url, options = {}) => {
    const u = String(url);
    if (u === discovery.token_endpoint) {
      const body = new URLSearchParams(options.body);
      if (body.get("grant_type") === "authorization_code") {
        assert.equal(body.get("client_id"), expectedClient);
        assert.equal(createHash("sha256").update(body.get("code_verifier")).digest("base64url"), challenge);
        assert.match(body.get("redirect_uri"), /^http:\/\/127\.0\.0\.1:\d+\/auth\/callback$/);
        assert.equal(body.get("resource"), "https://api.openai.com/v1");
      } else refreshes++;
      return json({ access_token: "SYNTHETIC_ACCESS", refresh_token: "SYNTHETIC_REFRESH", id_token: "SYNTHETIC_ID", token_type: "Bearer", scope: "openid chatgpt.tokens.use.direct resource.invoke", expires_in: 3600 });
    }
    if (u === discovery.revocation_endpoint) { revoked++; return new Response("", { status: 200 }); }
    assert.equal(options.headers.Authorization, "Bearer SYNTHETIC_ACCESS");
    if (u.endsWith("/models")) {
      assert.equal(u, "https://api.openai.com/v1/models");
      return json({ models: [{ slug: "test-model", display_name: "Test model", visibility: "list" }, { slug: "hidden", visibility: "hidden" }] });
    }
    if (u.endsWith("/responses")) {
      const body = JSON.parse(options.body);
      assert.equal(u, "https://api.openai.com/v1/responses");
      assert.equal(body.store, false); assert.equal(body.stream, true);
      assert.equal(body.max_output_tokens, undefined); assert.equal(body.tools, undefined);
      generations++; return new Response(streamChunks([events]));
    }
    throw new Error("Unexpected mock endpoint: " + u);
  };
  const helper = await createHelper({ folder, fetchImpl, discoveryOverride: discovery, quiet: true,
    verifyIdentity: async (_token, checks) => {
      assert.equal(checks.audience, expectedClient); assert.equal(checks.issuer, discovery.issuer);
      return { payload: { sub: "fictional-user", email: "fictional@example.com", name: "Fictional", nonce, exp: Date.now() / 1000 + 3600 } };
    }
  });
  const port = await helper.listen(0), base = `http://127.0.0.1:${port}`;
  t.after(async () => { await helper.close(); await fs.rm(folder, { recursive: true, force: true }); });
  const headers = { "Content-Type": "application/json", Origin: origin, "X-Paperbridge-Origin": origin, "X-Paperbridge-Token": helper.pairToken };
  const call = (route, body, extraHeaders = {}) => fetch(base + route, { method: body === undefined ? "GET" : "POST", headers: { ...headers, ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await fetch(base + "/health")).status, 200);
  assert.equal((await call("/status")).status, 403);
  assert.equal((await call("/pair", {}, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await call("/pair", {}, { "X-Paperbridge-Token": "wrong" })).status, 401);
  const rebinding = await new Promise((resolve, reject) => {
    const req = http.request(base + "/health", { headers: { Host: "rebind.example:" + port } }, res => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject); req.end();
  });
  assert.equal(rebinding, 403);
  assert.equal((await call("/pair", {})).status, 200);
  let status = await (await call("/status")).json();
  assert.deepEqual(status.accounts, []);
  assert.equal(JSON.stringify(status).includes("pairToken"), false);
  const flow = await (await call("/oauth/start", {})).json();
  const auth = new URL(flow.authorizationUrl);
  expectedClient = "oaiapp_synthetic_registration";
  nonce = auth.searchParams.get("nonce"); challenge = auth.searchParams.get("code_challenge");
  assert.equal(auth.searchParams.get("client_id"), "dynamic_agent_client");
  assert.match(auth.searchParams.get("ext_agent_host_id"), /^urn:uuid:/);
  const hostId = auth.searchParams.get("ext_agent_host_id");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(auth.searchParams.get("agent_name_hint"), "Paperbridge");
  assert.equal(auth.searchParams.get("resource"), "https://api.openai.com/v1");
  assert.match(auth.searchParams.get("scope"), /chatgpt.tokens.use.direct/);
  assert.match(auth.searchParams.get("scope"), /offline_access/);
  assert.equal((await fetch(base + "/auth/callback?state=wrong&code=synthetic")).status, 400);
  const callback = `${base}/auth/callback?state=${encodeURIComponent(auth.searchParams.get("state"))}&code=synthetic&client_id=${expectedClient}`;
  assert.equal((await fetch(callback)).status, 200);
  assert.equal((await fetch(callback)).status, 400, "authorization state must be single use");
  status = await (await call("/status")).json();
  assert.equal(status.accounts[0].email, "fictional@example.com");
  assert.equal(JSON.stringify(status).includes("SYNTHETIC_ACCESS"), false);
  const found = (await (await call("/models")).json()).models;
  assert.equal(found[0].id, "test-model"); assert.equal(found.length, 1);
  const returning = new URL((await (await call("/oauth/start", {})).json()).authorizationUrl);
  assert.equal(returning.searchParams.get("client_id"), expectedClient);
  assert.equal(returning.searchParams.get("ext_agent_host_id"), hostId);
  assert.equal(returning.searchParams.has("agent_name_hint"), false);
  assert.equal(returning.searchParams.get("id_token_hint"), "SYNTHETIC_ID");
  assert.equal((await fetch(`${base}/auth/callback?state=${returning.searchParams.get("state")}&code=synthetic&client_id=wrong_client`)).status, 400);
  assert.equal((await call("/generate", { model: "invented-model", prompt: "a valid test prompt" })).status, 400);
  const reply = await (await call("/generate", { model: "test-model", prompt: "a valid test prompt" })).json();
  assert.equal(reply.text, '{"answers":[]}'); assert.equal(generations, 1); assert.equal(refreshes, 0);
  const store = await fs.readFile(path.join(folder, "session.json"), "utf8");
  assert.doesNotMatch(store, /a valid test prompt/);
  if (process.platform !== "win32") assert.equal((await fs.stat(path.join(folder, "session.json"))).mode & 0o777, 0o600);
  const out = await (await call("/oauth/logout", {})).json();
  assert.equal(out.accounts.length, 1); assert.equal(out.accounts[0].connected, false);
  assert.equal(out.revoked, true); assert.equal(revoked, 1);
  assert.doesNotMatch(await fs.readFile(path.join(folder, "session.json"), "utf8"), /SYNTHETIC_ACCESS|SYNTHETIC_REFRESH/);
  assert.equal((await call("/models")).status, 401);
  const reauth = new URL((await (await call("/oauth/start", {})).json()).authorizationUrl);
  assert.equal(reauth.searchParams.get("client_id"), expectedClient);
  assert.equal(reauth.searchParams.get("ext_agent_host_id"), hostId);
  assert.equal(reauth.searchParams.has("id_token_hint"), false);
});
test("helper rejects missing consent scopes and mismatched identity nonces", async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "paperbridge-nonce-test-"));
  let mode = "nonce", nonce;
  const helper = await createHelper({
    folder, quiet: true, discoveryOverride: discovery,
    fetchImpl: async () => json({ id_token: "fake", access_token: "fake", scope: mode === "scope" ? "openid" : "openid chatgpt.tokens.use.direct" }),
    verifyIdentity: async () => ({ payload: { sub: "test", nonce: mode === "nonce" ? "wrong" : nonce, exp: Date.now() / 1000 + 500 } })
  });
  const port = await helper.listen(0), base = `http://127.0.0.1:${port}`;
  t.after(async () => { await helper.close(); await fs.rm(folder, { recursive: true, force: true }); });
  const headers = { "Content-Type": "application/json", Origin: origin, "X-Paperbridge-Token": helper.pairToken };
  const post = (route, body = {}) => fetch(base + route, { method: "POST", headers, body: JSON.stringify(body) });
  await post("/pair");
  for (mode of ["nonce", "scope"]) {
    const flow = await (await post("/oauth/start", { newProfile: true })).json(), url = new URL(flow.authorizationUrl);
    nonce = url.searchParams.get("nonce");
    const response = await fetch(`${base}/auth/callback?state=${url.searchParams.get("state")}&code=test&client_id=oaiapp_fake_${mode}`);
    assert.equal(response.status, 400);
    assert.equal((await (await fetch(base + "/status", { headers })).json()).accounts.length, 0);
  }
});
