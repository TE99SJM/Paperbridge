import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const args = process.argv.slice(2);
const local = args.includes("--local");
const name = `${local ? "Paperbridge-Local-Install" : "Paperbridge-Opera-GX"}-v${pkg.version}`;
const requested = args.find(arg => !arg.startsWith("--"));
const archive = requested ? path.resolve(requested) : path.join(root, "release", name + ".zip");
const zip = await JSZip.loadAsync(await fs.readFile(archive), { checkCRC32: true });
await fs.mkdir(path.join(root, "qa"), { recursive: true });
const extracted = await fs.mkdtemp(path.join(root, "qa", "release-check-"));
for (const [file, entry] of Object.entries(zip.files)) {
  assert.ok((local || file.startsWith(name + "/")) && !file.includes("..") && !file.includes("\\"));
  const full = path.resolve(extracted, file);
  assert.ok(full.startsWith(extracted + path.sep));
  if (entry.dir) await fs.mkdir(full, { recursive: true });
  else {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, await entry.async("nodebuffer"));
  }
}
const project = local ? extracted : path.join(extracted, name);
const extension = local ? project : path.join(project, "extension");
const checksumText = await fs.readFile(path.join(project, "CHECKSUMS.sha256"), "utf8");
let verified = 0;
for (const line of checksumText.trim().split("\n")) {
  const [hash, file] = line.split("  ");
  const actual = createHash("sha256").update(await fs.readFile(path.join(project, file))).digest("hex");
  assert.equal(actual, hash, file); verified++;
}
const manifest = JSON.parse(await fs.readFile(path.join(extension, "manifest.json"), "utf8"));
assert.equal(manifest.host_permissions, undefined);
const profile = await fs.mkdtemp(path.join(root, "qa", "release-profile-"));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: true, channel: "chromium", viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
});
try {
  const worker = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/index.html`);
  await page.locator("#vault-password").waitFor();
  await page.screenshot({ path: path.join(extracted, "packaged-login.png") });
  await page.locator("#vault-password").fill("fictional-release-passphrase");
  await page.locator("#vault-confirm").fill("fictional-release-passphrase");
  await page.locator("#unlock-form button[type=submit]").click();
  await page.locator("nav").waitFor();
  assert.equal(await page.locator("h1").textContent(), "Read the form first.");
  assert.match(await page.locator(".workflow-note").textContent(), /do not need to upload/);
  await page.screenshot({ path: path.join(extracted, "packaged-application.png") });
} finally { await ctx.close(); }
if (!local) {
  const helperFolder = await fs.mkdtemp(path.join(os.tmpdir(), "paperbridge-release-helper-"));
  let helper;
  try {
    const module = await import(pathToFileURL(path.join(project, "helper/paperbridge-helper.mjs")).href);
    helper = await module.createHelper({ folder: helperFolder, quiet: true });
    const port = await helper.listen(0);
    assert.equal(helper.server.address().address, "127.0.0.1");
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).name, "Paperbridge local sign-in helper");
  } finally {
    if (helper) await helper.close();
    await fs.rm(helperFolder, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ archive, extractedProject: project, checkedFileHashes: verified, packagedExtension: "loaded and unlocked", packagedHelper: local ? "not included; existing-chat workflow needs no helper" : "isolated loopback health check passed; no authentication attempted" }, null, 2));
