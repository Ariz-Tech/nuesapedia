import fs from "node:fs";
import os from "node:os";
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
  const preferred = path.join(process.cwd(), "node_modules", ".cache", "mock-r2");
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), "nuesapedia-mock-r2");
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch {
      return preferred;
    }
  }
}

function keyToHash(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function createFallbackPdf(title: string = "The NUESA Library Document"): Uint8Array {
  const cleanTitle = title.replace(/[()\\]/g, " ").replace(/[^\x20-\x7E]/g, " ").slice(0, 72);
  const streamBody = [
    "BT",
    "/F1 16 Tf",
    "50 720 Td",
    `(${cleanTitle}) Tj`,
    "/F1 11 Tf",
    "0 -30 Td",
    "(The NUESA Library - Local Mock Storage Placeholder) Tj",
    "0 -20 Td",
    "(This file is not stored in local mock-r2 cache. If it was uploaded to Cloudflare R2,) Tj",
    "0 -16 Td",
    "(add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY to your .env file.) Tj",
    "ET",
  ].join("\n");
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamBody.length} >>
stream
${streamBody}
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
0000000115 00000 n 
0000000244 00000 n 
0000000600 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
670
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

    // In local development, if an existing resource key is requested (e.g. a row synced from
    // shared PostgreSQL whose binary lives in Cloudflare R2) and local mock storage does not
    // have the file, synthesize an ephemeral fallback PDF without poisoning disk cache.
    if (process.env.NODE_ENV !== "production") {
      const fileName = key.split("/").pop() || "document.pdf";
      const isPdf = fileName.toLowerCase().endsWith(".pdf");
      const title = fileName.replace(/\.[a-zA-Z0-9]+$/i, "").replace(/[_-]/g, " ");
      const bytes = isPdf
        ? createFallbackPdf(title)
        : new TextEncoder().encode(
            `The NUESA Library Local Dev Placeholder: ${title}\nConfigure Cloudflare R2 in .env to view real remote uploads.`
          );
      return {
        bytes,
        sizeBytes: bytes.byteLength,
        uploadedBy: "system-dev-fallback",
        createdAt: Date.now(),
        fileName,
        contentType: isPdf ? "application/pdf" : "text/plain",
      };
    }

    return undefined;
  }

  set(key: string, item: MockStoredPdf): this {
    this.memMap.set(key, item);

    try {
      const hash = keyToHash(key);
      const binPath = path.join(this.dir, `${hash}.bin`);
      const metaPath = path.join(this.dir, `${hash}.json`);

      // Persist synchronously so an immediate `/api/uploads/:id/complete` call in another
      // worker/module never races ahead of disk flush and misses the uploaded file.
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
      fs.unlink(binPath, () => {});
      fs.unlink(metaPath, () => {});
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
