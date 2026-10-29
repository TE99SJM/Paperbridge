import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import { FileCheck2 } from "lucide";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
process.chdir(root);
await fs.mkdir("extension/assets", { recursive: true });
for (const name of await fs.readdir("extension")) {
  if (/\.(?:js|mjs|map)$/.test(name) || name.startsWith("chunk-")) await fs.rm(path.join("extension", name), { force: true });
}
await build({
  entryPoints: { app: "src/app.js" }, outdir: "extension",
  bundle: true, splitting: true, format: "esm", platform: "browser",
  target: ["chrome120"], minify: true, legalComments: "eof", chunkNames: "chunk-[name]-[hash]",
  logLevel: "info"
});
await build({ entryPoints: ["src/scanner.js"], outfile: "extension/scanner.js", bundle: true, format: "iife", platform: "browser", target: ["chrome120"], minify: true, logLevel: "info" });
await build({ entryPoints: ["src/background.js"], outfile: "extension/background.js", bundle: true, format: "esm", platform: "browser", target: ["chrome120"], minify: true, logLevel: "info" });
await build({ entryPoints: ["helper/server.mjs"], outfile: "helper/paperbridge-helper.mjs", bundle: true, format: "esm", platform: "node", target: ["node20.19"], minify: false, legalComments: "eof", logLevel: "info" });
await build({ entryPoints: ["tests/fixtures/react-practice.jsx"], outfile: "examples/react-practice.js", bundle: true, format: "iife", platform: "browser", target: ["chrome120"], minify: true, define: { "process.env.NODE_ENV": '"production"' }, legalComments: "eof", logLevel: "info" });
await fs.copyFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "extension/pdf.worker.min.mjs");
await fs.cp("node_modules/pdfjs-dist/cmaps", "extension/cmaps", { recursive: true });
await fs.cp("node_modules/pdfjs-dist/standard_fonts", "extension/standard_fonts", { recursive: true });
await fs.copyFile("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", "extension/assets/geist-latin-wght-normal.woff2");
const iconPaths = FileCheck2.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(" ")}/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#315f4d"/><g transform="translate(5 5) scale(.92)" fill="none" stroke="#f7f7ed" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</g></svg>`;
for (const size of [16, 32, 48, 128]) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`extension/assets/icon-${size}.png`);
const packages = [
  ["pdfjs-dist", "LICENSE"], ["mammoth", "LICENSE"], ["jose", "LICENSE.md"],
  ["lucide", "LICENSE"], ["@fontsource-variable/geist", "LICENSE"]
];
let notices = "Paperbridge third-party notices\n\nRuntime source packages and their bundled dependency notices are also retained by esbuild where present.\n\n";
for (const [name, license] of packages) {
  const pkg = JSON.parse(await fs.readFile(`node_modules/${name}/package.json`, "utf8"));
  let text;
  try { text = await fs.readFile(`node_modules/${name}/${license}`, "utf8"); }
  catch {
    const candidate = (await fs.readdir(`node_modules/${name}`)).find(n => /^licen[sc]e/i.test(n));
    text = candidate ? await fs.readFile(`node_modules/${name}/${candidate}`, "utf8") : `License: ${pkg.license}; see package repository ${typeof pkg.repository === "object" ? pkg.repository.url : pkg.repository}`;
  }
  notices += `\n${"=".repeat(68)}\n${name} ${pkg.version}\n${"=".repeat(68)}\n${text}\n`;
}
// Include transitive package license texts as well, without source code or credentials.
for (const name of await fs.readdir("node_modules")) {
  if (name.startsWith(".") || name.startsWith("@") || packages.some(p => p[0] === name)) continue;
  try {
    const pkg = JSON.parse(await fs.readFile(`node_modules/${name}/package.json`, "utf8"));
    if (["esbuild", "playwright", "playwright-core", "sharp"].includes(pkg.name)) continue;
    const license = (await fs.readdir(`node_modules/${name}`)).find(n => /^licen[sc]e(?:\.|$)/i.test(n));
    if (license) notices += `\n${"=".repeat(68)}\n${pkg.name} ${pkg.version}\n${"=".repeat(68)}\n${await fs.readFile(`node_modules/${name}/${license}`, "utf8")}\n`;
  } catch { /* Some node_modules entries are directories without package metadata. */ }
}
await fs.writeFile("extension/THIRD_PARTY_NOTICES.txt", notices);
await fs.copyFile("extension/THIRD_PARTY_NOTICES.txt", "helper/THIRD_PARTY_NOTICES.txt");
await fs.rm("preview", { recursive: true, force: true });
await fs.cp("extension", "preview", { recursive: true, filter: name => !["manifest.json", "background.js", "scanner.js"].includes(path.basename(name)) });
await fs.chmod("helper/start-helper.sh", 0o755);
await fs.chmod("helper/start-helper.command", 0o755);
console.log("Built: extension/ (load unpacked), helper/ (optional ChatGPT sign-in), preview/ (fictional UI demonstration).");
