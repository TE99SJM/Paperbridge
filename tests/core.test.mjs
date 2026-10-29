import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  newVault, safeBaseUrl, safeChatUrl, permissionOrigin, buildPrompt,
  parseAnswerObject, reviewAnswers, applySavedAnswers, validateFieldValue, normalize
} from "../src/core.js";
import { matchingSavedAnswer, normalizeQuestion, userAnswerKind } from "../src/answers.js";
import { createVaultKey, sealVault, openVault } from "../src/vault.js";
import { demoVault, demoScan, demoAnswer } from "../src/demo.js";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("new vault has no personal data or embedded secrets", () => {
  const v = newVault();
  assert.deepEqual(v.documents, []);
  assert.equal(v.notes, "");
  assert.equal(v.settings.apiKey, "");
  assert.equal(v.settings.helperToken, "");
  assert.equal(v.settings.mode, "manual");
  assert.equal(v.settings.useChatContext, true);
  assert.deepEqual(v.savedAnswers, []);
});
test("remote providers must use HTTPS; only loopback may use HTTP", () => {
  assert.equal(safeBaseUrl(" https://api.example.com/v1/ "), "https://api.example.com/v1");
  assert.equal(safeBaseUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1");
  assert.equal(safeBaseUrl("http://localhost:11434/v1"), "http://localhost:11434/v1");
  for (const url of ["http://evil.example/v1", "http://192.168.1.2/v1", "javascript:alert(1)", "file:///etc/passwd", "https://user:pass@example.com/v1", "https://example.com/v1?key=secret", "https://example.com/v1#bad"]) assert.throws(() => safeBaseUrl(url));
});
test("host patterns omit ports while fetch endpoints retain ports", () => {
  assert.equal(permissionOrigin("http://127.0.0.1:47821"), "http://127.0.0.1/*");
  assert.equal(permissionOrigin("https://example.com:9443/v1"), "https://example.com/*");
});
test("chat links accept HTTPS only and forbid embedded credentials", () => {
  assert.equal(safeChatUrl("https://chatgpt.com/"), "https://chatgpt.com/");
  for (const value of ["http://example.com", "javascript:alert(1)", "https://a:b@example.com"]) assert.throws(() => safeChatUrl(value));
});
test("prompt includes selected documents and notes, never keys or sensitive fields", () => {
  const v = demoVault(), s = demoScan();
  v.settings.apiKey = "secret-test-should-never-appear";
  v.documents.push({ id: "unselected", name: "private.txt", text: "UNSELECTED_PRIVATE_CONTENT", include: false });
  v.notes = "My explicit notes";
  s.fields.push({ id: "blocked", label: "Social Security", type: "text", blockedReason: "Sensitive" });
  const p = buildPrompt(s, v);
  assert.match(p.prompt, /Jordan Avery/);
  assert.match(p.prompt, /My explicit notes/);
  assert.doesNotMatch(p.prompt, /secret-test-should-never-appear|UNSELECTED_PRIVATE_CONTENT|"id": "blocked"/);
  assert.equal(p.sources.length, 2);
});
test("empty and oversized context fail before transmission", () => {
  const s = demoScan(), v = newVault();
  assert.throws(() => buildPrompt(null, v), /Scan/);
  assert.throws(() => buildPrompt(s, v), /add background/);
  v.notes = "x".repeat(150000);
  assert.throws(() => buildPrompt(s, v), /too large/);
});
test("plain, fenced, surrounded, and HTML-encoded JSON are parsed without eval", () => {
  const value = '{"scanId":"s","answers":[]}';
  for (const text of [value, "```json\n" + value + "\n```", "Here is the result:\n" + value]) assert.equal(parseAnswerObject(text).scanId, "s");
  const encoded = value.replace(/ /g, "&#x20;").replace(/"/g, "&quot;");
  assert.equal(parseAnswerObject(encoded).scanId, "s");
  const copied = "{\\\\\n&#x20; \\"scanId\\": \\"s\\",\\\\\n&#x20; \\"answers\\": []\\\\\n}";
  assert.equal(parseAnswerObject(copied).scanId, "s");
  assert.throws(() => parseAnswerObject("(()=>{globalThis.hacked=true})()"), /No valid/);
  assert.equal(globalThis.hacked, undefined);
  assert.throws(() => parseAnswerObject("x".repeat(1000001)), /safety/);
});
test("unknown, duplicate, and stale model field IDs are rejected atomically", () => {
  const v = demoVault(), s = demoScan(), data = demoAnswer(s);
  assert.throws(() => reviewAnswers({ ...data, scanId: "stale" }, s, v), /different scan/);
  assert.throws(() => reviewAnswers({ scanId: s.scanId, answers: [{ fieldId: "unknown", value: "a" }] }, s, v), /unknown/);
  assert.throws(() => reviewAnswers({ ...data, answers: [data.answers[0], data.answers[0]] }, s, v), /duplicate/);
});
test("answers start unapproved and only literal selected-source quotes match", () => {
  const v = demoVault(), s = demoScan(), data = demoAnswer(s);
  const reviewed = reviewAnswers(data, s, v);
  assert.equal(reviewed.filter(r => r.matched).length, 10);
  assert.ok(reviewed.every(r => !r.approved));
  data.answers[0].quote = "Invented quotation";
  data.answers[1].source_id = "unknown-source";
  const bad = reviewAnswers(data, s, v);
  assert.equal(bad[0].matched, false);
  assert.equal(bad[1].matched, false);
  v.documents[0].include = false;
  assert.ok(reviewAnswers(data, s, v).every(r => !r.matched));
});
test("model cannot un-block a sensitive field", () => {
  const s = demoScan(), v = demoVault(), f = s.fields.at(-1);
  const out = reviewAnswers({ scanId: s.scanId, answers: [{ fieldId: f.id, value: true, source_id: "sample-resume", quote: "Jordan Avery" }] }, s, v).at(-1);
  assert.equal(out.value, null);
  assert.match(out.error, /Sensitive/);
});
test("quotes can match across normalized whitespace, not arbitrary references", () => {
  assert.equal(normalize("  A\n  B "), "a b");
  const v = demoVault(), s = demoScan(), data = demoAnswer(s);
  data.answers[0].quote = "Jo";
  assert.equal(reviewAnswers(data, s, v)[0].matched, false);
});
test("input values enforce email, number, dates, and maxlength", () => {
  const base = { kind: "text", type: "text" };
  assert.equal(validateFieldValue({ ...base, maxLength: 3 }, "abcd").value, null);
  assert.ok(validateFieldValue({ ...base, type: "email" }, "not-email").error);
  assert.equal(validateFieldValue({ ...base, type: "email" }, "test@example.com").error, "");
  assert.ok(validateFieldValue({ ...base, type: "number" }, "forty").error);
  assert.equal(validateFieldValue({ ...base, type: "number" }, 1200).value, "1200");
  assert.ok(validateFieldValue({ ...base, type: "date" }, "tomorrow").error);
  assert.equal(validateFieldValue({ ...base, type: "date" }, "2026-12-01").error, "");
});
test("option mapping only accepts exact values or unambiguous labels", () => {
  const f = { kind: "select", options: [{ value: "", label: "Choose" }, { value: "full", label: "Full time" }, { value: "part", label: "Part time" }] };
  assert.equal(validateFieldValue(f, "Full time").value, "full");
  assert.equal(validateFieldValue(f, "full").value, "full");
  assert.equal(validateFieldValue(f, "Unknown").value, null);
  assert.equal(validateFieldValue(f, "").value, null);
  assert.equal(validateFieldValue({ ...f, kind: "select-multiple" }, ["full", "Part time"]).value.join(), "full,part");
  assert.ok(validateFieldValue({ ...f, kind: "select-multiple" }, ["unknown"]).error);
});
test("checkboxes require a boolean; code objects are not treated as values", () => {
  assert.equal(validateFieldValue({ kind: "checkbox" }, true).value, true);
  assert.equal(validateFieldValue({ kind: "checkbox" }, false).value, false);
  assert.equal(validateFieldValue({ kind: "checkbox" }, "yes").value, null);
  assert.equal(validateFieldValue({ kind: "text" }, { script: "malicious" }).value, null);
});
test("vault encrypts and authenticates data; wrong passphrase fails", async () => {
  const key = await createVaultKey("fictional-test-passphrase");
  const data = demoVault(); data.settings.apiKey = "TEST_KEY_NOT_REAL";
  const envelope = await sealVault(data, key);
  assert.doesNotMatch(JSON.stringify(envelope), /Jordan|TEST_KEY_NOT_REAL/);
  const opened = await openVault(envelope, "fictional-test-passphrase");
  assert.deepEqual(opened.value, data);
  await assert.rejects(openVault(envelope, "wrong-passphrase"), /incorrect/);
  const bytes = Buffer.from(envelope.data, "base64"); bytes[0] ^= 1;
  await assert.rejects(openVault({ ...envelope, data: bytes.toString("base64") }, "fictional-test-passphrase"), /damaged/);
});
test("fresh random IVs prevent equal ciphertext and KDF budget is bounded", async () => {
  const key = await createVaultKey("fictional-test-passphrase");
  const a = await sealVault({ x: 1 }, key), b = await sealVault({ x: 1 }, key);
  assert.notEqual(a.iv, b.iv); assert.notEqual(a.data, b.data);
  await assert.rejects(createVaultKey("short"), /12 characters/);
  await assert.rejects(openVault({ ...a, iterations: 999999999 }, "x"), /Unsupported/);
});

test("existing-chat handoff needs no local resume and does not send saved answers", () => {
  const s = demoScan(), v = newVault();
  v.savedAnswers.push({ id: "a", question: "Do you require sponsorship?", answer: "PRIVATE_SAVED_STATEMENT" });
  const p = buildPrompt(s, v, { useChatContext: true });
  assert.equal(p.sources.length, 0);
  assert.match(p.prompt, /already uploaded or discussed here/);
  assert.match(p.prompt, /chat-context/);
  assert.doesNotMatch(p.prompt, /PRIVATE_SAVED_STATEMENT/);
  assert.ok(p.fields.every(f => !s.fields.find(x => x.id === f.id).userAnswerOnly));
  assert.throws(() => buildPrompt(s, v), /direct API/);
});
test("AI cannot supply user-only eligibility answers even with a matching quotation", () => {
  const s = demoScan(), v = demoVault();
  const f = s.fields.find(f => f.userAnswerKind === "work-authorization");
  const out = reviewAnswers({ scanId: s.scanId, answers: [{ fieldId: f.id, value: "Yes", source_id: "sample-resume", quote: "Jordan Avery" }] }, s, v).find(r => r.fieldId === f.id);
  assert.equal(out.value, null);
  assert.match(out.error, /Your own answer/);
});
test("existing-chat evidence stays visibly unverified and unapproved", () => {
  const s = demoScan(), v = newVault();
  const [out] = reviewAnswers({ scanId: s.scanId, answers: [{ fieldId: s.fields[0].id, value: "Fictional Person", source_id: "chat-context", quote: "Fictional Person" }] }, s, v);
  assert.equal(out.value, "Fictional Person");
  assert.equal(out.matched, false);
  assert.equal(out.approved, false);
  assert.equal(out.sourceType, "chat");
  assert.match(out.sourceName, /not locally verified/);
});
test("question matching is punctuation-insensitive but not semantic guessing", () => {
  assert.equal(normalizeQuestion("1. Are you 18 years of age or older? *"), normalizeQuestion("ARE YOU 18 YEARS OF AGE OR OLDER"));
  const f = { label: "Do you require sponsorship?", section: "Questions" };
  const bank = [{ question: "Do you require sponsorship?", answer: "No", origin: "", section: "" }];
  assert.equal(matchingSavedAnswer(f, bank, "https://example.com").answer, "No");
  assert.equal(matchingSavedAnswer({ ...f, label: "Are you authorized to work?" }, bank, "https://example.com"), null);
  assert.equal(matchingSavedAnswer({ ...f, label: "Do you NOT require sponsorship?" }, bank, "https://example.com"), null);
});
test("saved answers respect site and repeated-entry scopes and fail closed on conflicts", () => {
  const f = { label: "May we contact this employer?", section: "Work experience 2" };
  const general = { id: "global", question: f.label, answer: "No", origin: "", section: "" };
  const specific = { id: "scoped", question: f.label, answer: "Yes", origin: "https://employer.example", section: f.section };
  assert.equal(matchingSavedAnswer(f, [general, specific], "https://employer.example").id, "scoped");
  assert.equal(matchingSavedAnswer({ ...f, section: "Work experience 1" }, [general, specific], "https://employer.example").id, "global");
  assert.equal(matchingSavedAnswer(f, [specific], "https://different.example"), null);
  assert.equal(matchingSavedAnswer(f, [general, { ...general, id: "conflict", answer: "Yes" }], "https://employer.example").conflict, true);
});
test("saved answers are user-supplied but require new approval on every application", () => {
  const s = demoScan(), v = newVault();
  const f = s.fields.find(f => f.userAnswerKind === "sponsorship");
  v.savedAnswers.push({ id: "saved-test", question: f.label, answer: "No", origin: s.origin, section: f.section });
  let rows = applySavedAnswers(s, v);
  let row = rows.find(r => r.fieldId === f.id);
  assert.equal(row.value, "No");
  assert.equal(row.trustedUser, true);
  assert.equal(row.approved, false);
  row.approved = true;
  assert.equal(applySavedAnswers(s, v, rows).find(r => r.fieldId === f.id).approved, false);
});
test("eligibility and employer-permission questions are distinguished from resume facts", () => {
  assert.equal(userAnswerKind("Are you 18 years of age or older?"), "age-eligibility");
  assert.equal(userAnswerKind("Are you legally authorized to work in the United States?"), "work-authorization");
  assert.equal(userAnswerKind("Will you require sponsorship for employment?"), "sponsorship");
  assert.equal(userAnswerKind("Have you previously worked for Example Company?"), "previous-employer");
  assert.equal(userAnswerKind("May we contact this employer?"), "employer-contact");
  for (const label of ["Job title", "Employer name", "Supervisor phone number", "School or university", "From / Month"]) assert.equal(userAnswerKind(label), "");
});
test("custom dropdown labels must match scanned options and never fuzzy-match", () => {
  const f = { kind: "custom-select", options: [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }] };
  assert.equal(validateFieldValue(f, " yes ").value, "Yes");
  assert.ok(validateFieldValue(f, "Probably yes").error);
  assert.ok(validateFieldValue(f, { click: "#submit" }).error);
  assert.equal(validateFieldValue({ kind: "custom-select", options: [] }, "No").value, "No");
});
