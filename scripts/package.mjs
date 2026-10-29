import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const name = `Paperbridge-Opera-GX-v${pkg.version}`;
const release = path.join(root, "release");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const zip = new JSZip();
const contents = new Map();
const allowed = ["extension", "src", "helper", "examples", "tests", "scripts", ".github",
  "package.json", "package-lock.json", ".gitignore", "START_HERE.md", "README.md",
  "LOCAL_INSTALL.md", "PRIVACY.md", "SECURITY.md", "VALIDATION.md", "FLOWS.md",
  "CONTRIBUTING.md", "CHANGELOG.md", "RELEASE_NOTES.md", "LICENSE"];
const forbidden = /(^|\/)(?:node_modules|qa|preview|release|\.git|\.env[^/]*|session\.json|session\.tmp|credentials[^/]*|[^/]*\.log)(\/|$)/i;
async function collect(relative) {
  if (forbidden.test(relative)) throw new Error(`Forbidden release path: ${relative}`);
  const full = path.join(root, relative), stat = await fs.lstat(full);
  if (stat.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the release: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of (await fs.readdir(full)).sort()) await collect(`${relative}/${name}`);
    return;
  }
  if (!stat.isFile()) throw new Error(`Unexpected file type: ${relative}`);
  const bytes = await fs.readFile(full);
  contents.set(relative, bytes);
  zip.file(`${name}/${relative}`, bytes, {
    unixPermissions: /\.(?:sh|command)$/.test(relative) ? 0o100755 : 0o100644,
    date: stat.mtime
  });
}
for (const entry of allowed) await collect(entry);
const required = ["extension/manifest.json", "extension/index.html", "extension/styles.css",
  "extension/app.js", "extension/scanner.js", "extension/background.js",
  "extension/pdf.worker.min.mjs", "extension/assets/icon-128.png",
  "extension/assets/geist-latin-wght-normal.woff2", "extension/THIRD_PARTY_NOTICES.txt",
  "helper/paperbridge-helper.mjs", "helper/THIRD_PARTY_NOTICES.txt",
  "examples/react-practice.js", "scripts/package.mjs", "tests/browser.mjs"];
for (const file of required) assert.ok(contents.get(file)?.length, `Missing built/source file: ${file}. Run npm run build first.`);
const manifest = JSON.parse(contents.get("extension/manifest.json").toString());
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "clipboardWrite", "scripting", "sidePanel", "storage"]);
assert.equal(manifest.host_permissions, undefined, "QA host permissions must never ship");
assert.equal(manifest.content_scripts, undefined, "No permanent page injection is allowed");
assert.equal(manifest.externally_connectable, undefined);
assert.ok(manifest.description.length <= 132);
const checksums = [...contents].map(([file, data]) => `${sha(data)}  ${file}`).join("\n") + "\n";
zip.file(`${name}/CHECKSUMS.sha256`, checksums, { unixPermissions: 0o100644 });
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });
const readback = await JSZip.loadAsync(bytes, { checkCRC32: true });
for (const [file, original] of contents) {
  const restored = await readback.file(`${name}/${file}`).async("nodebuffer");
  assert.equal(sha(restored), sha(original), `ZIP content mismatch: ${file}`);
}
for (const file of Object.keys(readback.files)) {
  assert.ok(file.startsWith(name + "/"), "ZIP must have one descriptive root folder");
  assert.ok(!file.includes("..") && !file.includes("\\"), "Unsafe archive path");
  assert.ok(!forbidden.test(file), "Private/generated test data entered the archive");
}
await fs.mkdir(release, { recursive: true });
const output = path.join(release, name + ".zip");
await fs.writeFile(output, bytes);
await fs.writeFile(output + ".sha256", `${sha(bytes)}  ${path.basename(output)}\n`);
console.log(JSON.stringify({ archive: output, bytes: bytes.length, files: contents.size + 1, sha256: sha(bytes), crcVerified: true, contentHashesVerified: true }, null, 2));
