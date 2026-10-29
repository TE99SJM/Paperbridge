import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const fullName = `Paperbridge-Opera-GX-v${pkg.version}`;
const name = `Paperbridge-Local-Install-v${pkg.version}`;
const release = path.join(root, "release");
const baseline = await JSZip.loadAsync(await fs.readFile(path.join(release, fullName + ".zip")), { checkCRC32: true });
const zip = new JSZip(), files = new Map();
const hash = data => createHash("sha256").update(data).digest("hex");
const forbidden = /(^|\/)(?:node_modules|qa|preview|release|\.git|\.env[^/]*|session[^/]*|credentials[^/]*|[^/]*\.(?:log|pem|key))(\/|$)/i;
async function collect(relative = "") {
  const full = path.join(root, "extension", relative);
  const stat = await fs.lstat(full);
  assert.ok(!stat.isSymbolicLink(), "Release cannot contain symlinks");
  if (stat.isDirectory()) {
    for (const child of (await fs.readdir(full)).sort()) await collect(path.posix.join(relative, child));
    return;
  }
  assert.ok(stat.isFile() && !forbidden.test(relative), `Unexpected release file: ${relative}`);
  const bytes = await fs.readFile(full);
  const previous = baseline.file(`${fullName}/extension/${relative}`);
  assert.ok(previous, `Runtime file is not in the tested full release: ${relative}`);
  assert.equal(hash(bytes), hash(await previous.async("nodebuffer")), `Runtime changed: ${relative}`);
  files.set(relative, bytes);
}
await collect();
const baselineRuntime = Object.entries(baseline.files)
  .filter(([file, entry]) => !entry.dir && file.startsWith(`${fullName}/extension/`))
  .map(([file]) => file.slice(`${fullName}/extension/`.length)).sort();
assert.deepEqual([...files.keys()].sort(), baselineRuntime, "No runtime files may be omitted");
const runtimeFiles = files.size;
for (const [from, to] of [
  ["LOCAL_INSTALL.md", "INSTALL.md"],
  ["PRIVACY.md", "PRIVACY.md"],
  ["SECURITY.md", "SECURITY.md"],
  ["LICENSE", "LICENSE"]
]) files.set(to, await fs.readFile(path.join(root, from)));

const manifest = JSON.parse(files.get("manifest.json").toString());
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts, undefined);
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "clipboardWrite", "sidePanel", "scripting", "storage"]);
for (const [file, bytes] of files) zip.file(file, bytes, { unixPermissions: 0o100644 });
zip.file("CHECKSUMS.sha256", [...files].map(([file, bytes]) => `${hash(bytes)}  ${file}`).join("\n") + "\n", { unixPermissions: 0o100644 });
const bytes = await zip.generateAsync({ type: "nodebuffer", platform: "UNIX", compression: "DEFLATE", compressionOptions: { level: 9 } });
const restored = await JSZip.loadAsync(bytes, { checkCRC32: true });
assert.ok(restored.file("manifest.json"), "Manifest must be directly at the ZIP root");
assert.equal(restored.file("extension/manifest.json"), null, "No confusing extra extension folder");
for (const [file, original] of files) assert.equal(hash(await restored.file(file).async("nodebuffer")), hash(original), file);
for (const file of Object.keys(restored.files)) assert.ok(!file.includes("..") && !file.includes("\\") && !forbidden.test(file));
await fs.mkdir(release, { recursive: true });
const archive = path.join(release, name + ".zip");
await fs.writeFile(archive, bytes);
await fs.writeFile(archive + ".sha256", `${hash(bytes)}  ${name}.zip\n`);
console.log(JSON.stringify({ archive, bytes: bytes.length, files: files.size + 1, unchangedRuntimeFiles: runtimeFiles, manifestAtZipRoot: true, crcAndHashesVerified: true, sha256: hash(bytes) }, null, 2));
