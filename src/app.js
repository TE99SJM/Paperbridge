import { createIcons, FileText, FolderOpen, ScanLine, ListChecks, SlidersHorizontal, LockKeyhole, ShieldCheck, Upload, Plus, Eye, Trash2, ArrowRight, ArrowUpRight, ChevronRight, Check, CheckCheck, CircleHelp, Globe, RefreshCw, Undo2, ExternalLink, Copy, X, KeyRound, Laptop, MessageSquare, Link, LogOut, Download, SquarePen, CircleAlert, CheckCircle2, PanelLeftClose } from "lucide";
import { VERSION, DEFAULT_SETTINGS, PROVIDERS, CHAT_SITES, newVault, buildPrompt, reviewAnswers, applySavedAnswers, validateFieldValue, safeBaseUrl, safeChatUrl, permissionOrigin, friendlyError } from "./core.js";
import { QUESTION_TEMPLATES, normalizeQuestion } from "./answers.js";
import { createVaultKey, sealVault, openVault } from "./vault.js";
import { extractDocument } from "./documents.js";
import { callProvider, listModels } from "./providers.js";
import { exchangeWithChat, automaticRows } from "./chat-bridge.js";
import { demoVault, demoScan, demoAnswer } from "./demo.js";

const icons = { FileText, FolderOpen, ScanLine, ListChecks, SlidersHorizontal, LockKeyhole, ShieldCheck, Upload, Plus, Eye, Trash2, ArrowRight, ArrowUpRight, ChevronRight, Check, CheckCheck, CircleHelp, Globe, RefreshCw, Undo2, ExternalLink, Copy, X, KeyRound, Laptop, MessageSquare, Link, LogOut, Download, SquarePen, CircleAlert, CheckCircle2, PanelLeftClose };
const isExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;
const preview = !isExtension;
const app = document.getElementById("app"), dialog = document.getElementById("dialog");
let vault = null, keyInfo = null, storedBlob = null, target = null;
let view = "page", scan = null, answers = [], prepared = null, answerContext = null;
let modelChoices = [], helperInfo = null, replyText = "", results = [], undoCount = 0;
let busy = false, busyText = "", controller = null, saving = false, saveError = false, pendingSave = false, saveJobs = 0;
let saveQueue = Promise.resolve(), saveTimer, toastTimer;
let renderedView = null;
let lastActivity = Date.now();
const e = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ico = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const fmt = n => new Intl.NumberFormat("en-US").format(n);
const selectedDocs = () => vault?.documents.filter(d => d.include !== false) || [];
const approvedRows = () => answers.filter(a => a.approved && !a.error && a.value !== null);
const modeLabel = () => vault?.settings.mode === "chatgpt" ? "ChatGPT account" : vault?.settings.mode === "api" ? (PROVIDERS[vault.settings.provider]?.name || "API provider") : (CHAT_SITES[vault?.settings.chatSite]?.name || "AI website");
function refreshIcons() { createIcons({ icons, attrs: { "stroke-width": 1.7 } }); }
function notify(message, error = false) {
  const el = document.getElementById("toast");
  clearTimeout(toastTimer);
  el.textContent = message; el.className = "toast" + (error ? " error" : ""); el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 14000 : 6500);
}
function updateSaveLabel() {
  const el = document.getElementById("save-state");
  if (el) el.textContent = preview ? "Demo · memory only" : saveError ? "Not saved" : saving || pendingSave ? "Encrypting changes…" : "Encrypted locally";
}
async function persist() {
  if (!vault || preview) return;
  clearTimeout(saveTimer); pendingSave = false; saveJobs++;
  const snapshot = structuredClone(vault), keys = keyInfo;
  saving = true; saveError = false; updateSaveLabel();
  const next = saveQueue.catch(() => {}).then(async () => {
    const blob = await sealVault(snapshot, keys);
    if (JSON.stringify(blob).length > 9000000) throw new Error("Your encrypted vault is near the browser storage limit. Remove documents you no longer need, then try saving again.");
    await chrome.storage.local.set({ paperbridgeVault: blob });
    storedBlob = blob;
  });
  saveQueue = next;
  try { await next; } catch (err) { saveError = true; throw err; }
  finally { saveJobs--; saving = saveJobs > 0; updateSaveLabel(); }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  pendingSave = !preview; updateSaveLabel();
  saveTimer = setTimeout(() => persist().catch(err => notify(friendlyError(err), true)), 600);
}
function invalidateDraft() {
  answers = scan && vault ? applySavedAnswers(scan, vault) : [];
  prepared = null; answerContext = null; replyText = ""; results = [];
}
function modal(title, body, confirmLabel, onConfirm, { cancelLabel = "Cancel" } = {}) {
  dialog.innerHTML = `<form id="dialog-form"><div class="dialog-heading"><h2 id="dialog-title">${e(title)}</h2><button type="button" class="ghost icon-only" data-close-dialog aria-label="Close dialog">${ico("x")}</button></div><div class="dialog-body">${body}</div><div class="dialog-actions"><button type="button" data-close-dialog>${e(cancelLabel)}</button>${confirmLabel ? `<button type="submit" class="primary">${e(confirmLabel)}</button>` : ""}</div></form>`;
  dialog.querySelectorAll("[data-close-dialog]").forEach(b => b.addEventListener("click", () => dialog.close()));
  dialog.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const form = ev.currentTarget;
    if (!form.reportValidity()) return;
    try { await onConfirm?.(form); } catch (err) { notify(friendlyError(err), true); }
  });
  refreshIcons();
  dialog.showModal();
}
async function task(fn, label, cancellable = false) {
  if (busy) return;
  busy = true; busyText = label;
  controller = cancellable ? new AbortController() : null;
  render();
  try { return await fn(controller?.signal); }
  catch (err) { notify(friendlyError(err), true); return null; }
  finally { busy = false; busyText = ""; controller = null; render(); }
}
function progress(message) {
  busyText = message;
  const el = document.getElementById("busy-text"); if (el) el.textContent = message;
}
function resetPage() {
  controller?.abort();
  scan = null; invalidateDraft(); undoCount = 0; results = [];
}
async function getTarget() {
  if (preview) return;
  const data = await chrome.storage.session.get("target");
  target = data.target || null;
}
async function engine(method, payload) {
  if (preview) {
    if (method === "scan") return demoScan();
    if (method === "fill") return { results: payload.answers.map(a => ({ fieldId: a.fieldId, ok: true })), undoCount: payload.answers.length };
    if (method === "undo") return { results: results.filter(r => r.ok).map(r => ({ ...r })) };
    return true;
  }
  if (!target?.tabId) throw new Error("Open an ordinary application webpage, then click the Paperbridge toolbar icon on that page.");
  let tab;
  try { tab = await chrome.tabs.get(target.tabId); } catch { throw new Error("The application tab was closed. Reopen the page and click the toolbar icon."); }
  if (!tab.url || new URL(tab.url).origin !== target.origin) throw new Error("The page changed sites or the permission expired. Click Paperbridge on the application page again.");
  try {
    await chrome.scripting.executeScript({ target: { tabId: target.tabId }, files: ["scanner.js"] });
    const response = await chrome.scripting.executeScript({
      target: { tabId: target.tabId },
      func: (action, data) => {
        if (!["scan", "fill", "undo", "locate"].includes(action) || !globalThis.__paperbridgeEngine) throw new Error("Page engine unavailable.");
        return globalThis.__paperbridgeEngine[action](data);
      }, args: [method, payload ?? null]
    });
    if (!response?.[0]?.result) throw new Error("The page did not respond. Rescan it.");
    return response[0].result;
  } catch (err) {
    if (/Cannot access|Missing host|extensions gallery|cannot be scripted/i.test(err.message)) throw new Error("Browser settings, extension stores, built-in PDF viewers, and some protected pages cannot be filled. Open the site's regular web form, then click the toolbar icon again.");
    throw err;
  }
}
async function focusTarget() {
  if (preview || !target?.tabId) return;
  const tab = await chrome.tabs.update(target.tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}
async function allowHost(url) {
  if (preview) throw new Error("Install the extension to connect an AI provider. Do not enter credentials in this preview.");
  const origin = permissionOrigin(url);
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error("The host permission was not granted. No data was sent.");
}
async function helper(route, body, signal) {
  if (preview) throw new Error("ChatGPT sign-in is available in the installed extension, not this demo.");
  const token = vault.settings.helperToken.trim();
  if (!token) throw new Error("Start the helper and paste its pairing code in AI connection.");
  const res = await fetch(`http://127.0.0.1:47821${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json", "X-Paperbridge-Token": token,
      "X-Paperbridge-Origin": chrome.runtime.getURL("").replace(/\/$/, "")
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "omit", redirect: "error",
    signal: signal || AbortSignal.timeout(45000)
  });
  let data;
  try { data = await res.json(); } catch { throw new Error("The local helper returned an unreadable response. Confirm the correct helper is running on port 47821."); }
  if (!res.ok) throw new Error(data.error || `The helper returned HTTP ${res.status}.`);
  return data;
}
async function refreshAccount() {
  helperInfo = await helper("/status");
  if (helperInfo.accounts?.find(a => a.id === helperInfo.activeId)?.connected) {
    modelChoices = (await helper("/models")).models;
    if (!modelChoices.some(m => m.id === vault.settings.chatgptModel)) vault.settings.chatgptModel = "";
  } else modelChoices = [];
}
function sendDestination() {
  if (vault.settings.mode === "chatgpt") return "your signed-in ChatGPT account, through the local helper";
  if (vault.settings.mode === "api") return `${PROVIDERS[vault.settings.provider].name} at ${safeBaseUrl(vault.settings.apiBase)}`;
  return `${CHAT_SITES[vault.settings.chatSite].name}, only when you paste and send the copied prompt there`;
}
function buildReview() {
  const context = { documents: structuredClone(vault.documents), notes: vault.notes };
  const request = buildPrompt(scan, context, { useChatContext: vault.settings.mode === "manual" && vault.settings.useChatContext });
  return { context, request };
}
async function scanPage(inspectDropdowns = false) {
  await task(async () => {
    resetPage();
    scan = await engine("scan", { inspectDropdowns });
    answers = applySavedAnswers(scan, vault);
    view = "page";
    notify(scan.fields.length ? `Found ${scan.fields.length} fields. Nothing was sent to AI.` : "No supported visible form fields were found. Expand the relevant page section and rescan.");
  }, "Reading visible form fields…");
}
function draft() {
  if (preview) {
    if (!scan) scan = demoScan();
    answerContext = { documents: structuredClone(vault.documents), notes: vault.notes };
    answers = applySavedAnswers(scan, vault, reviewAnswers(demoAnswer(scan), scan, answerContext));
    view = "review"; render(); notify("Fictional sample loaded. No AI was called, and no browser form was changed."); return;
  }
  let context, request, destination;
  try {
    ({ context, request } = buildReview()); destination = sendDestination();
    if (vault.settings.mode === "chatgpt" && !vault.settings.chatgptModel) throw new Error("Open AI connection, sign in, and select an available ChatGPT model first.");
    if (vault.settings.mode === "api" && !vault.settings.model.trim()) throw new Error("Choose or enter a model in AI connection first.");
  } catch (err) { notify(friendlyError(err), true); return; }
  const isManual = vault.settings.mode === "manual";
  const selected = request.sources.map(d => `<li>${e(d.name)}</li>`).join("");
  modal(isManual ? "Review your AI prompt" : "Review before sending", `
    <p>The following selected text and ${request.fields.length} draftable field labels will go to <strong>${e(destination)}</strong>. Review the exact prompt before sharing it.</p>
    ${selected ? `<ul class="small-text">${selected}</ul>` : ""}
    ${isManual && vault.settings.useChatContext ? `<div class="notice">Paste this into the same AI conversation that has your resume and background. No document upload in Paperbridge is required. Earlier chat facts cannot be verified locally, so check every returned answer.</div>` : ""}
    <div class="notice">Existing field values, saved answers, passwords, and user-only eligibility questions are not included. Selected background text is included verbatim, so remove anything private you do not want to send.</div>
    <label class="field-label" for="exact-prompt">Exact outgoing prompt · ${fmt(request.chars)} characters</label>
    <textarea id="exact-prompt" readonly>${e(request.prompt)}</textarea>
    ${isManual ? `<label class="check-label" style="margin-top:16px"><input type="checkbox" name="openChat"><span>Also open ${e(CHAT_SITES[vault.settings.chatSite].name)} in a new tab. Leave unchecked to use a chat you already have open.</span></label>` : ""}
    <label class="check-label" style="margin-top:16px"><input type="checkbox" name="consent" required><span>${isManual ? "I reviewed this content and want to copy it to my clipboard." : "I reviewed this content and authorize sending it to this provider. Provider usage charges or plan limits may apply."}</span></label>
  `, isManual ? "Copy prompt" : "Send & draft answers", async form => {
    if (isManual) {
      const openChat = form.elements.openChat.checked;
      const url = openChat ? vault.settings.chatSite === "other" ? safeChatUrl(vault.settings.customChatUrl) : CHAT_SITES[vault.settings.chatSite].url : null;
      await navigator.clipboard.writeText(request.prompt);
      prepared = request; answerContext = context; view = "review";
      if (url) await chrome.tabs.create({ url });
      dialog.close(); render();
      notify("Prompt copied. Paste it into your AI chat, send it yourself, then copy its JSON reply back to Review answers.");
    } else {
      // Request host permission while still in the explicit button-click gesture.
      const permission = allowHost(vault.settings.mode === "chatgpt" ? "http://127.0.0.1:47821" : vault.settings.apiBase);
      dialog.close();
      await task(async signal => {
        await permission;
        prepared = request; answerContext = context;
        const settingsSnapshot = { ...vault.settings };
        const combined = AbortSignal.any([signal, AbortSignal.timeout(180000)]);
        const text = settingsSnapshot.mode === "chatgpt" ?
          (await helper("/generate", { model: settingsSnapshot.chatgptModel, prompt: request.prompt }, combined)).text :
          await callProvider(settingsSnapshot, request.prompt, combined);
        answers = applySavedAnswers(scan, vault, reviewAnswers(text, scan, context));
        results = []; view = "review";
        notify("Drafts are ready. Check the evidence and select only the answers you approve.");
      }, "Drafting from your selected documents…", true);
    }
  });
}
async function automaticFill() {
  if (preview) throw new Error("Install the extension to use the ChatGPT tab bridge.");
  const allowed = await chrome.permissions.request({ origins: ["https://chatgpt.com/*"] });
  if (!allowed) throw new Error("ChatGPT tab access is required for automatic filling.");
  const tabs = (await chrome.tabs.query({ url: "https://chatgpt.com/*" })).filter(t => t.id !== target?.tabId);
  if (!tabs.length) throw new Error("Open ChatGPT in another tab, sign in, then try again.");
  const originalTarget = { ...target };
  modal("Fill automatically with ChatGPT", `
    <p>Send the visible form fields and selected background to the conversation you choose. Paperbridge will read its new reply and immediately fill supported empty fields. No per-answer approval is needed.</p>
    <label class="field-label" for="bridge-tab">ChatGPT conversation</label>
    <select id="bridge-tab" name="chatTab">${tabs.map(t => `<option value="${t.id}">${e(t.title || t.url)}</option>`).join("")}</select>
    <p>Use the conversation containing your background, or select documents on the Background page. Missing facts, unsupported fields, and unsupplied eligibility answers stay blank. Existing values and edits are preserved.</p>
    <div class="notice warn">Review the completed form yourself. Websites may autosave field changes. Paperbridge never clicks Submit or Next. Cancel stops this workflow but cannot recall a message already sent to ChatGPT.</div>
  `, "Start automatic fill", async form => {
    const tabId = Number(form.elements.chatTab.value);
    dialog.close();
    await task(async signal => {
      scan = null; invalidateDraft(); undoCount = 0; results = [];
      signal.throwIfAborted();
      scan = await engine("scan", { inspectDropdowns: false });
      const currentScan = scan;
      const context = { documents: structuredClone(vault.documents), notes: vault.notes };
      let rows = applySavedAnswers(scan, vault);
      if (scan.fields.some(f => !f.blockedReason && !f.userAnswerOnly && !f.filled)) {
        const request = buildPrompt(scan, context, { useChatContext: true });
        prepared = request; answerContext = context;
        progress("Sending form fields to your selected ChatGPT tab…");
        const text = await exchangeWithChat(tabId, request.prompt, scan.scanId, signal);
        rows = applySavedAnswers(currentScan, vault, reviewAnswers(text, currentScan, context));
      }
      signal.throwIfAborted();
      if (!vault || scan !== currentScan || target?.tabId !== originalTarget.tabId || target?.origin !== originalTarget.origin) throw new Error("The application or workspace changed. Nothing was filled.");
      answers = rows;
      progress("Filling the application fields…");
      const selected = automaticRows(scan, rows);
      const reply = await engine("fill", { scanId: scan.scanId, overwrite: false, answers: selected });
      results = reply.results; undoCount = reply.undoCount; view = "review";
      const done = results.filter(r => r.ok).length;
      notify(`${done} fields filled; ${scan.fields.length - done} left unchanged. Review the form. Nothing was submitted.`);
    }, "Scanning the application…", true);
  });
}

function fillApproved() {
  const selected = approvedRows();
  if (!selected.length) { notify("Select at least one valid answer to approve it.", true); return; }
  const overwrite = !!document.getElementById("overwrite")?.checked;
  modal(preview ? "Preview the fill step" : "Fill the approved fields?", `
    <p>${preview ? "This is a simulation using fictional answers. No actual browser page will be filled." : `Fill <strong>${selected.length} approved fields</strong> on <strong>${e(scan.origin)}</strong>. Check that this is the intended application.`}</p>
    <div class="notice warn">Websites may save or transmit values as soon as a field changes. Paperbridge never clicks Submit, Next, or agreement buttons, but it cannot prevent a website's own autosave behavior.</div>
    <p>${overwrite ? "You chose to replace existing values that were present at scan time. Fields changed after scanning will still be skipped." : "Existing answers will be left alone. Fields changed since scanning will be skipped."} Review the completed page yourself before submitting.</p>
    <label class="check-label"><input type="checkbox" required><span>I reviewed these answers and authorize ${preview ? "this demo step" : "putting them into this website's fields"}.</span></label>
  `, preview ? "Simulate approved fill" : `Fill ${selected.length} fields`, async () => {
    dialog.close();
    await task(async () => {
      const reply = await engine("fill", { scanId: scan.scanId, overwrite, answers: selected.map(a => ({
        fieldId: a.fieldId, value: a.value, userConfirmed: a.approved && !!(a.trustedUser || a.edited)
      })) });
      results = reply.results; undoCount = reply.undoCount;
      for (const row of answers) if (results.some(r => r.fieldId === row.fieldId && r.ok)) row.approved = false;
      const done = results.filter(r => r.ok).length;
      notify(preview ? `Simulated ${done} approved fills. This preview cannot access your browser tabs.` : `${done} fields filled; ${results.length - done} skipped. Review the website. Paperbridge did not click Submit.`);
    }, "Filling only the answers you approved…");
  });
}
async function importFiles(files) {
  if (!files?.length) return;
  await task(async () => {
    if (vault.documents.length + files.length > 25) throw new Error("Keep at most 25 documents in this workspace. Remove older files first.");
    let imported = 0, errors = [];
    for (const file of files) {
      try {
        progress(`Reading ${file.name} locally…`);
        const doc = await extractDocument(file, progress);
        if (vault.documents.some(d => d.hash === doc.hash)) { errors.push(`${file.name}: already in your workspace.`); continue; }
        vault.documents.push(doc); imported++;
      } catch (err) { errors.push(friendlyError(err)); }
    }
    invalidateDraft();
    await persist();
    notify(`${imported} document(s) added locally.${errors.length ? " " + errors.join(" ") : " Review the extracted text before using it."}`, errors.length > 0);
  }, "Reading your documents locally…");
}
async function lock() {
  if (busy || preview || !vault) return;
  clearTimeout(saveTimer);
  try { await persist(); } catch (err) { notify("Could not save before locking. " + friendlyError(err), true); return; }
  vault = null; keyInfo = null; helperInfo = null; modelChoices = [];
  resetPage(); dialog.close(); render();
}

function loginHTML() {
  const exists = !!storedBlob;
  return `<div class="login-shell">
    <section class="login-story"><div class="brand"><div class="brand-name">paperbridge<span style="color:#f4aa90">.</span></div><div class="eyebrow">YOUR EXPERIENCE. YOUR NEXT CHAPTER.</div></div>
    <div><h1>Fill the page.<br><span>Keep the final say.</span></h1><p>Bring answers from your AI chat into an application. Review your resume, employment, education, and employer answers before anything is filled.</p></div>
    <div class="login-foot">YOUR FACTS · YOUR APPROVAL · NEVER AUTO-SUBMIT</div></section>
    <section class="login-form-wrap" id="main-content" tabindex="-1"><form class="login-form" id="unlock-form"><div class="eyebrow">${exists ? "WELCOME BACK" : "YOUR PRIVATE WORKSPACE"}</div><h2>${exists ? "Unlock your workspace." : "Start with a little privacy."}</h2>
    <p>${exists ? "Enter your local vault passphrase. This is not your ChatGPT or browser password." : "Create a passphrase to encrypt saved answers, optional background, and connection settings in this browser. Your AI login happens separately."}</p>
    <div class="field-group"><label class="field-label" for="vault-password">${exists ? "Vault passphrase" : "Create a vault passphrase"}</label><input id="vault-password" type="password" required minlength="${exists ? 1 : 12}" autocomplete="${exists ? "current-password" : "new-password"}" placeholder="${exists ? "Your local passphrase" : "At least 12 characters"}" ${busy ? "disabled" : ""}></div>
    ${exists ? "" : `<div class="field-group"><label class="field-label" for="vault-confirm">Confirm passphrase</label><input id="vault-confirm" type="password" required minlength="12" autocomplete="new-password" ${busy ? "disabled" : ""}></div>`}
    <button class="primary" type="submit" ${busy ? "disabled" : ""}>${ico("lock-keyhole")}${busy ? "Opening workspace…" : exists ? "Unlock workspace" : "Create private workspace"}</button>
    <p class="legal">There is no passphrase recovery. Keep an encrypted backup and save your passphrase somewhere safe. Closing the workspace or 10 minutes of inactivity locks it.</p>
    <div class="row wrap"><button type="button" class="ghost text-button" data-action="import-backup">${ico("upload")}Restore encrypted backup</button>${exists ? `<button type="button" class="ghost danger text-button" data-action="reset-vault">Reset local vault</button>` : ""}</div>
    <input type="file" id="backup-file" accept=".json,application/json" hidden>
    </form></section></div>`;
}
function navigationHTML() {
  return `<aside class="sidebar"><div class="brand"><div class="brand-name">paperbridge<span style="color:#f4aa90">.</span></div><div class="eyebrow">AI FORM ASSISTANT</div></div>
  <nav aria-label="Workspace">${[
    ["page", "scan-line", "Application", scan?.fields.length || ""],
    ["review", "list-checks", "Review answers", answers.length ? approvedRows().length : ""],
    ["saved", "check-check", "Saved answers", vault.savedAnswers.length || ""],
    ["connection", "sliders-horizontal", "AI connection", ""],
    ["documents", "folder-open", "Background", vault.documents.length || ""]
  ].map(([id, icon, label, count]) => `<button class="nav-item ${view === id ? "active" : ""}" data-view="${id}" ${view === id ? 'aria-current="page"' : ""}>${ico(icon)}<span>${label}</span>${count !== "" ? `<span class="nav-count">${count}</span>` : ""}</button>`).join("")}</nav>
  <div class="sidebar-bottom"><span class="eyebrow">YOU'RE IN CONTROL</span><p>AI drafts the answers.<br>You approve the fields.<br>You submit the application.</p>
  <button class="ghost" data-action="help">${ico("circle-help")}Quick guide</button><button class="ghost" data-action="backup" ${preview ? "disabled" : ""}>${ico("download")}Encrypted backup</button><button class="ghost" data-action="lock" ${preview ? "disabled" : ""}>${ico("lock-keyhole")}Lock workspace</button>
  <p class="version-label">VERSION ${VERSION}<br>OPERA GX / CHROMIUM</p></div></aside>`;
}
function documentsHTML() {
  const count = selectedDocs().length;
  return `<div class="page-heading"><div><div class="eyebrow">OPTIONAL LOCAL BACKGROUND</div><h1>Background, if you need it.</h1><p>Already have your resume in an AI chat? Skip this page and use that conversation. Local text is only needed for direct API or helper drafting.</p></div><button class="small" data-action="paste-document">${ico("plus")}Paste text</button></div>
  <div class="two-col"><section>
    <div class="card"><div class="card-top"><h3>Source documents</h3><span class="badge">${count} selected</span></div>
      <label class="upload" id="drop-zone" tabindex="0" role="button" aria-label="Add documents"><span class="upload-icon">${ico("upload")}</span><strong>Drop documents here or <span>browse files</span></strong><p>PDF, DOCX, TXT, Markdown, CSV</p><span class="hint">10 MB per file · searchable PDFs only</span><input type="file" id="document-files" accept=".pdf,.docx,.txt,.md,.csv" multiple hidden></label>
      <div class="doc-list">${vault.documents.length ? vault.documents.map(d => `<div class="doc-row"><input type="checkbox" data-doc-toggle="${e(d.id)}" ${d.include !== false ? "checked" : ""} aria-label="Include ${e(d.name)} in AI requests"><span class="doc-icon">${ico("file-text")}</span><div class="doc-detail"><div class="doc-name">${e(d.name)}</div><div class="doc-meta">${fmt(d.text.length)} characters · ${d.warnings?.length ? "Check extraction" : preview && d.id === "sample-resume" ? "Fictional sample" : "Extracted locally"}</div></div><button class="ghost icon-only" data-doc-view="${e(d.id)}" aria-label="View extracted text for ${e(d.name)}" title="Review extracted text">${ico("eye")}</button><button class="ghost icon-only danger" data-doc-delete="${e(d.id)}" aria-label="Remove ${e(d.name)}" title="Remove document">${ico("trash-2")}</button></div>`).join("") : `<p class="small-text" style="margin:16px 0 0">No documents yet. Files stay local until you explicitly approve an AI request.</p>`}</div>
    </div>
    <div class="card note-card"><div class="row spread"><h3 style="margin:0">A little extra context</h3><span class="badge neutral">Optional</span></div><label class="screen-reader" for="personal-notes">Personal notes for the AI</label><textarea id="personal-notes" maxlength="20000" placeholder="Add facts you want the AI to know: a preferred name, availability, or why this role interests you. Do not include passwords or identity numbers.">${e(vault.notes)}</textarea><small>These notes are included with selected documents. Changes save encrypted locally.</small></div>
  </section><aside class="side-info"><div class="info-panel"><div class="eyebrow">A BETTER WAY TO APPLY</div><h2>Your experience,<br>not a blank page.</h2><p>A simple path from your documents to a reviewed application.</p><ol class="steps"><li><span class="step-index">1</span><div><strong>Bring your background</strong><span>Upload and check the text your AI will read.</span></div></li><li><span class="step-index">2</span><div><strong>Let your AI make a first draft</strong><span>Scan the form and approve what gets sent.</span></div></li><li><span class="step-index">3</span><div><strong>Make every answer yours</strong><span>Edit, approve, and fill. Submit it yourself.</span></div></li></ol></div>
    <div><div class="privacy-note">${ico("shield-check")}<p>Documents and keys are encrypted in the installed extension. Your vault passphrase never goes to an AI provider.</p></div><div class="privacy-note" style="padding-top:4px">${ico("circle-alert")}<p>Scanned images need OCR first. Always inspect extracted text, especially dates, columns, and tables.</p></div></div></aside></div>
  <div class="bottom-strip"><div><strong style="font-size:12px">Ready for the next step?</strong><p class="small-text" style="margin:3px 0 0">${preview ? "Try the workflow with a fictional application." : "Open a form and click the Paperbridge toolbar icon to select that page."}</p></div><button class="primary" data-action="auto-fill">Fill automatically with ChatGPT</button><button data-action="scan">${preview ? "Scan sample application" : "Scan application page"}${ico("arrow-right")}</button></div>`;
}
function pageHTML() {
  if (!scan) return `<div class="page-heading"><div><div class="eyebrow">START WITH THE RIGHT PAGE</div><h1>Read the form first.</h1><p>Paperbridge only reads the page you select with its toolbar icon. It does not monitor your browsing.</p></div></div>
    ${target ? `<div class="site-bar"><span class="site-icon">${ico("globe")}</span><div><strong>${e(target.title)}</strong><p>${e(target.origin)}</p></div></div>` : ""}
    <div class="empty">${ico("scan-line")}<h2>${preview ? "A sample application is ready." : target ? "Ready to scan this page." : "Choose an application page."}</h2><p>${preview ? "Scan the fictional form to try contact, employment, education, and eligibility questions. This demo never reads your real browser tabs." : "Open the form in a normal browser tab, then click the Paperbridge extension icon. Expand the section you want to fill and scan its visible fields."}</p><button class="primary" data-action="auto-fill">Fill automatically with ChatGPT</button><button data-action="scan">${ico("scan-line")}${preview ? "Scan sample application" : "Scan visible fields"}</button></div>
    <div class="workflow-note"><h3>Use the background already in your chat.</h3><p>Scan this page, copy its prompt into your existing AI conversation, and bring the JSON reply back. Review and approve the answers, then fill. You do not need to upload the same documents here.</p><div class="row wrap"><button class="small" data-view="connection">Choose AI connection</button><button class="small ghost" data-view="saved">Add your saved answers</button></div></div>`;
  const supported = scan.fields.filter(f => !f.blockedReason).length;
  const draftable = scan.fields.filter(f => !f.blockedReason && !f.userAnswerOnly).length;
  const custom = scan.fields.some(f => f.kind === "custom-select" && !f.blockedReason);
  return `<div class="page-heading"><div><div class="eyebrow">KNOW WHAT WILL BE FILLED</div><h1>Your application, mapped.</h1><p>Check the detected fields before sending anything to your AI. Existing field values are not included in the prompt.</p></div><div class="row wrap"><button class="primary" data-action="auto-fill">Fill automatically with ChatGPT</button><button class="small" data-action="scan">${ico("refresh-cw")}Rescan page</button></div></div>
  <div class="site-bar"><span class="site-icon">${ico("globe")}</span><div style="flex:1"><strong>${e(scan.title)}</strong><p>${e(scan.origin)}${e(scan.path)}</p></div><button class="ghost icon-only" data-action="focus-page" aria-label="Return to application page">${ico("arrow-up-right")}</button></div>
  <div class="metrics"><div class="metric"><b>${draftable}</b><span>AI-draftable</span></div><div class="metric"><b>${supported - draftable}</b><span>your own answers</span></div><div class="metric"><b>${scan.fields.length - supported}</b><span>manual-only</span></div></div>
  ${custom ? `<div class="notice"><div class="row spread wrap"><div>Custom dropdowns detected. Read their choices before drafting, or enter an exact option label during review.</div><button class="small" data-action="inspect-dropdowns">Read dropdown choices</button></div></div>` : ""}
  ${scan.workdayLike ? `<div class="notice">Workday-style page detected. Add job and school entries yourself, then scan the expanded section. After you click Save and Continue yourself, scan the next page. Searchable taxonomy controls and file uploads stay manual.</div>` : ""}
  ${scan.inaccessibleFrames ? `<div class="notice warn">${scan.inaccessibleFrames} embedded frame(s) could not be read. Cross-origin and protected embedded forms must be opened as a separate tab and scanned there, or filled manually.</div>` : ""}
  ${scan.truncated ? `<div class="notice warn">This scan reached the 120-field limit. Finish the visible section, then move to a smaller section and rescan.</div>` : ""}
  <div class="table-wrap"><table><thead><tr><th>Form field</th><th>Type</th><th>Handling</th><th><span class="screen-reader">Locate</span></th></tr></thead><tbody>${scan.fields.map(f => `<tr><td>${e(f.label)}${f.required ? ' <span class="muted">(required)</span>' : ""}<div class="muted">${e(f.section)}</div></td><td><span class="small-text">${e(f.kind === "text" ? f.type : f.kind)}</span></td><td><span class="badge ${f.blockedReason || f.userAnswerOnly ? "amber" : f.filled ? "neutral" : ""}">${f.blockedReason ? "Manual only" : f.userAnswerOnly ? "Your answer only" : f.filled ? "Already filled" : "Ready for draft"}</span>${f.blockedReason || f.optionReadError ? `<div class="muted" style="max-width:210px;margin-top:4px">${e(f.blockedReason || f.optionReadError)}</div>` : ""}${f.kind === "custom-select" && f.options.length ? `<div class="muted">${f.options.length} choices read</div>` : ""}</td><td><button class="ghost icon-only" data-locate="${e(f.id)}" aria-label="Locate ${e(f.label)}">${ico("arrow-up-right")}</button></td></tr>`).join("")}</tbody></table></div>
  <div class="bottom-strip"><div><strong style="font-size:12px">${vault.settings.mode === "manual" && vault.settings.useChatContext ? "Use your existing AI conversation" : `${selectedDocs().length} local document(s) selected`}</strong><p class="small-text" style="margin:3px 0 0">AI drafts are optional. You can enter and reuse your own answers.</p></div><div class="row wrap"><button data-action="draft" ${!draftable ? "disabled" : ""}>${preview ? "Load sample drafts" : vault.settings.mode === "manual" ? "Prepare AI prompt" : "Draft answers"}</button><button class="primary" data-view="review" ${!supported ? "disabled" : ""}>Review & fill${ico("arrow-right")}</button></div></div>`;
}
function editorHTML(field, row) {
  if (field.blockedReason) return `<p class="answer-reason">${e(field.blockedReason)}</p>`;
  const value = row.value;
  if (["select", "radio", "select-multiple"].includes(field.kind) || (field.kind === "custom-select" && field.options.length)) return `<label class="screen-reader" for="edit-${e(field.id)}">${e(field.label)}</label><select id="edit-${e(field.id)}" data-edit="${e(field.id)}" ${field.kind === "select-multiple" ? 'multiple size="3"' : ""}>${field.kind === "select-multiple" ? "" : '<option value="">Choose an answer…</option>'}${field.options.filter(o => o.value !== "").map(o => `<option value="${e(o.value)}" ${(Array.isArray(value) ? value.includes(o.value) : String(value) === o.value) ? "selected" : ""}>${e(o.label)}</option>`).join("")}</select>`;
  if (field.kind === "checkbox") return `<label class="screen-reader" for="edit-${e(field.id)}">${e(field.label)}</label><select id="edit-${e(field.id)}" data-edit="${e(field.id)}"><option value="">Choose an answer…</option><option value="true" ${value === true ? "selected" : ""}>Yes / checked</option><option value="false" ${value === false ? "selected" : ""}>No / unchecked</option></select>`;
  return `<label class="screen-reader" for="edit-${e(field.id)}">${e(field.label)}</label><textarea id="edit-${e(field.id)}" data-edit="${e(field.id)}" class="${field.type === "textarea" ? "long" : ""}" rows="${field.type === "textarea" ? 4 : 2}" placeholder="${field.kind === "custom-select" ? "Enter the exact visible dropdown choice, such as Yes or No." : "Enter your own answer or prepare an AI draft."}">${e(value ?? "")}</textarea>`;
}
function reviewHTML() {
  let importSection = "";
  if (scan && vault.settings.mode === "manual" && !preview) importSection = `<div class="card" style="margin-bottom:20px"><h3>Bring your AI answer back</h3><p class="small-text">Paste the complete JSON reply from your AI chat. The scan ID must match this application; unrecognized fields are rejected.</p><label class="screen-reader" for="answer-paste">AI JSON reply</label><textarea id="answer-paste" rows="4" placeholder='Paste {"scanId": "...", "answers": [...]} here'>${e(replyText)}</textarea><div class="row wrap" style="margin-top:12px"><button class="primary small" data-action="import-answer">Validate pasted answers</button><button class="small" data-action="draft">${ico("copy")}${prepared ? "Copy prompt again" : "Prepare prompt first"}</button></div></div>`;
  const heading = `<div class="page-heading"><div><div class="eyebrow">THE FINAL SAY IS ALWAYS YOURS</div><h1>Make every answer yours.</h1><p>Edit and approve each answer before filling. Chat context is not locally verified; a document quote match only proves the quoted text exists.</p></div>${answers.length && scan.fields.some(f => !f.blockedReason && !f.userAnswerOnly) ? `<button class="small" data-action="draft">${ico("refresh-cw")}${preview ? "Load sample drafts" : "Prepare AI draft"}</button>` : ""}</div>`;
  if (!answers.length) return heading + importSection + `<div class="empty">${ico("list-checks")}<h2>${scan ? "Your draft belongs here." : "Scan an application first."}</h2><p>${scan ? "Use your AI chat or enter your own answers. Nothing is filled until you explicitly approve it." : "Scan the application, then use your AI chat or enter your own answers. No local document upload is required."}</p><button class="primary" data-action="${scan ? "draft" : "scan"}">${ico(scan ? "square-pen" : "scan-line")}${preview ? "Load fictional sample" : scan ? "Prepare draft" : "Scan application page"}</button></div>`;
  const fields = new Map(scan.fields.map(f => [f.id, f]));
  return heading + importSection + `<div class="review-tools"><div class="row wrap"><button class="small" data-action="select-grounded">${ico("check-check")}Select quote-matched</button><button class="small ghost" data-action="clear-selected">Clear selection</button></div><span class="small-text">${answers.filter(a => a.matched).length} quote matches · ${answers.filter(a => !a.matched).length} need your attention</span></div>
  <div class="review-list">${answers.map(row => {
    const field = fields.get(row.fieldId), result = results.find(r => r.fieldId === row.fieldId);
    const badge = field.blockedReason ? "Manual only" : row.edited ? "Edited by you" : row.trustedUser ? "Your saved answer" : row.matched && !row.error ? "Quote matched" : row.value === null ? "Needs your input" : row.sourceType === "chat" ? "Chat: not verified locally" : "No quote match";
    return `<article class="answer ${field.blockedReason ? "manual" : row.approved ? "approved" : ""}" data-answer-card="${e(field.id)}"><input type="checkbox" data-approve="${e(field.id)}" ${row.approved ? "checked" : ""} ${row.error || field.blockedReason || row.value === null ? "disabled" : ""} aria-label="${field.userAnswerOnly ? "Approve my answer to" : "Approve"} ${e(field.label)}"><div>
      <div class="answer-header"><div><div class="answer-label">${e(field.label)}</div><span class="small-text">${e(field.section)}${field.filled ? " · already has an answer" : ""}</span></div><span class="badge ${!row.matched || row.error ? "amber" : ""}" data-answer-badge="${e(field.id)}">${ico(row.matched && !row.error ? "check" : "circle-alert")}${badge}</span></div>
      ${editorHTML(field, row)}
      <div class="form-errors" data-answer-error="${e(field.id)}">${field.blockedReason ? "" : e(row.error)}</div>
      ${row.reason && !field.blockedReason ? `<p class="answer-reason">${e(row.reason)}</p>` : ""}
      <div class="answer-bottom"><div class="answer-source">${row.sourceName ? `<details><summary>${e(row.sourceName)} · view evidence</summary><blockquote>${e(row.quote)}</blockquote></details>` : field.blockedReason ? "Not included in the AI prompt" : field.userAnswerOnly ? "This answer must come from you, not from AI." : "No matching source quotation supplied"}</div><div class="row wrap">${!field.blockedReason && field.kind !== "select-multiple" ? `<button class="small ghost" data-save-answer="${e(field.id)}" ${row.value === null || row.error ? "disabled" : ""}>Save for reuse</button>` : ""}<button class="ghost icon-only small" data-locate="${e(field.id)}" aria-label="Locate ${e(field.label)} on page">${ico("arrow-up-right")}</button></div></div>
      ${result ? `<div class="field-result ${result.ok ? "" : "fail"}">${result.ok ? result.undone ? "Previous value restored; verify on the website" : preview ? "Demo: this field would be filled" : "Value set; verify on the website" : e(result.error)}</div>` : ""}
    </div></article>`;
  }).join("")}</div>
  <div class="row wrap" style="margin-top:20px;justify-content:space-between"><label class="check-label"><input type="checkbox" id="overwrite"><span>Allow replacing existing values I reviewed<br><small>Edits made after the scan are still protected.</small></span></label>${undoCount ? `<button class="small" data-action="undo">${ico("undo-2")}Undo last fill (${undoCount})</button>` : ""}</div>
  <div class="review-footer"><div><strong id="approved-count">${approvedRows().length} answers approved</strong><p>No Submit, Next, or agreement buttons will be clicked.</p></div><button class="primary" data-action="fill" id="fill-button" ${!approvedRows().length ? "disabled" : ""}>${ico("check-check")}${preview ? "Preview approved fill" : "Fill approved answers"}</button></div>`;
}
function savedHTML() {
  return `<div class="page-heading"><div><div class="eyebrow">YOUR STATEMENTS, NOT AI GUESSES</div><h1>Answers worth keeping.</h1><p>Save answers you explicitly choose. Matching questions can reuse them, but every application still needs your approval.</p></div><button class="primary small" data-action="add-saved">${ico("plus")}Add answer</button></div>
    <div class="notice">Question wording must match, apart from punctuation, spacing, and capitalization. A “Yes” to work authorization never becomes a “No” to sponsorship. Site and section scopes keep employer-specific answers separate.</div>
    <div class="template-row"><span class="small-text">Start with a blank question:</span>${QUESTION_TEMPLATES.map((t, i) => `<button class="small" data-template="${i}">${e(t.name)}</button>`).join("")}</div>
    ${vault.savedAnswers.length ? `<div class="stack">${vault.savedAnswers.map(a => `<article class="card saved-row"><div><h3>${e(a.question)}</h3><p class="saved-value">${e(a.answer)}</p><p class="small-text">${e(a.origin || "Any site with this exact question")}${a.section ? ` · ${e(a.section)}` : " · Any section"}</p></div><div class="row"><button class="small" data-saved-edit="${e(a.id)}">Edit</button><button class="ghost icon-only small danger" data-saved-delete="${e(a.id)}" aria-label="Delete saved answer: ${e(a.question)}">${ico("trash-2")}</button></div></article>`).join("")}</div>` : `<div class="empty">${ico("check-check")}<h2>No assumptions saved.</h2><p>Choose a question above or save an answer from Review answers. Age eligibility, authorization, sponsorship, and employer permission all start blank.</p></div>`}`;
}
function editSaved({ saved = null, question = "", field = null, row = null } = {}) {
  const value = saved?.answer ?? (row?.value === true ? "Yes" : row?.value === false ? "No" : row?.value ?? "");
  modal(saved ? "Edit your saved answer" : "Save your own answer", `
    <p>Confirm the exact wording and your answer. Nothing is filled now, and this answer is not sent to an AI.</p>
    <div class="field-group"><label class="field-label" for="saved-question">Exact question</label><textarea id="saved-question" name="question" required maxlength="1200" rows="3">${e(saved?.question || field?.label || question)}</textarea></div>
    <div class="field-group"><label class="field-label" for="saved-value">Your answer</label><textarea id="saved-value" name="answer" required maxlength="4000" rows="2" placeholder="Enter your answer. Nothing is preselected.">${e(value)}</textarea></div>
    <div class="field-group"><label class="field-label" for="saved-origin">Only on this site (optional)</label><input id="saved-origin" name="origin" type="url" value="${e(saved ? saved.origin : field ? scan.origin : "")}" placeholder="https://employer.example.com"></div>
    <div class="field-group"><label class="field-label" for="saved-section">Only in this section (optional)</label><input id="saved-section" name="section" maxlength="250" value="${e(saved ? saved.section : field?.section || "")}" placeholder="Use the exact section shown in Review answers"></div>
    <div class="notice warn">Do not save passwords, identity numbers, payment details, signatures, or consent. For employer-contact permission, keep a site and section scope and recheck the employer before every fill.</div>
    <label class="check-label"><input type="checkbox" required><span>I confirm this is my answer, not an inferred eligibility or permission decision.</span></label>
  `, "Save answer", async form => {
    const question = form.elements.question.value.trim(), answer = form.elements.answer.value.trim();
    if (!question || !answer) throw new Error("Enter both the question and your answer.");
    if (question.includes("[replace")) throw new Error("Replace the bracketed employer placeholder with the exact employer name or question.");
    let origin = "";
    if (form.elements.origin.value.trim()) {
      const url = new URL(form.elements.origin.value.trim());
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an ordinary website address without credentials.");
      origin = url.origin;
    }
    const section = form.elements.section.value.trim();
    const existing = saved || vault.savedAnswers.find(a => normalizeQuestion(a.question) === normalizeQuestion(question) && a.origin === origin && normalizeQuestion(a.section) === normalizeQuestion(section));
    if (!existing && vault.savedAnswers.length >= 200) throw new Error("Keep at most 200 saved answers. Remove unused ones first.");
    const record = { id: existing?.id || crypto.randomUUID(), question, answer, origin, section };
    vault.savedAnswers = vault.savedAnswers.filter(a => a.id !== record.id).concat(record);
    if (scan) answers = applySavedAnswers(scan, vault, answers);
    await persist(); dialog.close(); render(); notify("Answer saved. Any matching fill still requires fresh approval.");
  });
}
function connectionHTML() {
  const s = vault.settings, account = helperInfo?.accounts?.find(a => a.id === helperInfo.activeId);
  const modes = [["manual", "message-square", "AI chat website", "Existing chat, with copy & paste"], ["chatgpt", "link", "ChatGPT account", "Sign-in preview + local helper"], ["api", "key-round", "Your provider API", "Bring a key or a local model"]];
  let content = "";
  if (s.mode === "chatgpt") content = `<div class="connection-grid"><div class="card connection-card"><h3>Connect your ChatGPT account</h3><p class="small-text">Sign in on OpenAI's website, never inside this extension. A small local helper receives the localhost callback.</p>
    <div class="field-group"><label class="field-label" for="helper-token">Local helper pairing code</label><input id="helper-token" data-setting="helperToken" type="password" autocomplete="off" placeholder="Paste the code from the helper window" value="${e(s.helperToken)}" ${preview ? "disabled" : ""}><small>Stored encrypted in your vault. This is not your ChatGPT password.</small></div>
    <div class="row wrap"><button class="small" data-action="pair-helper" ${preview ? "disabled" : ""}>${ico("laptop")}Pair helper</button><button class="small" data-action="refresh-helper" ${preview ? "disabled" : ""}>${ico("refresh-cw")}Refresh account</button></div>
    <div class="divider"></div>
    ${account ? `<div class="account-info"><span class="eyebrow">${account.connected ? "SIGNED IN TO CHATGPT" : "SAVED REGISTRATION · SIGNED OUT"}</span><div style="font-size:13px;margin-top:5px">${e(account.label || account.email || account.name)}</div></div>
      ${helperInfo.accounts.length > 1 ? `<div class="field-group"><label class="field-label" for="active-account">Selected account registration</label><select id="active-account">${helperInfo.accounts.map(a => `<option value="${e(a.id)}" ${a.id === helperInfo.activeId ? "selected" : ""}>${e(a.label || a.email || a.name)}${a.connected ? "" : " · signed out"}</option>`).join("")}</select></div>` : ""}` : ""}
    ${account?.connected ? `<div class="notice">You're using your ChatGPT plan. Drafting uses its eligible model allowance.</div>` : ""}
    <button class="signin-button" data-action="signin" ${preview ? "disabled" : ""}>Continue with ChatGPT</button>
    ${helperInfo?.login?.message ? `<p class="small-text" style="margin-top:12px">${e(helperInfo.login.message)}</p>` : ""}
    <div class="field-group" style="margin-top:17px"><label class="field-label" for="chatgpt-model">Available account model</label><select id="chatgpt-model" data-setting="chatgptModel" ${!modelChoices.length ? "disabled" : ""}><option value="">${modelChoices.length ? "Choose a model…" : "Sign in, then refresh your account"}</option>${modelChoices.map(m => `<option value="${e(m.id)}" ${s.chatgptModel === m.id ? "selected" : ""}>${e(m.name || m.id)}</option>`).join("")}</select><small>Models come from your account, not a hard-coded list.</small></div>
    ${account ? `<div class="row wrap"><button class="small" data-action="usage">Open ChatGPT usage</button><button class="small" data-action="new-account">Add / switch account</button>${account.connected ? `<button class="small ghost danger" data-action="signout">${ico("log-out")}Sign out</button>` : ""}</div>` : ""}
    </div><aside class="connection-help"><h3>A one-time local setup.</h3><ol><li>Install a current Node.js LTS release if it is not already installed.</li><li>Open <code>helper/start-helper.bat</code> on Windows. Use <code>start-helper.sh</code> on Linux or <code>start-helper.command</code> on macOS.</li><li>Leave the helper window open, copy its pairing code here, and click Pair helper.</li><li>Click Continue with ChatGPT. Return here afterward and click Refresh account, then select a model.</li></ol><div class="notice">Signing in uses your account's plan access and eligible model allowance. It does not share your full ChatGPT history. Selected document text is sent only when you approve a draft.</div><p>Availability is subject to OpenAI's sign-in preview and your account. If it is unavailable, use the API or chat-website mode instead. <a href="https://developers.openai.com/siwc/token-sharing-open-source" target="_blank" rel="noreferrer">Read OpenAI's integration documentation</a>.</p><p>Paperbridge is an independent open-source project, not an OpenAI or Opera product.</p></aside></div>`;
  if (s.mode === "api") content = `<div class="connection-grid"><div class="card connection-card"><h3>Connect a model API</h3><p class="small-text">The installed extension talks directly to your chosen endpoint. No Paperbridge cloud account or intermediary server is used.</p>
    <div class="field-group"><label class="field-label" for="api-provider">Provider</label><select id="api-provider">${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${s.provider === id ? "selected" : ""}>${e(p.name)}</option>`).join("")}</select></div>
    <div class="field-group"><label class="field-label" for="api-base">API base URL</label><input id="api-base" data-setting="apiBase" value="${e(s.apiBase)}" type="url" ${!["custom", "ollama"].includes(s.provider) ? "readonly" : ""} ${preview ? "disabled" : ""}><small>Base URL only, without /chat/completions, /responses, or /messages.</small></div>
    <div class="field-group"><label class="field-label" for="api-key">API key <small>${["custom", "ollama"].includes(s.provider) ? "(optional for a local endpoint)" : ""}</small></label><input id="api-key" data-setting="apiKey" type="password" value="${e(s.apiKey)}" autocomplete="off" placeholder="Stored encrypted in your local vault" ${preview ? "disabled" : ""}></div>
    <div class="field-group"><label class="field-label" for="api-model">Model ID</label><input id="api-model" data-setting="model" list="available-models" value="${e(s.model)}" placeholder="Load models or enter an exact model ID"><datalist id="available-models">${modelChoices.map(m => `<option value="${e(m.id)}">${e(m.name)}</option>`).join("")}</datalist><small>Use a text/chat model that follows JSON instructions.</small></div>
    <div class="row wrap"><button class="primary small" data-action="load-models" ${preview ? "disabled" : ""}>${ico("refresh-cw")}Allow host & load models</button><button class="small" data-action="save-settings">${ico("check")}Save settings</button></div>
    </div><aside class="connection-help"><h3>Pick the AI that suits you.</h3><p>Presets cover OpenAI, Claude, Gemini, OpenRouter, and local Ollama. Custom endpoints use the OpenAI chat-completions format.</p><div class="notice warn">Only trust endpoints you control or recognize. Your API key and selected document text go to the configured host. Changing providers or the base URL clears the old key.</div><p>For Ollama, run the server on your computer, pull a model, and enter its exact name. If it rejects the extension origin, configure a narrow <code>OLLAMA_ORIGINS</code> value for this extension, not a wildcard.</p><p>API charges and model availability are set by the provider. ChatGPT website subscriptions and API billing are separate. <a href="https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api" target="_blank" rel="noreferrer">OpenAI's billing explanation</a>.</p><p>Provider keys are decrypted only while the workspace is unlocked. They never go to the application page.</p></aside></div>`;
  if (s.mode === "manual") content = `<div class="connection-grid"><div class="card connection-card"><h3>Use a chat login you already have</h3><p class="small-text">No API key or helper is needed. On the Application page, choose Fill automatically with ChatGPT to send the prompt, read the new reply, and fill supported fields. The manual copy-and-paste workflow below is also available.</p>
    <div class="field-group"><label class="field-label" for="chat-site">AI chat website</label><select id="chat-site" data-setting="chatSite">${Object.entries(CHAT_SITES).map(([id, site]) => `<option value="${id}" ${s.chatSite === id ? "selected" : ""}>${site.name}</option>`).join("")}</select></div>
    ${s.chatSite === "other" ? `<div class="field-group"><label class="field-label" for="chat-url">Your AI website URL</label><input id="chat-url" data-setting="customChatUrl" type="url" value="${e(s.customChatUrl)}" placeholder="https://your-ai-website.example"></div>` : ""}
    <label class="check-label" style="margin-bottom:18px"><input type="checkbox" data-setting="useChatContext" ${s.useChatContext ? "checked" : ""}><span>Use the resume and background already in my AI conversation.<br><small>No local document is required. Paste the prompt into that same conversation.</small></span></label>
    <button class="primary small" data-action="open-chat">${ico("external-link")}Open ${e(CHAT_SITES[s.chatSite].name)}</button>
    <div class="divider"></div><h3>The copy-and-paste handoff</h3><ol class="small-text" style="padding-left:18px;line-height:1.9"><li>Scan your application page.</li><li>Review and copy the prepared prompt.</li><li>Paste it into your AI chat and send it yourself.</li><li>Copy the AI's complete JSON reply back into Review answers.</li><li>Validate, edit, approve, and fill.</li></ol></div>
    <aside class="connection-help"><h3>Your login stays where it belongs.</h3><p>Sign in directly on the provider's real website. Paperbridge does not read chat cookies or capture passwords. Starting an automatic ChatGPT run sends one prompt and reads its new reply in the conversation you select.</p><div class="notice">Automatic ChatGPT filling is available on the Application page. Other AI websites use the manual handoff. Website changes can interrupt the automatic bridge.</div><p>Your AI can use files already supplied in that same conversation. The extension receives the reply you paste back or the new reply from your automatic ChatGPT run; earlier-chat evidence is not locally verified.</p><p>Your clipboard is not cleared automatically. Copying a prompt replaces its current contents, so keep that in mind when using shared computers.</p></aside></div>`;
  return `<div class="page-heading"><div><div class="eyebrow">YOUR AI, YOUR WAY</div><h1>Choose your connection.</h1><p>Use ChatGPT sign-in, bring your own API, or keep your existing chat workflow. Documents stay yours in every mode.</p></div></div>
    ${preview ? `<div class="notice warn">This is an interface preview. Live sign-in and API calls are disabled. Do not enter passwords, pairing codes, or API keys here.</div>` : ""}
    <div class="mode-options">${modes.map(([id, icon, name, description]) => `<button class="mode-option ${s.mode === id ? "active" : ""}" data-mode="${id}" aria-pressed="${s.mode === id}">${ico(icon)}<strong>${name}</strong><span>${description}</span></button>`).join("")}</div>${content}`;
}
function render() {
  if (!vault) app.innerHTML = loginHTML();
  else {
    const titles = { documents: "Optional background", page: "Application page", review: "Review answers", saved: "Saved answers", connection: "AI connection" };
    app.innerHTML = `<div class="shell">${navigationHTML()}<div class="workspace">
      ${preview ? `<div class="preview-banner">INTERACTIVE PREVIEW · Fictional sample data. No AI connection and no access to your browser tabs.</div>` : ""}
      <header class="topbar"><div class="breadcrumb">Private workspace ${ico("chevron-right")}<strong>${titles[view]}</strong></div><div class="row"><span class="vault-state">${ico("lock-keyhole")}<span id="save-state">${preview ? "Demo · memory only" : saveError ? "Not saved" : saving ? "Encrypting changes…" : "Encrypted locally"}</span></span><button class="ghost icon-only small" data-action="${preview ? "help" : "lock"}" aria-label="${preview ? "Quick guide" : "Lock workspace"}">${ico(preview ? "circle-help" : "lock-keyhole")}</button></div></header>
      ${busy ? `<div class="busy-bar" role="status"><span><span class="busy-dot"></span><span id="busy-text">${e(busyText)}</span></span>${controller ? '<button class="small" data-action="cancel">Cancel request</button>' : ""}</div>` : ""}
      <main class="content ${busy ? "busy-content" : ""}" id="main-content" tabindex="-1" ${busy ? 'aria-busy="true" inert' : ""}>${view === "documents" ? documentsHTML() : view === "page" ? pageHTML() : view === "review" ? reviewHTML() : view === "saved" ? savedHTML() : connectionHTML()}</main></div></div>`;
    if (busy) app.querySelectorAll(".nav-item").forEach(el => { el.disabled = true; });
  }
  refreshIcons();
  if (renderedView !== (vault ? view : null)) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  renderedView = vault ? view : null;
  const zone = document.getElementById("drop-zone");
  if (zone) {
    zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", ev => { ev.preventDefault(); zone.classList.remove("dragover"); importFiles([...ev.dataTransfer.files]); });
    zone.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); document.getElementById("document-files").click(); } });
  }
}
function updateReviewCounts() {
  const count = approvedRows().length;
  const label = document.getElementById("approved-count"); if (label) label.textContent = `${count} answers approved`;
  const button = document.getElementById("fill-button"); if (button) button.disabled = !count;
}
function editAnswer(control) {
  const id = control.dataset.edit, field = scan.fields.find(f => f.id === id), row = answers.find(a => a.fieldId === id);
  if (!field || !row || field.blockedReason) return;
  const raw = field.kind === "checkbox" ? control.value === "" ? null : control.value === "true" :
    field.kind === "select-multiple" ? [...control.selectedOptions].map(o => o.value) : control.value;
  const checked = validateFieldValue(field, raw);
  row.value = checked.value; row.error = checked.error; row.edited = true; row.trustedUser = true; row.matched = false; row.approved = false;
  const card = control.closest(".answer");
  card.classList.remove("approved");
  const checkbox = card.querySelector("[data-approve]"); checkbox.checked = false; checkbox.disabled = !!checked.error || checked.value === null;
  card.querySelector("[data-answer-error]").textContent = checked.error;
  const badge = card.querySelector("[data-answer-badge]"); badge.textContent = "Edited by you"; badge.className = "badge amber";
  const saveButton = card.querySelector("[data-save-answer]"); if (saveButton) saveButton.disabled = !!checked.error || checked.value === null;
  updateReviewCounts();
}
async function signIn(newProfile = false, existingPermission = null) {
  if (!vault.settings.welcomeSeen) {
    modal("Connect your ChatGPT account", `
      <p>You are about to connect your ChatGPT account to an open-source project. It is up to you to decide whether you trust this project with access to your ChatGPT account and data.</p>
      <p>You can log out any time. Logging out removes local helper tokens and attempts to revoke access. Selected document text will only be sent when you approve a drafting request.</p>
      <p>Paperbridge is independent and not endorsed by OpenAI. Read the included source, PRIVACY.md, and SECURITY.md before proceeding.</p>
      <label class="check-label"><input type="checkbox" required><span>I trust this local project and want to continue to the official sign-in page.</span></label>`,
    "Continue to sign-in", async () => {
      const permission = allowHost("http://127.0.0.1:47821");
      vault.settings.welcomeSeen = true;
      dialog.close(); await signIn(newProfile, permission);
    }); return;
  }
  const permission = existingPermission || allowHost("http://127.0.0.1:47821");
  await task(async () => {
    await permission; await persist();
    helperInfo = await helper("/pair", {});
    const data = await helper("/oauth/start", { newProfile });
    const u = new URL(data.authorizationUrl);
    if (u.origin !== "https://auth.openai.com") throw new Error("The helper returned an unexpected sign-in host. Nothing was opened.");
    await chrome.tabs.create({ url: u.href });
    notify("Finish sign-in on OpenAI's website. Return here and click Refresh account.");
  }, "Starting official ChatGPT sign-in…");
}
async function downloadBackup() {
  if (preview) return;
  clearTimeout(saveTimer); await persist();
  const blob = new Blob([JSON.stringify(storedBlob, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `Paperbridge-encrypted-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  notify("Encrypted backup created. It still needs your vault passphrase; it does not include the separate helper's ChatGPT session.");
}
function help() {
  modal("A few things worth knowing", `
    <h3>Start on the application page</h3><p>Open a regular HTTP or HTTPS form, click the extension icon, unlock your vault, and scan. Browser settings, extension stores, built-in PDF viewers, protected frames, and some custom widgets are not supported.</p>
    <h3>Keep using your existing AI chat</h3><p>AI chat website mode can use the resume and background already in that conversation. Copy the form prompt into that chat, then paste its JSON reply here. Local background documents are optional unless you use direct API or helper drafting.</p>
    <h3>Draft, review, then fill</h3><p>Choose an AI connection, approve the outgoing text, and check every answer. Eligibility and employer-permission answers must come from you and can be saved for exact-match reuse. Consent, signatures, attachments, identity numbers, and CAPTCHAs stay manual.</p>
    <h3>Workday and other custom forms</h3><p>Use Read dropdown choices for supported button-based menus. Only exact reviewed choices are selected. Add work and school entries and advance steps yourself, then rescan. Searchable taxonomy widgets and menus that cannot be identified safely are left manual.</p>
    <h3>You are still on a real website</h3><p>Paperbridge never clicks Submit or Next. A site's own input listeners can still autosave as soon as a field changes. Undo restores unchanged fields in the last batch; it cannot recall data a site already received.</p>
    <h3>Keep your vault recoverable</h3><p>Use the sidebar's encrypted backup action. There is no forgotten-passphrase recovery. Documents auto-lock after 10 minutes of inactivity, while a separate ChatGPT helper session stays signed in until you explicitly sign it out.</p>
    <p class="small-text">See START_HERE.md, PRIVACY.md, and SECURITY.md in your download for setup, limitations, permissions, and recovery. This project is independent of Opera and the AI providers.</p>`, "", null, { cancelLabel: "Back to workspace" });
}

app.addEventListener("submit", async ev => {
  if (ev.target.id !== "unlock-form") return;
  ev.preventDefault();
  const password = document.getElementById("vault-password").value;
  const confirm = document.getElementById("vault-confirm")?.value;
  if (!storedBlob && password !== confirm) { notify("The passphrases do not match.", true); return; }
  busy = true; render();
  try {
    if (storedBlob) {
      const result = await openVault(storedBlob, password); vault = result.value; keyInfo = result.keyInfo;
      vault.settings = { ...DEFAULT_SETTINGS, ...vault.settings };
      vault.savedAnswers ||= [];
    } else { keyInfo = await createVaultKey(password); vault = newVault(); await persist(); }
    await getTarget(); lastActivity = Date.now(); view = "page";
  } catch (err) { vault = null; keyInfo = null; notify(friendlyError(err), true); }
  finally { busy = false; render(); }
});
app.addEventListener("input", ev => {
  const el = ev.target;
  if (el.id === "personal-notes") { vault.notes = el.value; invalidateDraft(); scheduleSave(); }
  if (el.id === "answer-paste") replyText = el.value;
  if (el.dataset.edit) editAnswer(el);
  if (el.dataset.setting) {
    const key = el.dataset.setting;
    if (key === "apiBase" && vault.settings.apiBase !== el.value) {
      vault.settings.apiKey = "";
      const keyInput = document.getElementById("api-key"); if (keyInput) keyInput.value = "";
      modelChoices = [];
    }
    vault.settings[key] = el.type === "checkbox" ? el.checked : el.value;
    if (key === "useChatContext") { prepared = null; answerContext = null; replyText = ""; }
    scheduleSave();
  }
});
app.addEventListener("change", async ev => {
  const el = ev.target;
  try {
    if (el.id === "document-files") { await importFiles([...el.files]); return; }
    if (el.id === "backup-file") {
      const file = el.files[0]; if (!file) return;
      if (file.size > 13000000) throw new Error("Backup exceeds the safety limit.");
      let blob;
      try { blob = JSON.parse(await file.text()); } catch { throw new Error("That file is not a valid JSON vault backup."); }
      modal("Restore an encrypted backup", `<p>This replaces the vault stored in this browser. It does not merge document libraries. Enter the backup's passphrase to verify it before replacement.</p><label class="field-label" for="restore-pass">Backup passphrase</label><input id="restore-pass" name="password" type="password" required autocomplete="off"><label class="check-label" style="margin-top:16px"><input type="checkbox" required><span>I authorize replacing the current local vault with this backup.</span></label>`, "Verify & restore", async form => {
        const result = await openVault(blob, form.elements.password.value);
        if (!preview) await chrome.storage.local.set({ paperbridgeVault: blob });
        storedBlob = blob; vault = result.value; keyInfo = result.keyInfo;
        vault.settings = { ...DEFAULT_SETTINGS, ...vault.settings };
        vault.savedAnswers ||= [];
        resetPage(); dialog.close(); await getTarget(); view = "page"; render(); notify("Backup verified and restored.");
      }); return;
    }
    if (el.dataset.docToggle) {
      vault.documents.find(d => d.id === el.dataset.docToggle).include = el.checked;
      invalidateDraft(); await persist(); render(); return;
    }
    if (el.dataset.approve) {
      const row = answers.find(a => a.fieldId === el.dataset.approve);
      if (row && !row.error && row.value !== null) row.approved = el.checked;
      el.closest(".answer").classList.toggle("approved", el.checked); updateReviewCounts(); return;
    }
    if (el.id === "api-provider") {
      // Clear the visible secret immediately, before any asynchronous persistence.
      const keyInput = document.getElementById("api-key");
      if (keyInput) keyInput.value = "";
      vault.settings.provider = el.value;
      vault.settings.apiBase = PROVIDERS[el.value].base;
      vault.settings.apiKey = "";
      vault.settings.model = "";
      modelChoices = [];
      await persist();
      render();
      return;
    }
    if (el.id === "active-account") {
      await task(async () => { helperInfo = await helper("/account/select", { id: el.value }); vault.settings.chatgptModel = ""; await refreshAccount(); await persist(); }, "Switching account…"); return;
    }
    if (el.dataset.setting && el.tagName === "SELECT") { vault.settings[el.dataset.setting] = el.value; await persist(); if (el.id === "chat-site") render(); }
  } catch (err) { notify(friendlyError(err), true); }
});
app.addEventListener("click", async ev => {
  const el = ev.target.closest("button");
  if (!el || el.disabled) return;
  try {
    if (el.dataset.view) {
      view = el.dataset.view; render(); return;
    }
    if (el.dataset.mode) { vault.settings.mode = el.dataset.mode; modelChoices = []; await persist(); render(); return; }
    if (el.dataset.template !== undefined) { editSaved({ question: QUESTION_TEMPLATES[Number(el.dataset.template)].question }); return; }
    if (el.dataset.savedEdit) { editSaved({ saved: vault.savedAnswers.find(a => a.id === el.dataset.savedEdit) }); return; }
    if (el.dataset.saveAnswer) {
      const field = scan.fields.find(f => f.id === el.dataset.saveAnswer), row = answers.find(a => a.fieldId === el.dataset.saveAnswer);
      if (field && row && !row.error && row.value !== null) editSaved({ field, row });
      return;
    }
    if (el.dataset.savedDelete) {
      const record = vault.savedAnswers.find(a => a.id === el.dataset.savedDelete);
      modal("Delete this saved answer?", `<p>Remove the saved answer for <strong>${e(record.question)}</strong>. Website values and already-sent information are not changed.</p>`, "Delete saved answer", async () => {
        vault.savedAnswers = vault.savedAnswers.filter(a => a.id !== record.id);
        if (scan) answers = applySavedAnswers(scan, vault, answers.filter(a => a.sourceId !== `saved:${record.id}`));
        await persist(); dialog.close(); render();
      }); return;
    }
    if (el.dataset.docView) {
      const doc = vault.documents.find(d => d.id === el.dataset.docView);
      modal(doc.name, `${doc.warnings?.length ? `<div class="notice warn">${doc.warnings.map(e).join("<br>")}</div>` : ""}<p>This is the exact extracted text included when this document is selected. Layout, images, and formatting are not sent.</p><pre>${e(doc.text)}</pre>`, "", null, { cancelLabel: "Done reviewing" }); return;
    }
    if (el.dataset.docDelete) {
      const doc = vault.documents.find(d => d.id === el.dataset.docDelete);
      modal("Remove this document?", `<p>Remove <strong>${e(doc.name)}</strong> and its extracted text from this local vault. The original file on your computer is not affected; content already sent to an AI cannot be recalled.</p>`, "Remove document", async () => {
        vault.documents = vault.documents.filter(d => d.id !== doc.id); invalidateDraft();
        await persist(); dialog.close(); render();
      }); return;
    }
    if (el.dataset.locate) { await engine("locate", el.dataset.locate); await focusTarget(); if (preview) notify("In the installed extension, this highlights the field on the actual application."); return; }
    switch (el.dataset.action) {
      case "lock": await lock(); break;
      case "auto-fill": await automaticFill(); break;
      case "scan": await scanPage(); break;
      case "inspect-dropdowns":
        modal("Read the dropdown choices?", `<p>This opens and closes recognized dropdown menus on the selected page to read their labels. It does not intentionally select an option or advance the application.</p><p>This creates a fresh scan and clears the old draft and undo history. If a website changes a value when its menu opens, review it manually.</p>`, "Read choices & rescan", async () => { dialog.close(); await scanPage(true); }); break;
      case "add-saved": editSaved(); break;
      case "focus-page": await focusTarget(); break;
      case "draft": draft(); break;
      case "cancel": controller?.abort(); break;
      case "help": help(); break;
      case "backup": await downloadBackup(); break;
      case "import-backup": document.getElementById("backup-file").click(); break;
      case "reset-vault":
        modal("Permanently reset the local vault?", `<p>This removes the encrypted documents, notes, and settings stored by this extension. It cannot recover a forgotten passphrase, undo data already sent to providers, or sign out the separate local helper.</p><p>Keep a backup before resetting. Type DELETE to confirm.</p><input name="confirmation" required pattern="DELETE" aria-label="Type DELETE to confirm">`, "Delete local vault", async () => {
          await chrome.storage.local.remove("paperbridgeVault"); storedBlob = null; dialog.close(); render();
        }); break;
      case "paste-document":
        modal("Add a text document", `<p>Paste resume text or other factual background. This is stored locally and only sent if you select it and approve an AI request.</p><div class="field-group"><label class="field-label" for="text-name">Document name</label><input id="text-name" name="name" required maxlength="180" placeholder="Work history notes"></div><label class="field-label" for="text-document">Document text</label><textarea id="text-document" name="text" required maxlength="250000" placeholder="Paste the text you want your AI to use…"></textarea>`, "Add document", async form => {
          if (vault.documents.length >= 25) throw new Error("Remove an older document before adding another.");
          const text = form.elements.text.value.trim();
          if (!text) throw new Error("Add some non-empty text.");
          vault.documents.push({ id: crypto.randomUUID(), name: form.elements.name.value.trim() || "Notes", text, include: true, importedAt: new Date().toISOString(), warnings: [] });
          invalidateDraft(); await persist(); dialog.close(); render();
        }); break;
      case "import-answer":
        if (!scan || !answerContext) throw new Error("Prepare and copy a prompt for the current scan first.");
        answers = applySavedAnswers(scan, vault, reviewAnswers(replyText, scan, answerContext)); results = []; replyText = "";
        render(); notify("Answer structure and quotes checked. Review and approve each answer yourself."); break;
      case "select-grounded":
        for (const a of answers) {
          const field = scan.fields.find(f => f.id === a.fieldId);
          a.approved = a.matched && !a.error && a.value !== null && !field.filled && !field.userAnswerOnly;
        }
        render(); break;
      case "clear-selected": for (const a of answers) a.approved = false; render(); break;
      case "fill": fillApproved(); break;
      case "undo":
        modal("Undo the last fill?", `<p>Restore the last batch's previous values on this page. Fields changed since filling are skipped; undo cannot recall information the website already saved.</p>`, "Undo unchanged fields", async () => {
          dialog.close();
          await task(async () => {
            const undone = await engine("undo"); undoCount = 0; results = undone.results.map(r => ({ ...r, undone: true }));
            notify(`${undone.results.filter(r => r.ok).length} fields restored; ${undone.results.filter(r => !r.ok).length} left unchanged.`);
          }, "Restoring the last fill…");
        }); break;
      case "save-settings": safeBaseUrl(vault.settings.apiBase); await persist(); notify("Settings saved encrypted in your local vault."); break;
      case "pair-helper": {
        const permission = allowHost("http://127.0.0.1:47821");
        await task(async () => { await permission; await persist(); helperInfo = await helper("/pair", {}); notify("Extension paired with the local helper. You can now sign in with ChatGPT."); }, "Pairing with the local helper…"); break;
      }
      case "refresh-helper": {
        const permission = allowHost("http://127.0.0.1:47821");
        await task(async () => {
          await permission; await refreshAccount(); await persist();
          const connected = helperInfo.accounts?.some(a => a.id === helperInfo.activeId && a.connected);
          if (connected && !vault.settings.planNoticeSeen) {
            modal("You're using your ChatGPT plan", `<p>Paperbridge can now use eligible models through your ChatGPT plan. Requests count toward its applicable usage limits; this connection does not provide access to earlier chat conversations.</p><p>You control every drafting request and every filled field. Open ChatGPT Settings → Usage to review usage.</p>`, "Continue", async () => { vault.settings.planNoticeSeen = true; await persist(); dialog.close(); });
          } else notify(connected ? "Account refreshed. Choose a model below." : helperInfo.login?.message || "Not signed in yet.");
        }, "Refreshing account and available models…"); break;
      }
      case "signin": await signIn(false); break;
      case "new-account": await signIn(true); break;
      case "usage":
        if (!preview) await chrome.tabs.create({ url: "https://chatgpt.com/" });
        notify("In ChatGPT, open Settings → Usage to review this app's usage and access limits."); break;
      case "signout":
        modal("Sign out of this ChatGPT helper?", `<p>This removes the active account's local helper tokens and attempts to revoke them with OpenAI. It does not sign you out of the ChatGPT website or delete your document vault.</p>`, "Sign out", async () => {
          dialog.close();
          await task(async () => { helperInfo = await helper("/oauth/logout", {}); modelChoices = []; vault.settings.chatgptModel = ""; await persist(); notify(helperInfo.login.message, !helperInfo.revoked); }, "Signing out…");
        }); break;
      case "load-models": {
        const settings = { ...vault.settings }, permission = allowHost(settings.apiBase);
        await task(async signal => {
          await permission; await persist();
          modelChoices = await listModels(settings, AbortSignal.any([signal, AbortSignal.timeout(45000)]));
          notify(modelChoices.length ? `Loaded ${modelChoices.length} model IDs. Choose a compatible text model from the Model ID field.` : "The service returned no models. You can enter a model ID manually.");
        }, "Loading models from your provider…", true); break;
      }
      case "open-chat": {
        const url = vault.settings.chatSite === "other" ? safeChatUrl(vault.settings.customChatUrl) : CHAT_SITES[vault.settings.chatSite].url;
        if (preview) { notify("Install the extension to use your real AI login. The preview does not open account connections."); break; }
        await chrome.tabs.create({ url }); break;
      }
    }
  } catch (err) { notify(friendlyError(err), true); }
});
document.addEventListener("pointerdown", () => { lastActivity = Date.now(); }, { passive: true });
document.addEventListener("keydown", () => { lastActivity = Date.now(); }, { passive: true });
setInterval(() => { if (vault && !preview && !busy && !saveError && Date.now() - lastActivity > 10 * 60000) lock(); }, 30000);
window.addEventListener("beforeunload", ev => {
  if (saving || pendingSave || busy) { ev.preventDefault(); ev.returnValue = ""; }
});
async function start() {
  if (preview) vault = demoVault();
  else {
    const stored = await chrome.storage.local.get("paperbridgeVault");
    storedBlob = stored.paperbridgeVault || null;
    await getTarget();
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (sender.id === chrome.runtime.id && message.type === "paperbridge-target-changed") {
        resetPage(); getTarget().then(() => { if (vault) view = "page"; render(); });
      }
    });
  }
  render();
}
start().catch(err => {
  app.textContent = "Paperbridge could not open. Reload the extension and try again.";
  notify(friendlyError(err), true);
});
