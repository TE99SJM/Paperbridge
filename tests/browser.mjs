const { default: assert } = await import("node:assert/strict");
const { default: fs } = await import("node:fs/promises");
const { default: path } = await import("node:path");
const { default: http } = await import("node:http");
const { fileURLToPath, pathToFileURL } = await import("node:url");
const { chromium } = await import("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const passphrase = "fictional-test-passphrase";
const wait = async (page, expression) => page.waitForFunction(expression, null, { timeout: 10000 });
const click = async (p, action) => p.locator(`[data-action="${action}"]`).click();
const nav = async (p, view) => p.locator(`nav [data-view="${view}"]`).click();
function card(p, label, index = 0) {
  return p.locator(".answer").filter({ has: p.locator(".answer-label").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }) }).nth(index);
}
async function edit(p, label, value, index = 0) {
  const c = card(p, label, index), control = c.locator("[data-edit]");
  if (await control.evaluate(el => el.tagName === "SELECT")) await control.selectOption(value);
  else await control.fill(value);
  assert.equal(await c.locator("[data-approve]").isChecked(), false, "An edit must revoke approval.");
  await c.locator("[data-approve]").check();
}
async function confirmFill(p) {
  await click(p, "fill");
  assert.equal(await p.locator("dialog").isVisible(), true);
  await p.locator("dialog input[type=checkbox]").check();
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector(".busy-bar") && !document.querySelector("dialog").open);
}
async function undo(p) {
  await click(p, "undo");
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector(".busy-bar") && !document.querySelector("dialog").open);
}
async function scan(p) {
  await click(p, "scan");
  await p.locator(".table-wrap").waitFor();
  await wait(p, () => !document.querySelector(".busy-bar"));
}
async function prepare(p) {
  await click(p, "draft");
  const prompt = await p.locator("#exact-prompt").inputValue();
  const payload = JSON.parse(prompt.split("BEGIN_UNTRUSTED_FORM_DATA_JSON\n")[1].split("\nEND_UNTRUSTED_FORM_DATA_JSON")[0]);
  assert.equal(await p.locator('dialog [name="openChat"]').isChecked(), false);
  await p.locator('dialog [name="consent"]').check();
  await p.locator("dialog button[type=submit]").click();
  await p.locator("#answer-paste").waitFor();
  return { prompt, payload };
}

export async function createHarness() {
  await fs.mkdir(path.join(root, "qa"), { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, "qa", "browser-"));
  const extDir = path.join(dir, "extension");
  await fs.cp(path.join(root, "extension"), extDir, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(extDir, "manifest.json"), "utf8"));
  // Test harness only. Never package this copy or its localhost permission.
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await fs.writeFile(path.join(extDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) || !["GET", "HEAD"].includes(req.method)) throw new Error("Not found");
      const data = await fs.readFile(file);
      const type = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" }[path.extname(file)] || "text/plain";
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(data);
    } catch { res.writeHead(404); res.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ctx = await chromium.launchPersistentContext(path.join(dir, "profile"), {
    headless: true, channel: "chromium", viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
    acceptDownloads: true
  });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const errors = [], externalRequests = [], passed = [];
  ctx.on("page", p => {
    p.on("pageerror", error => errors.push(error.message));
    p.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  });
  ctx.on("request", req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) externalRequests.push(req.url()); });
  const form = await ctx.newPage(), app = await ctx.newPage();
  await app.goto(`chrome-extension://${id}/index.html`);
  const h = { dir, root, base, ctx, sw, id, form, app, errors, externalRequests, passed };
  h.record = name => { passed.push(name); console.log("PASS", name); };
  h.target = async filename => {
    await form.goto(`${base}/examples/${filename}`);
    await sw.evaluate(async url => {
      const tab = (await chrome.tabs.query({})).find(t => t.url === url);
      if (!tab) throw new Error("Practice tab missing");
      await chrome.storage.session.set({ target: { tabId: tab.id, origin: new URL(url).origin, title: tab.title } });
      await chrome.runtime.sendMessage({ type: "paperbridge-target-changed" });
    }, form.url());
    await app.bringToFront();
    await app.locator('[data-action="scan"]').waitFor();
  };
  h.close = async () => { await ctx.close(); await new Promise(resolve => server.close(resolve)); };
  return h;
}

