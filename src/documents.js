import { MAX_DOCUMENT_CHARS } from "./core.js";
const MAX_BYTES = 10 * 1024 * 1024;

function checkZipBudget(buffer) {
  const data = new DataView(buffer);
  let entries = 0, expanded = 0;
  // Central directory sizes bound decompression before Mammoth sees a DOCX.
  for (let i = 0; i + 46 <= data.byteLength; i++) {
    if (data.getUint32(i, true) !== 0x02014b50) continue;
    entries++;
    expanded += data.getUint32(i + 24, true);
    if (entries > 1500 || expanded > 40 * 1024 * 1024) throw new Error("This DOCX exceeds the decompression safety limit. Export it as plain text instead.");
    i += 45 + data.getUint16(i + 28, true) + data.getUint16(i + 30, true) + data.getUint16(i + 32, true);
  }
  if (!entries) throw new Error("This file is not a readable DOCX archive.");
}

export async function extractDocument(file, progress = () => {}) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: maximum file size is 10 MB.`);
  const extension = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "docx", "txt", "md", "csv"].includes(extension)) throw new Error("Use PDF, DOCX, TXT, Markdown, or CSV. Old .doc files and images must be converted to text first.");
  const buffer = await file.arrayBuffer();
  let text = "", warnings = [];
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", location.href).href;
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer.slice(0)), isEvalSupported: false, useSystemFonts: false,
      disableFontFace: true, useWorkerFetch: false,
      cMapUrl: new URL("cmaps/", location.href).href, cMapPacked: true,
      standardFontDataUrl: new URL("standard_fonts/", location.href).href
    });
    task.onPassword = () => task.destroy();
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 60) throw new Error("PDFs are limited to 60 pages. Split this document first.");
      let blank = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        progress(`Reading ${file.name}, page ${i} of ${pdf.numPages}…`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str + (item.hasEOL ? "\n" : " ")).join("").trim();
        if (pageText.length < 8) blank++;
        text += `\n[Page ${i}]\n${pageText}\n`;
        page.cleanup();
        if (text.length > MAX_DOCUMENT_CHARS) throw new Error("This document has too much text. Split it into smaller files.");
      }
      if (blank === pdf.numPages) throw new Error("No usable PDF text was found. This may be a scan or image. Run OCR elsewhere and upload the searchable PDF or text; OCR is not included.");
      if (blank) warnings.push(`${blank} page(s) have little or no text. Image-only content is not read; check the extracted text.`);
    } finally { await task.destroy(); }
  } else if (extension === "docx") {
    checkZipBudget(buffer);
    const mammothModule = await import("mammoth/mammoth.browser.js");
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer: buffer }, { externalFileAccess: false });
    text = result.value;
    if (result.messages?.length) warnings.push("Some Word formatting was ignored. Review the extracted text.");
  } else text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  text = text.replace(/\u0000/g, "").trim();
  if (!text) throw new Error("The document contains no readable text.");
  if (text.length > MAX_DOCUMENT_CHARS) throw new Error("This document exceeds 250,000 characters. Split it before uploading.");
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
  return {
    id: crypto.randomUUID(), name: file.name.slice(0, 180), text, include: true,
    importedAt: new Date().toISOString(), hash, warnings
  };
}
