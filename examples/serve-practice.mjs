import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
http.createServer(async (req, res) => {
  const requested = new URL(req.url, "http://127.0.0.1:47822").pathname;
  const name = requested === "/" ? "practice-application.html" : requested.slice(1);
  if (!["practice-application.html", "practice.js", "fictional-resume.txt", "workday-style-practice.html", "workday-style-practice.js", "react-practice.html", "react-practice.js"].includes(name) || req.method !== "GET") { res.writeHead(404); res.end("Not found"); return; }
  try {
    const body = await fs.readFile(path.join(root, name));
    res.writeHead(200, { "Content-Type": name.endsWith(".html") ? "text/html" : name.endsWith(".js") ? "text/javascript" : "text/plain", "Cache-Control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Practice file not found. Re-extract the complete download."); }
}).listen(47822, "127.0.0.1", () => console.log("Native form: http://127.0.0.1:47822\nWorkday-style: http://127.0.0.1:47822/workday-style-practice.html\nOpen in Opera GX. Press Ctrl+C to stop."));