export async function nativeFlow(h) {
  const { app: p, form } = h;
  await p.locator("#vault-password").fill(passphrase);
  await p.locator("#vault-confirm").fill(passphrase);
  await p.locator("#unlock-form button[type=submit]").click();
  await p.locator("nav").waitFor();
  assert.equal(await p.locator('nav [aria-current="page"]').getAttribute("data-view"), "page");
  h.record("new encrypted workspace opens on Application");
  await h.target("practice-application.html");
  await scan(p);
  assert.equal(await p.locator("tbody tr").count(), 15);
  assert.equal(await p.getByText("Manual only", { exact: true }).count(), 5);
  const { prompt, payload } = await prepare(p);
  assert.equal(payload.sources.length, 0);
  assert.match(prompt, /already uploaded or discussed here/);
  assert.doesNotMatch(prompt, /Keep this existing answer/);
  h.record("existing-chat prompt works without local documents and omits page values");
  await p.locator("#answer-paste").fill(JSON.stringify({ scanId: payload.scanId, answers: [{ fieldId: "unknown", value: "x" }] }));
  await click(p, "import-answer");
  await wait(p, () => document.querySelector("#toast").textContent.includes("unknown field"));
  const values = { "Full name": "Jordan Avery", "Email address": "bad-email", "Phone number": "608-555-0148", "City and state": "Madison, Wisconsin", "Position of interest": "operations", "Describe your relevant experience": "Fictional operations and scheduling experience.", "Desired annual salary": "55000", "Preferred start date": "2026-12-01", "Availability": "full", "Remote work preferred": true };
  const data = { scanId: payload.scanId, answers: payload.fields.map(f => ({ fieldId: f.id, value: values[f.label], source_id: "chat-context", quote: String(values[f.label]), reason: "Synthetic chat reply for testing." })) };
  await p.locator("#answer-paste").fill(JSON.stringify(data));
  await click(p, "import-answer");
  assert.equal(await p.locator("#fill-button").isDisabled(), true);
  assert.equal(await card(p, "Email address").locator("[data-approve]").isDisabled(), true);
  assert.equal(await card(p, "Full name").getByText("Chat: not verified locally", { exact: true }).count(), 1);
  await edit(p, "Email address", "jordan.avery@example.com");
  for (const label of Object.keys(values).filter(v => v !== "Email address")) await card(p, label).locator("[data-approve]").check();
  await confirmFill(p);
  assert.equal(await form.locator("#fullName").inputValue(), "Jordan Avery");
  assert.equal(await form.locator("#email").inputValue(), "jordan.avery@example.com");
  assert.equal(await form.locator("#position").inputValue(), "operations");
  assert.equal(await form.locator("#city").inputValue(), "Keep this existing answer");
  assert.equal(await form.locator("#remote").isChecked(), true);
  assert.equal(await form.locator('input[name=availability]:checked').inputValue(), "full");
  for (const id of ["ssn", "password", "signature", "resume"]) assert.equal(await form.locator("#" + id).inputValue(), "");
  assert.equal(await form.locator("#consent").isChecked(), false);
  assert.doesNotMatch(await form.locator("#events").textContent(), /SUBMIT/);
  assert.match(await card(p, "City and state").locator(".field-result").textContent(), /Already filled/);
  h.record("native UI fill requires approval, rejects invalid AI values, preserves existing answers and manual fields");
  await form.locator("#phone").fill("608-555-0199");
  await undo(p);
  assert.equal(await form.locator("#fullName").inputValue(), "");
  assert.equal(await form.locator("#position").inputValue(), "");
  assert.equal(await form.locator("#remote").isChecked(), false);
  assert.equal(await form.locator("#phone").inputValue(), "608-555-0199");
  assert.match(await card(p, "Phone number").locator(".field-result").textContent(), /left untouched/);
  assert.match(await card(p, "Availability").locator(".field-result").textContent(), /no selection/);
  h.record("undo restores unchanged inputs, preserves later edits, reports unselectable radio groups");
  await nav(p, "page"); await scan(p); await nav(p, "review");
  await edit(p, "City and state", "Madison, Wisconsin");
  await p.locator("#overwrite").check(); await confirmFill(p);
  assert.equal(await form.locator("#city").inputValue(), "Madison, Wisconsin");
  await undo(p);
  assert.equal(await form.locator("#city").inputValue(), "Keep this existing answer");
  await nav(p, "page"); await scan(p); await nav(p, "review");
  await edit(p, "Full name", "Must not be written");
  await form.locator("#fullName").evaluate(el => el.setAttribute("name", "changed-identity"));
  await confirmFill(p);
  assert.equal(await form.locator("#fullName").inputValue(), "");
  assert.match(await card(p, "Full name").locator(".field-result").textContent(), /changed since the scan/);
  h.record("explicit overwrite and stale DOM identity guards work through UI");
}

