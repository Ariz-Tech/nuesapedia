import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const source = path.join(rootDir, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destination = path.join(rootDir, "public", "pdf.worker.min.mjs");

if (!fs.existsSync(source)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found at", source);
  process.exit(0);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
console.log("[copy-pdf-worker] Copied pdf.worker.min.mjs to public/pdf.worker.min.mjs");
