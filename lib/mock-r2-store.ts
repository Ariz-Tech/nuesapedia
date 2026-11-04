import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface MockStoredPdf {
  bytes: Uint8Array;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: number;
  contentType?: string;
  fileName?: string;
}

export type MockStoredFile = MockStoredPdf;

function getStorageDir(): string {
  const dir = path.join(process.cwd(), "node_modules", ".cache", "mock-r2");
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // ignore
  }
  return dir;
}

function keyToHash(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function createFallbackPdf(title: string = "NUESApedia Document"): Uint8Array {
  const cleanTitle = title.replace(/[^\x20-\x7E]/g, " ").slice(0, 80);
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 220 >>
stream
BT
/F1 18 Tf
50 720 Td
(${cleanTitle}) Tj
/F1 12 Tf
0 -30 Td
(NUESApedia - Local Development Mock Storage) Tj
0 -20 Td
(This placeholder document was generated for local testing.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000105 00000 n 
0000000234 00000 n 
0000000506 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
585
%%EOF
`;
  return new TextEncoder().encode(pdfString);
}

class PersistentMockR2Store {
  private memMap: Map<string, MockStoredPdf>;
  private dir: string;

  constructor(memMap: Map<string, MockStoredPdf>) {
    this.memMap = memMap;
    this.dir = getStorageDir();
  }

  get(key: string): MockStoredPdf | undefined {
    if (this.memMap.has(key)) {
      return this.memMap.get(key);
    }

    // Try reading from disk
    try {
      const hash = keyToHash(key);
      const binPath = path.join(this.dir, `${hash}.bin`);
      const metaPath = path.join(this.dir, `${hash}.json`);

      if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        const buf = fs.readFileSync(binPath);
        const item: MockStoredPdf = {
          bytes: new Uint8Array(buf),
          sizeBytes: meta.sizeBytes || buf.length,
          uploadedBy: meta.uploadedBy || "local-user",
          createdAt: meta.createdAt || Date.now(),
          contentType: meta.contentType,
          fileName: meta.fileName,
        };
        this.memMap.set(key, item);
        return item;
      }
    } catch (e) {
      console.warn("[mockR2Store] Failed to read from disk:", e);
    }

    // In local development, if an existing resource key is requested but storage was cleared,
    // synthesize a fallback valid document so the reader/download never breaks with a 404 JSON crash
    if (process.env.NODE_ENV !== "production") {
      const fileName = key.split("/").pop() || "document.pdf";
      const isPdf = fileName.toLowerCase().endsWith(".pdf");
      const title = fileName.replace(/\.[a-zA-Z0-9]+$/i, "").replace(/[_-]/g, " ");
      const bytes = isPdf
        ? createFallbackPdf(title)
        : new TextEncoder().encode(`NUESApedia Local Dev Document: ${title}`);
      const item: MockStoredPdf = {
        bytes,
        sizeBytes: bytes.byteLength,
        uploadedBy: "system-dev-fallback",
        createdAt: Date.now(),
        fileName,
        contentType: isPdf ? "application/pdf" : "text/plain",
      };
      this.set(key, item);
      return item;
    }

    return undefined;
  }

  set(key: string, item: MockStoredPdf): this {
    this.memMap.set(key, item);

    try {
      const hash = keyToHash(key);
      const binPath = path.join(this.dir, `${hash}.bin`);
      const metaPath = path.join(this.dir, `${hash}.json`);

      fs.writeFileSync(binPath, Buffer.from(item.bytes));
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          sizeBytes: item.sizeBytes,
          uploadedBy: item.uploadedBy,
          createdAt: item.createdAt,
          contentType: item.contentType,
          fileName: item.fileName,
        }),
        "utf-8"
      );
    } catch (e) {
      console.warn("[mockR2Store] Failed to persist to disk:", e);
    }

    return this;
  }

  has(key: string): boolean {
    return Boolean(this.get(key));
  }

  delete(key: string): boolean {
    this.memMap.delete(key);
    try {
      const hash = keyToHash(key);
      const binPath = path.join(this.dir, `${hash}.bin`);
      const metaPath = path.join(this.dir, `${hash}.json`);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {
      // ignore
    }
    return true;
  }

  clear(): void {
    this.memMap.clear();
  }
}

const globalForMockR2 = globalThis as unknown as {
  __nuesapediaMockR2Map?: Map<string, MockStoredPdf>;
  __nuesapediaMockR2Store?: PersistentMockR2Store;
};

const rawMap =
  globalForMockR2.__nuesapediaMockR2Map ||
  (globalForMockR2.__nuesapediaMockR2Map = new Map<string, MockStoredPdf>());

export const mockR2Store =
  globalForMockR2.__nuesapediaMockR2Store ||
  (globalForMockR2.__nuesapediaMockR2Store = new PersistentMockR2Store(rawMap));