export async function workdayFlow(h) {
  const { app: p, form } = h;
  await h.target("workday-style-practice.html"); await scan(p);
  assert.equal(await form.locator(".dropdown-portal").count(), 0);
  await click(p, "inspect-dropdowns");
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector(".busy-bar") && !document.querySelector("dialog").open);
  assert.equal(await form.locator(".dropdown-portal").count(), 0);
  assert.equal(await p.getByText("2 choices read", { exact: true }).count(), 4);
  assert.match(await p.locator("tbody").textContent(), /From \/ Month/);
  assert.match(await p.locator("tbody").textContent(), /Work experience 2/);
  assert.match(await p.locator("tbody").textContent(), /Education 2/);
  await nav(p, "review");
  const auth = "Are you legally authorized to work in the United States?";
  assert.equal(await card(p, auth).locator("[data-edit]").inputValue(), "");
  assert.equal(await card(p, auth).locator("[data-approve]").isDisabled(), true);
  await edit(p, auth, "Yes");
  await card(p, auth).locator("[data-save-answer]").click();
  assert.equal(await p.locator("#saved-origin").inputValue(), h.base);
  await p.locator("dialog input[type=checkbox]").check();
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector("dialog").open);
  assert.equal(await card(p, auth).locator("[data-approve]").isChecked(), false);
  assert.equal(await card(p, auth).getByText("Your saved answer", { exact: true }).count(), 1);
  h.record("user-only questions start blank and saved reuse revokes previous approval");
  await nav(p, "saved");
  await p.locator("[data-saved-edit]").click();
  await p.locator("#saved-value").fill("No");
  await p.locator("dialog input[type=checkbox]").check();
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector("dialog").open);
  assert.equal(await p.locator(".saved-value").textContent(), "No");
  await p.locator("[data-saved-delete]").click();
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector("dialog").open);
  await p.locator("[data-template='0']").click();
  assert.equal(await p.locator("#saved-value").inputValue(), "");
  await p.locator("[data-close-dialog]").last().click();
  h.record("saved-answer add, edit, delete and blank templates work");
  await nav(p, "review");
  const changes = [
    ["Are you 18 years of age or older?", "Yes"], [auth, "Yes"],
    ["Do you now have or will you in the future require sponsorship for authorization to work in the United States?", "no"],
    ["Have you previously worked for Fictional Workshop?", "No"],
    ["Employer", "Northline Workshop", 0], ["Job title", "Operations Coordinator", 0],
    ["From / Month", "1", 0], ["From / Year", "2022", 0],
    ["May we contact this employer?", "no", 0],
    ["Employer", "Fictional Former Employer", 1], ["May we contact this employer?", "yes", 1],
    ["School or university", "Lakeside Technical College", 0],
    ["Degree", "Associate of Applied Science"], ["Graduation year", "2021", 0],
    ["School or university", "Fictional Second School", 1]
  ];
  for (const args of changes) await edit(p, ...args);
  await confirmFill(p);
  assert.equal(await p.locator(".field-result.fail").count(), 0, await p.locator(".field-result.fail").allTextContents());
  assert.equal(await form.locator("#age-choice").textContent(), "Yes");
  assert.equal(await form.locator("#authorization-choice").textContent(), "Yes");
  assert.equal(await form.locator("#sponsorship-choice").inputValue(), "no");
  assert.equal(await form.locator("#previous-choice").textContent(), "No");
  assert.equal(await form.locator("#job1-employer").inputValue(), "Northline Workshop");
  assert.equal(await form.locator("#job2-employer").inputValue(), "Fictional Former Employer");
  assert.equal(await form.locator("#job1-from-month").inputValue(), "1");
  assert.equal(await form.locator("#job1-from-year").inputValue(), "2022");
  assert.equal(await form.locator('input[name=contact1]:checked').inputValue(), "no");
  assert.equal(await form.locator('input[name=contact2]:checked').inputValue(), "yes");
  assert.equal(await form.locator("#school2").inputValue(), "Fictional Second School");
  assert.equal(await form.locator("#degree-choice").textContent(), "Associate of Applied Science");
  assert.equal(await form.locator("#major-search").inputValue(), "");
  assert.equal(await form.locator("#signature").inputValue(), "");
  assert.equal(await form.locator("#certify").isChecked(), false);
  const actions = await form.evaluate(() => ({ ...window.practiceActions, changes: undefined }));
  for (const action of ["submit", "next", "add", "decoy"]) assert.equal(actions[action], 0, `${action} must never be clicked`);
  h.record("portal dropdowns, inner option targets, repeated jobs/schools and month/year fields fill without navigation or unrelated-menu clicks");
  await undo(p);
  for (const id of ["age-choice", "authorization-choice", "previous-choice", "degree-choice"]) assert.equal(await form.locator("#" + id).textContent(), "Select One");
  assert.equal(await form.locator("#school1").inputValue(), "");
  h.record("custom dropdown undo restores the original empty choice");
}

