import { MAX_FIELDS, validateFieldValue } from "./core.js";
import { userAnswerKind } from "./answers.js";

// Runs in Chromium's ISOLATED world, only after an explicit toolbar action.
// No runtime message listener, permanent page injection, or page-readable attributes.
if (!globalThis.__paperbridgeEngine) {
  const sensitive = [
    /\b(password|passcode|one.?time.?code|otp|captcha|recaptcha)\b/i,
    /\b(ssn|social security|tax.?id|national.?id|passport|driver.?s? licen[cs]e|identity number)\b/i,
    /\b(bank|routing|iban|swift|credit.?card|debit.?card|card.?number|cvv|cvc|payment|account.?number)\b/i,
    /\b(date.?of.?birth|birth|birth.?date|birthday|dob|bday|age)\b/i,
    /\b(race|ethnic\w*|gender|sex|sexual|pronouns|religion|marital|veteran|disab\w*|medical|health)\b/i,
    /\b(citizen\w*|immigra\w*|visa|sponsor\w*|work.?author\w*|work.?permit|authori[sz]ed to work|criminal|felon\w*|convict\w*|background.?check)\b/i,
    /\b(sign|signed|signature|certif(?:y|ies|ication of accuracy)|attest\w*|consent|agree|accept|terms|privacy|subscribe|opt.?in|opt.?out|acknowledg\w*|affirm|under penalty|i declare|i understand)\b/i,
    /\b(token|api.?key|secret|credential)\b/i
  ];
  let state = null;
  let undoState = null;
  const text = s => String(s || "").replace(/\s+/g, " ").trim();
  const limit = (s, n = 500) => text(s).slice(0, n);
  const normalizeChoice = s => text(s).normalize("NFKC").toLowerCase();
  const placeholder = s => /^(select(?: one| an option)?|choose(?: one| an option)?|please select|--+)?$/i.test(text(s));
  function customSelect(el) {
    if (!el.matches('button[aria-haspopup="listbox"],input[role="combobox"][aria-haspopup="listbox"]')) return false;
    if (el.tagName === "INPUT" && !el.readOnly) return false;
    if (el.tagName === "BUTTON" && el.type === "submit") return false;
    if (el.closest('[data-automation-id="multiselectInputContainer"],[aria-multiselectable="true"]')) return false;
    return !/\b(save|submit|continue|next|back|apply|delete|remove|add|agree|accept)\b/i.test(text(el.textContent));
  }
  function visible(el) {
    if (!el?.isConnected || el.closest("[hidden],[inert],[aria-hidden='true']")) return false;
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && !!el.getClientRects().length;
  }
  function labelFor(el) {
    const root = el.getRootNode();
    const labelled = el.getAttribute("aria-labelledby")?.split(/\s+/).map(id => root.getElementById?.(id)?.textContent).filter(Boolean).join(" ");
    const labels = el.labels ? [...el.labels].map(l => l.textContent).join(" ") : "";
    const parentLabel = el.closest("label")?.textContent;
    const wrapper = el.closest('[data-automation-id^="formField-"]');
    const workdayLabel = wrapper?.querySelector('label,[data-automation-id="formLabel"],legend')?.textContent;
    const legend = el.closest("fieldset")?.querySelector(":scope > legend")?.textContent;
    const hint = el.getAttribute("autocomplete")?.replace(/section-\S+|shipping|billing/g, "").trim();
    const technical = (el.name || el.id || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
    const autoId = el.getAttribute("data-automation-id") || el.id || "";
    if (/dateSection(Month|Year|Day)/i.test(autoId)) {
      const component = /Month/i.test(autoId) ? "Month" : /Year/i.test(autoId) ? "Year" : "Day";
      const group = workdayLabel || (/endDate/i.test(wrapper?.getAttribute("data-automation-id") || "") ? "To" : "From");
      return limit(`${group} / ${component}`, 700);
    }
    return limit((customSelect(el) ? workdayLabel || legend : "") || labelled || el.getAttribute("aria-label") || labels || parentLabel || workdayLabel || (el.tagName === "SELECT" ? legend : "") || el.placeholder || el.title || hint || technical, 1200);
  }
  function sectionFor(el) {
    const repeated = el.closest('[data-automation-id^="workExperience-"],[data-automation-id^="education-"],[data-automation-id^="educationSection-"],[data-automation-id^="websitePanelSet-"]');
    if (repeated) {
      const id = repeated.getAttribute("data-automation-id");
      const heading = repeated.querySelector("h2,h3,h4,legend,[data-automation-id=panel-set-title]")?.textContent;
      const label = id.replace(/^workExperience-/, "Work experience ").replace(/^education(?:Section)?-/, "Education ").replace(/^websitePanelSet-/, "Website ");
      return limit(heading ? `${label} / ${heading}` : label, 250);
    }
    const fieldset = el.closest("fieldset");
    if (fieldset) return limit(fieldset.querySelector(":scope > legend")?.textContent, 250);
    const section = el.closest("section,[role=group]");
    return limit(section?.getAttribute("aria-label") || section?.querySelector("h2,h3,h4,legend")?.textContent, 250);
  }
  function rootsUnder(root, out, counter, depth = 0) {
    if (depth > 12) { counter.deep++; return; }
    out.push(root);
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) rootsUnder(el.shadowRoot, out, counter, depth + 1);
      if (el.tagName === "IFRAME" && visible(el)) {
        try {
          const doc = el.contentDocument;
          if (doc?.documentElement) rootsUnder(doc, out, counter, depth + 1);
          else counter.frames++;
        } catch { counter.frames++; }
      }
    }
  }
  function describe(el, nodes = [el], cachedOptions = []) {
    const type = (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase();
    const section = sectionFor(el);
    let label = labelFor(el), kind = "text", options = [];
    if (customSelect(el)) { kind = "custom-select"; options = cachedOptions; }
    else if (type === "radio") {
      kind = "radio";
      label = limit(el.closest("fieldset")?.querySelector(":scope > legend")?.textContent) || limit(el.closest("[role=radiogroup]")?.getAttribute("aria-label")) || section || limit(el.name) || label;
      options = nodes.map((n, i) => ({ value: String(n.value || `option-${i}`), label: labelFor(n) || String(n.value) }));
    } else if (type === "checkbox") kind = "checkbox";
    else if (el.tagName === "SELECT") {
      kind = el.multiple ? "select-multiple" : "select";
      options = [...el.options].filter(o => !o.disabled && !o.parentElement?.disabled).map(o => ({ value: o.value, label: limit(o.label, 250) }));
    } else if (el.isContentEditable) kind = "contenteditable";
    const descriptor = [label, section, el.name, el.id, el.autocomplete, el.getAttribute("aria-describedby")?.split(/\s+/).map(id => el.getRootNode().getElementById?.(id)?.textContent).join(" "), ...options.map(o => o.label)].join(" ").replace(/[_-]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
    let blockedReason = "";
    const ownAnswer = userAnswerKind(label);
    const hardSensitive = [0, 1, 2, 4, 6, 7].some(i => sensitive[i].test(descriptor));
    if (sensitive.some(pattern => pattern.test(descriptor)) || ["password", "file"].includes(type)) blockedReason = type === "file" ? "Upload attachments manually on the website." : "Sensitive declaration, credential, or personal identifier. Complete this manually.";
    if (ownAnswer && !hardSensitive && !["password", "file"].includes(type)) blockedReason = "";
    if (!label) blockedReason = "No reliable field label. Complete this manually.";
    if (el.getAttribute("role") === "combobox" && el.tagName !== "SELECT" && !customSelect(el)) blockedReason = "Searchable or multi-select widget. Choose its option manually.";
    if (el.closest('[data-automation-id="multiselectInputContainer"]')) blockedReason = "Searchable taxonomy widget. Choose its results manually.";
    if (kind === "contenteditable" && el.childElementCount && el.getAttribute("contenteditable") !== "plaintext-only") blockedReason = "Rich-text editor. Paste a reviewed answer manually.";
    if (options.length > 300) blockedReason = "This choice list is too large. Choose the option manually.";
    if (["radio", "select", "select-multiple"].includes(kind) && new Set(options.map(o => o.value)).size !== options.length) blockedReason = "The page uses ambiguous duplicate option values. Choose manually.";
    return {
      label: label || "Unlabeled field", section, type, kind,
      required: nodes.some(n => n.required || n.getAttribute("aria-required") === "true"),
      maxLength: el.maxLength > 0 ? el.maxLength : 0,
      options: options.slice(0, 300), blockedReason,
      userAnswerOnly: !!ownAnswer && !blockedReason, userAnswerKind: ownAnswer
    };
  }
  function rawChoice(node) {
    return text(node.tagName === "INPUT" ? node.value : node.getAttribute("aria-valuetext") || node.textContent);
  }
  function readValue(entry) {
    const { node, nodes, field } = entry;
    if (field.kind === "custom-select") { const value = rawChoice(node); return placeholder(value) ? "" : value; }
    if (field.kind === "radio") return nodes.filter(n => n.checked).map(n => n.value);
    if (field.kind === "checkbox") return node.checked;
    if (field.kind === "select-multiple") return [...node.selectedOptions].map(o => o.value);
    if (field.kind === "contenteditable") return node.textContent;
    return node.value;
  }
  function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function hasValue(v) { return Array.isArray(v) ? v.some(x => x !== "") : v === true || (typeof v === "string" && v.trim() !== ""); }
  function signature(field) {
    const { label, section, type, kind, options, blockedReason, required, maxLength, userAnswerOnly } = field;
    return JSON.stringify({ label, section, type, kind, options, blockedReason, required, maxLength, userAnswerOnly });
  }
  function identity(entry) {
    const n = entry.node;
    return JSON.stringify({
      id: n.id, name: n.name, autocomplete: n.autocomplete,
      form: n.form ? [n.form.id, n.form.name, n.form.action] : null,
      document: n.ownerDocument.location.href,
      nodes: entry.nodes.map(x => [x.id, x.name, x.getAttribute("type")])
    });
  }
  function nativeSet(node, property, value) {
    let proto = Object.getPrototypeOf(node);
    while (proto) {
      const setter = Object.getOwnPropertyDescriptor(proto, property)?.set;
      if (setter) { setter.call(node, value); return; }
      proto = Object.getPrototypeOf(proto);
    }
    node[property] = value;
  }
  function setValue(entry, value, restore = false) {
    const { node, nodes, field } = entry;
    if (field.kind === "radio") {
      const values = restore ? value : [value];
      for (const option of nodes) nativeSet(option, "checked", values.includes(option.value));
    } else if (field.kind === "checkbox") nativeSet(node, "checked", value);
    else if (field.kind === "select-multiple") for (const opt of node.options) nativeSet(opt, "selected", value.includes(opt.value));
    else if (field.kind === "contenteditable") node.textContent = value;
    else nativeSet(node, "value", value);
  }
  function emit(entry) {
    let nodes = entry.field.kind === "radio" ? entry.nodes.filter(n => n.checked) : [entry.node];
    if (!nodes.length) nodes = [entry.node]; // Undo may restore a radio group to no selection.
    for (const node of nodes) {
      const E = node.ownerDocument.defaultView.Event;
      node.dispatchEvent(new E("input", { bubbles: true, composed: true }));
      node.dispatchEvent(new E("change", { bubbles: true, composed: true }));
    }
  }
  function waitFor(check, doc, timeout = 1800) {
    return new Promise((resolve, reject) => {
      let observer, timer, frame, settled = false;
      const cleanup = () => { observer?.disconnect(); clearTimeout(timer); if (frame) doc.defaultView.cancelAnimationFrame(frame); doc.removeEventListener("input", inspect, true); doc.removeEventListener("change", inspect, true); };
      const inspect = () => {
        if (settled) return;
        try {
          const value = check();
          if (value) { settled = true; cleanup(); resolve(value); }
        } catch (err) { settled = true; cleanup(); reject(err); }
      };
      const tick = () => { inspect(); if (!settled) frame = doc.defaultView.requestAnimationFrame(tick); };
      observer = new doc.defaultView.MutationObserver(inspect);
      observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      doc.addEventListener("input", inspect, true); doc.addEventListener("change", inspect, true);
      timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); reject(new Error("The dropdown did not respond. Choose it manually, then rescan.")); } }, timeout);
      tick();
    });
  }
  function listboxes(node) {
    const roots = [node.ownerDocument, node.getRootNode()];
    return [...new Set(roots.flatMap(root => [...root.querySelectorAll('[role="listbox"]')]))].filter(visible);
  }
  async function openDropdown(entry) {
    const node = entry.node;
    if (!customSelect(node) || !visible(node) || node.disabled) throw new Error("Not a supported dropdown.");
    const before = new Set(listboxes(node));
    const controls = node.getAttribute("aria-controls")?.split(/\s+/) || [];
    const alreadyOpen = node.getAttribute("aria-expanded") === "true";
    if (!alreadyOpen) { node.focus({ preventScroll: true }); node.click(); }
    return waitFor(() => {
      const boxes = listboxes(node);
      const controlled = boxes.filter(b => controls.includes(b.id));
      if (controlled.length === 1) return controlled[0];
      const newlyVisible = boxes.filter(b => !before.has(b));
      if (newlyVisible.length === 1) return newlyVisible[0];
      if (alreadyOpen && boxes.length === 1) {
        const expanded = [...node.ownerDocument.querySelectorAll('[aria-haspopup="listbox"][aria-expanded="true"]')];
        if (expanded.length === 1 && expanded[0] === node) return boxes[0];
      }
      return null;
    }, node.ownerDocument);
  }
  function optionRows(list) {
    let rows = [...list.querySelectorAll('[role="option"]')];
    if (!rows.length) rows = [...list.querySelectorAll("li")];
    return rows.filter(row => visible(row) && row.getAttribute("aria-disabled") !== "true" && !row.disabled).map(row => {
      const target = row.matches('[data-automation-id="promptOption"]') ? row : row.querySelector('[data-automation-id="promptOption"]') || row;
      return { row, target, label: limit(target.getAttribute("data-automation-label") || target.getAttribute("aria-label") || target.textContent || row.textContent, 1000) };
    }).filter(row => row.label);
  }
  async function closeDropdown(entry, list) {
    if (!visible(list)) return;
    const node = entry.node, K = node.ownerDocument.defaultView.KeyboardEvent;
    node.dispatchEvent(new K("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    node.dispatchEvent(new K("keyup", { key: "Escape", code: "Escape", bubbles: true }));
    if (visible(list) && node.tagName === "BUTTON" && node.getAttribute("aria-expanded") === "true") node.click();
    if (visible(list)) node.blur();
    try { await waitFor(() => !visible(list) || node.getAttribute("aria-expanded") === "false", node.ownerDocument, 600); }
    catch { throw new Error("The menu did not close. Close it manually; other dropdown options were not inspected."); }
  }
  async function inspectDropdown(entry) {
    const before = readValue(entry), list = await openDropdown(entry);
    try {
      const rows = optionRows(list);
      if (rows.length > 300) throw new Error("This list is too large. Select it manually.");
      if (new Set(rows.map(r => normalizeChoice(r.label))).size !== rows.length) throw new Error("This list has ambiguous duplicate labels. Select it manually.");
      return rows.filter(row => !placeholder(row.label)).map(row => ({ value: row.label, label: row.label }));
    } finally {
      await closeDropdown(entry, list);
      if (readValue(entry) !== before) throw new Error("The website changed a value while opening the menu. Review it and rescan.");
    }
  }
  async function chooseDropdown(entry, value, restoring = false) {
    const list = await openDropdown(entry);
    const wanted = restoring && value === "" ? entry.emptyLabel : String(value);
    const matches = optionRows(list).filter(row => normalizeChoice(row.label) === normalizeChoice(wanted));
    if (matches.length !== 1) {
      await closeDropdown(entry, list);
      throw new Error(restoring && value === "" ? "This dropdown has no matching empty choice. Restore it manually." : "No unique exact dropdown choice was found. Choose it manually.");
    }
    const choice = matches[0];
    if (choice.target.closest("button")?.type === "submit") {
      await closeDropdown(entry, list);
      throw new Error("The option has an unsafe button type. Choose it manually.");
    }
    choice.target.click();
    await waitFor(() => {
      if (!entry.node.isConnected) throw new Error("The website replaced this control. Check its selection and rescan.");
      return normalizeChoice(readValue(entry)) === normalizeChoice(restoring && value === "" ? "" : choice.label);
    }, entry.node.ownerDocument);
    if (visible(list)) await closeDropdown(entry, list);
  }
  function assertFresh(entry) {
    if (entry.node.ownerDocument.defaultView?.document !== entry.node.ownerDocument ||
        (entry.node.ownerDocument.defaultView?.frameElement && !entry.node.ownerDocument.defaultView.frameElement.isConnected)) throw new Error("The embedded document changed. Rescan.");
    if (!entry.nodes.every(n => visible(n) && !n.disabled && (!n.readOnly || customSelect(n)))) throw new Error("Field is hidden, disabled, removed, or read-only. Rescan.");
    const fresh = describe(entry.node, entry.nodes, entry.field.kind === "custom-select" ? entry.field.options : []);
    if (fresh.blockedReason || signature(fresh) !== entry.signature || identity(entry) !== entry.identity) throw new Error("Field changed since the scan. Rescan before filling.");
  }
  async function scan(config = {}) {
    const roots = [], counts = { frames: 0, deep: 0 };
    rootsUnder(document, roots, counts);
    const used = new Set(), entries = new Map(), fields = [];
    let truncated = false;
    let inspectionStopped = false;
    const scanId = crypto.randomUUID();
    for (const root of roots) {
      const candidates = [...root.querySelectorAll('input,textarea,select,button[aria-haspopup="listbox"],[contenteditable=true],[contenteditable=plaintext-only]')];
      for (const node of candidates) {
        if (used.has(node) || !visible(node) || node.disabled || (node.readOnly && !customSelect(node)) || (!customSelect(node) && ["hidden", "submit", "button", "reset", "image", "range", "color"].includes(node.type))) continue;
        if (node.isContentEditable && node.parentElement?.isContentEditable) continue;
        if (fields.length >= MAX_FIELDS) { truncated = true; continue; }
        let nodes = [node];
        if (node.type === "radio" && node.name) nodes = candidates.filter(n => n.type === "radio" && n.name === node.name && n.form === node.form && visible(n) && !n.disabled);
        for (const n of nodes) used.add(n);
        const field = { id: `${scanId}:${fields.length + 1}`, ...describe(node, nodes) };
        const entry = { node, nodes, field, signature: signature(field), before: null };
        entry.identity = identity(entry);
        entry.emptyLabel = field.kind === "custom-select" ? rawChoice(node) : "";
        if (field.kind === "custom-select" && !field.blockedReason && config?.inspectDropdowns && !inspectionStopped) {
          try { Object.assign(field, describe(node, nodes, await inspectDropdown(entry))); }
          catch (err) {
            field.optionReadError = err.message;
            if (/did not close|changed a value/.test(err.message)) inspectionStopped = true;
          }
          entry.signature = signature(field);
        }
        // Never read values from sensitive fields.
        if (!field.blockedReason) entry.before = readValue(entry);
        field.filled = field.blockedReason ? false : hasValue(entry.before);
        entries.set(field.id, entry);
        fields.push(field);
      }
    }
    state = { scanId, href: location.href, entries };
    undoState = null;
    return {
      scanId, origin: location.origin, title: limit(document.title, 300),
      path: location.pathname, fields, inaccessibleFrames: counts.frames, truncated,
      workdayLike: /(^|\.)myworkdayjobs\.com$/.test(location.hostname) || !!document.querySelector('[data-automation-id="myExperiencePage"],[data-automation-id="applyFlowPrimaryQuestionsPage"],[data-automation-id="contactInformationPage"]'),
      pageStep: limit(document.querySelector('[data-automation-id="progressBarActiveStep"],[aria-current="step"]')?.textContent, 200),
      scannedAt: new Date().toISOString()
    };
  }
  async function fill(payload) {
    if (!state || payload.scanId !== state.scanId || state.href !== location.href) throw new Error("The page or scan has changed. Rescan before filling.");
    if (!Array.isArray(payload.answers) || payload.answers.length > MAX_FIELDS) throw new Error("Invalid approved answers.");
    const seen = new Set();
    for (const row of payload.answers) {
      if (!row || !state.entries.has(row.fieldId) || seen.has(row.fieldId)) throw new Error("Unknown or duplicate field. Nothing was filled.");
      seen.add(row.fieldId);
    }
    const results = [], undo = [];
    for (const row of payload.answers) {
      const entry = state.entries.get(row.fieldId);
      try {
        assertFresh(entry);
        if (entry.field.userAnswerOnly && row.userConfirmed !== true) throw new Error("This answer requires explicit user confirmation, not an AI inference.");
        const current = readValue(entry);
        if (!equal(current, entry.before)) throw new Error("The field was edited after scanning. Rescan to preserve your changes.");
        if (hasValue(current) && !payload.overwrite) throw new Error("Already filled. Enable reviewed overwrites or leave it unchanged.");
        const checked = validateFieldValue(entry.field, row.value);
        if (checked.error) throw new Error(checked.error);
        let handledEvents = false;
        if (entry.field.kind === "custom-select") { await chooseDropdown(entry, checked.value); handledEvents = true; }
        else if (entry.field.kind === "checkbox") {
          if (entry.node.required && checked.value === false) throw new Error("The website requires this checkbox. Complete it manually.");
          if (entry.node.checked !== checked.value) { entry.node.click(); handledEvents = true; }
        } else if (entry.field.kind === "radio") {
          const option = entry.nodes.find(n => n.value === checked.value);
          if (option && !option.checked) { option.click(); handledEvents = true; }
        } else setValue(entry, checked.value);
        const after = readValue(entry);
        const expected = entry.field.kind === "radio" ? [checked.value] : checked.value;
        const matchesExpected = entry.field.kind === "custom-select" ? normalizeChoice(after) === normalizeChoice(expected) : equal(after, expected);
        if (!matchesExpected || (entry.node.validity && !entry.node.validity.valid)) {
          if (!handledEvents) setValue(entry, current, true);
          throw new Error("The page rejected this value or its constraints. Complete it manually.");
        }
        if (!handledEvents) emit(entry);
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!equal(readValue(entry), after)) {
          // Framework updated synchronously; don't overwrite it a second time.
          throw new Error("The website changed the value immediately. Check this field manually.");
        }
        undo.push({ entry, before: current, after });
        entry.before = after;
        results.push({ fieldId: row.fieldId, ok: true });
      } catch (err) { results.push({ fieldId: row.fieldId, ok: false, error: String(err.message) }); }
    }
    if (undo.length) undoState = { href: location.href, rows: undo };
    return { results, undoCount: undo.length };
  }
  async function undo() {
    if (!undoState || undoState.href !== location.href) throw new Error("No undo is available for this page.");
    const results = [];
    for (const row of undoState.rows) {
      try {
        assertFresh(row.entry);
        if (!equal(readValue(row.entry), row.after)) throw new Error("You or the page changed this answer. It was left untouched.");
        const entry = row.entry;
        if (entry.field.kind === "custom-select") await chooseDropdown(entry, row.before, true);
        else if (entry.field.kind === "checkbox" && entry.node.checked !== row.before) entry.node.click();
        else if (entry.field.kind === "radio") {
          if (!row.before.length) throw new Error("This radio group originally had no selection. Clear it manually; there is no reliable framework-safe unselect action.");
          entry.nodes.find(n => n.value === row.before[0])?.click();
        }
        else { setValue(entry, row.before, true); emit(entry); }
        await new Promise(resolve => setTimeout(resolve, 0));
        if (!equal(readValue(entry), row.before)) throw new Error("The website did not preserve the restored value. Check it manually.");
        row.entry.before = row.before;
        results.push({ fieldId: row.entry.field.id, ok: true });
      } catch (err) { results.push({ fieldId: row.entry.field.id, ok: false, error: err.message }); }
    }
    undoState = null;
    return { results };
  }
  function locate(fieldId) {
    const entry = state?.entries.get(fieldId);
    if (!entry?.node?.isConnected) throw new Error("Field no longer exists. Rescan.");
    entry.node.scrollIntoView({ behavior: "smooth", block: "center" });
    const previous = entry.node.style.outline;
    entry.node.style.outline = "3px solid #ed655c";
    setTimeout(() => { if (entry.node.style.outline === "rgb(237, 101, 92) solid 3px" || entry.node.style.outline.includes("237")) entry.node.style.outline = previous; }, 2200);
    return true;
  }
  globalThis.__paperbridgeEngine = Object.freeze({ scan, fill, undo, locate });
}