export async function reactFlow(h) {
  const { app: p, form } = h;
  await h.target("react-practice.html");
  await form.locator("#react-name").waitFor();
  await scan(p); await nav(p, "review");
  for (const args of [["Full name", "Fictional React"], ["Position of interest", "operations"], ["Remote work preferred", "true"], ["Availability", "full"]]) await edit(p, ...args);
  await confirmFill(p);
  assert.deepEqual(JSON.parse(await form.locator("#react-state").textContent()), { name: "Fictional React", choice: "operations", remote: true, availability: "full", submits: 0 });
  await undo(p);
  assert.deepEqual(JSON.parse(await form.locator("#react-state").textContent()), { name: "", choice: "", remote: false, availability: "full", submits: 0 });
  await form.locator('input[value=part]').check();
  await nav(p, "page"); await scan(p); await nav(p, "review");
  await edit(p, "Availability", "full"); await p.locator("#overwrite").check(); await confirmFill(p); await undo(p);
  assert.equal(JSON.parse(await form.locator("#react-state").textContent()).availability, "part");
  h.record("real React-controlled text, select, checkbox and radio state accepts fills; safe undo updates React state");
}

export async function workspaceFlow(h) {
  const { app: p } = h;
  await nav(p, "documents");
  await p.locator("#document-files").setInputFiles(path.join(root, "examples", "fictional-resume.txt"));
  await wait(p, () => !!document.querySelector(".doc-row") && !document.querySelector(".busy-bar"));
  await p.locator("[data-doc-view]").click();
  assert.match(await p.locator("dialog pre").textContent(), /Jordan Avery/);
  await p.locator("[data-close-dialog]").last().click();
  await p.locator("[data-doc-toggle]").uncheck(); await wait(p, () => !document.querySelector("[data-doc-toggle]").checked);
  await p.locator("[data-doc-toggle]").check();
  await p.locator("#personal-notes").fill("Fictional local background only.");
  await nav(p, "connection");
  await p.locator('[data-mode="api"]').click();
  await p.locator("#api-key").fill("SYNTHETIC_KEY_NOT_REAL");
  await p.locator("#api-provider").selectOption("custom");
  assert.equal(await p.locator("#api-key").inputValue(), "");
  await p.locator("#api-key").fill("SYNTHETIC_KEY_NOT_REAL");
  await p.locator("#api-base").fill("https://example.invalid/v1");
  assert.equal(await p.locator("#api-key").inputValue(), "");
  await p.locator("#api-model").fill("fictional-model");
  await click(p, "save-settings");
  await p.locator('[data-mode="chatgpt"]').click();
  assert.equal(await p.locator('[data-mode="chatgpt"]').getAttribute("aria-pressed"), "true");
  await p.locator('[data-mode="manual"]').click();
  await p.locator("#chat-site").selectOption("other");
  await p.locator("#chat-url").fill("https://example.invalid/chat");
  await p.locator("#chat-site").selectOption("chatgpt");
  await p.locator('[data-setting="useChatContext"]').uncheck();
  await p.locator('[data-setting="useChatContext"]').check();
  h.record("optional TXT import, document selection, notes and provider switching work; changing provider/base clears keys");
  const downloaded = p.waitForEvent("download");
  await click(p, "backup");
  const backup = await downloaded, backupPath = path.join(h.dir, "synthetic-backup.json");
  await backup.saveAs(backupPath);
  const data = await fs.readFile(backupPath, "utf8");
  assert.doesNotMatch(data, /Jordan|SYNTHETIC_KEY|Fictional local background/);
  const storage = await p.evaluate(() => chrome.storage.local.get(null));
  assert.doesNotMatch(JSON.stringify(storage), /Jordan|SYNTHETIC_KEY|Fictional local background/);
  await p.locator('.topbar [data-action="lock"]').click();
  await p.locator("#vault-password").fill("wrong-passphrase");
  await p.locator("#unlock-form button[type=submit]").click();
  await wait(p, () => document.querySelector("#toast").textContent.includes("incorrect"));
  await p.locator("#vault-password").fill(passphrase);
  await p.locator("#unlock-form button[type=submit]").click(); await p.locator("nav").waitFor();
  await nav(p, "documents");
  assert.equal(await p.locator(".doc-row").count(), 1);
  assert.equal(await p.locator("#personal-notes").inputValue(), "Fictional local background only.");
  await p.locator("[data-doc-delete]").click();
  await p.locator("dialog button[type=submit]").click(); await wait(p, () => !document.querySelector("dialog").open);
  assert.equal(await p.locator(".doc-row").count(), 0);
  await p.locator('.topbar [data-action="lock"]').click();
  await click(p, "reset-vault"); await p.locator("dialog input").fill("DELETE"); await p.locator("dialog button[type=submit]").click();
  await p.locator("#vault-confirm").waitFor();
  await p.locator("#backup-file").setInputFiles(backupPath);
  await p.locator("#restore-pass").fill(passphrase);
  await p.locator("dialog input[type=checkbox]").check(); await p.locator("dialog button[type=submit]").click();
  await p.locator("nav").waitFor(); await nav(p, "documents");
  assert.equal(await p.locator(".doc-row").count(), 1);
  assert.equal(await p.locator("#personal-notes").inputValue(), "Fictional local background only.");
  h.record("encrypted backup, lock, wrong-passphrase rejection, unlock, delete and verified restore work");
}

export async function safetyFlow(h) {
  const { app: p, form } = h;
  await h.target("../tests/fixtures/safety-practice.html");
  await form.locator("#shadow-note").waitFor();
  await scan(p);
  const text = await p.locator("tbody").textContent();
  assert.doesNotMatch(text, /Hidden note|Locked note|Choose action/);
  assert.match(text, /Frame note/);
  assert.match(text, /Shadow note/);
  assert.match(await p.locator(".notice.warn").textContent(), /1 embedded frame/);
  await click(p, "inspect-dropdowns");
  await p.locator("dialog button[type=submit]").click();
  await wait(p, () => !document.querySelector(".busy-bar") && !document.querySelector("dialog").open);
  await nav(p, "review");
  assert.equal(await card(p, "Category").locator("[data-edit]").count(), 0);
  assert.equal(await card(p, "Ambiguous native choice").locator("[data-edit]").count(), 0);
  await edit(p, "Frame note", "Fictional frame value");
  await edit(p, "Shadow note", "Fictional shadow value");
  await confirmFill(p);
  assert.equal(await form.frameLocator("#same-frame").locator("#frame-note").inputValue(), "Fictional frame value");
  assert.equal(await form.locator("#shadow-note").inputValue(), "Fictional shadow value");
  assert.equal(await form.locator("#actions").textContent(), "0");
  assert.equal(await form.locator("#category").textContent(), "Select One");
  assert.equal(await form.locator("#hidden-note").inputValue(), "Keep hidden");
  h.record("same-origin frames and open shadows work; protected frames, hidden/read-only fields, ambiguous options and sensitive dropdown choices stay manual");
}

export async function previewFlow(h) {
  const p = await h.ctx.newPage();
  await p.goto(`${h.base}/preview/index.html`);
  await p.locator("[data-action=scan]").waitFor();
  await p.screenshot({ path: path.join(h.dir, "preview-start-desktop.png") });
  await scan(p); await click(p, "draft");
  assert.equal(await p.evaluate(() => scrollY), 0, "Changing section must return to the heading");
  await click(p, "select-grounded");
  assert.equal(await p.locator("#approved-count").textContent(), "10 answers approved");
  await confirmFill(p);
  assert.match(await p.locator(".field-result").first().textContent(), /Demo/);
  await undo(p);
  await p.locator("#toast").waitFor({ state: "hidden", timeout: 15000 });
  for (const [width, height] of [[1280, 900], [375, 812], [1280, 540]]) {
    await p.setViewportSize({ width, height });
    for (const view of ["page", "review", "saved", "connection", "documents"]) {
      await nav(p, view);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow at ${width}px in ${view}`);
      assert.equal(await p.evaluate(() => scrollY), 0);
      await p.screenshot({ path: path.join(h.dir, `preview-${view}-${width}x${height}.png`) });
    }
  }
  await nav(p, "connection");
  await p.locator("[data-mode=api]").click();
  assert.equal(await p.locator("#api-key").isDisabled(), true);
  await p.locator("[data-mode=chatgpt]").click();
  assert.equal(await p.locator("[data-action=signin]").isDisabled(), true);
  await p.locator("[data-mode=manual]").click();
  await click(p, "open-chat");
  await wait(p, () => document.querySelector("#toast").textContent.includes("Install the extension"));
  await nav(p, "saved"); await p.locator("[data-template='0']").click();
  assert.equal(await p.locator("#saved-value").inputValue(), "");
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("dialog").isVisible(), false);
  await p.close();
  h.record("fictional preview supports scan/draft/approve/simulated-fill/undo and five views at desktop, 375px and short-window sizes");
}

export async function finish(h) {
  assert.deepEqual(h.errors, [], "No new browser errors");
  assert.deepEqual(h.externalRequests, [], "Test flows must not call real providers");
  const report = { at: new Date().toISOString(), browser: h.ctx.browser()?.version() || "Chromium persistent context", checks: [...new Set(h.passed)], browserErrors: h.errors, providerRequests: h.externalRequests, limitations: ["QA-only localhost permission replaces toolbar activeTab grant in headless testing.", "No actual Opera GX, live Workday tenant, authenticated OAuth, or paid AI invocation."] };
  await fs.writeFile(path.join(root, "qa", "browser-results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (typeof process !== "undefined" && process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  let h;
  try {
    h = await createHarness();
    await nativeFlow(h); await workdayFlow(h); await reactFlow(h); await workspaceFlow(h); await safetyFlow(h); await previewFlow(h); await finish(h);
  } catch (err) {
    if (h) {
      await h.app.screenshot({ path: path.join(h.dir, "failure.png"), fullPage: true }).catch(() => {});
      console.error("QA failure artifacts:", h.dir);
    }
    console.error(err); process.exitCode = 1;
  } finally { if (h) await h.close(); }
}
