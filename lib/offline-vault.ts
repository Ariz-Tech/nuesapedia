"use client";

import {
  type CourseMaterialItem,
  normalizeMaterial,
  getMaterialDownloadUrl,
} from "@/lib/saved-client";

const DB_NAME = "nuesapedia_offline_db";
const DB_VERSION = 1;

const STORE_DOWNLOADS = "downloads";
const STORE_RESOURCES = "resources";
const STORE_READING = "reading";

export const OFFLINE_VAULT_EVENT = "nuesa-offline-vault-changed";

export interface OfflineDocumentRecord {
  id: string;
  material: CourseMaterialItem;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: string;
}

export interface ReadingProgressRecord {
  id: string;
  percentage: number;
  page: number;
  updatedAt: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "PDF Document";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSafePdfFilename(material: CourseMaterialItem): string {
  const raw =
    material.fileName ||
    `${material.courseCode || "ENG"}_${material.title || "Course_Material"}.pdf`;
  const withExt = raw.toLowerCase().endsWith(".pdf") ? raw : `${raw}.pdf`;
  return withExt.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function notifyVaultUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
  }
}

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
          db.createObjectStore(STORE_DOWNLOADS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_RESOURCES)) {
          db.createObjectStore(STORE_RESOURCES, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_READING)) {
          db.createObjectStore(STORE_READING, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 15000);
}

/**
 * Store a downloaded PDF Blob + full CourseMaterialItem metadata in IndexedDB for offline viewing
 */
export async function saveOfflineDocument(
  material: CourseMaterialItem,
  blob: Blob
): Promise<OfflineDocumentRecord | null> {
  const db = await openOfflineDb();
  if (!db) return null;

  const normalized = normalizeMaterial({
    ...material,
    fileSize:
      material.fileSize && material.fileSize !== "PDF Document"
        ? material.fileSize
        : formatBytes(blob.size),
  });
  const canonicalId = normalized.resourceId || normalized.id;

  const record: OfflineDocumentRecord = {
    id: canonicalId,
    material: { ...normalized, id: canonicalId, resourceId: canonicalId },
    blob,
    mimeType: blob.type || "application/pdf",
    sizeBytes: blob.size,
    downloadedAt: new Date().toISOString(),
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_DOWNLOADS, STORE_RESOURCES], "readwrite");
      tx.objectStore(STORE_DOWNLOADS).put(record);
      tx.objectStore(STORE_RESOURCES).put(record.material);
      tx.oncomplete = () => {
        notifyVaultUpdated();
        resolve(record);
      };
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Retrieve a single downloaded document record (including binary Blob) by resource ID
 */
export async function getOfflineDocument(id: string): Promise<OfflineDocumentRecord | null> {
  const db = await openOfflineDb();
  if (!db || !id) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DOWNLOADS, "readonly");
      const req = tx.objectStore(STORE_DOWNLOADS).get(id);
      req.onsuccess = () => resolve((req.result as OfflineDocumentRecord) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * List all downloaded documents stored in IndexedDB (sorted newest first)
 */
export async function getAllOfflineDocuments(): Promise<OfflineDocumentRecord[]> {
  const db = await openOfflineDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DOWNLOADS, "readonly");
      const req = tx.objectStore(STORE_DOWNLOADS).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as OfflineDocumentRecord[]) : [];
        list.sort((a, b) => (b.downloadedAt || "").localeCompare(a.downloadedAt || ""));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Delete a downloaded document from IndexedDB offline storage
 */
export async function removeOfflineDocument(id: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db || !id) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DOWNLOADS, "readwrite");
      tx.objectStore(STORE_DOWNLOADS).delete(id);
      tx.oncomplete = () => {
        notifyVaultUpdated();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all downloaded PDF Blobs from IndexedDB offline storage
 */
export async function clearAllOfflineDocuments(): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DOWNLOADS, "readwrite");
      tx.objectStore(STORE_DOWNLOADS).clear();
      tx.oncomplete = () => {
        notifyVaultUpdated();
        resolve();
      };
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Download a PDF resource to the user's device AND cache its binary Blob in IndexedDB
 * so the user can view and re-download the document completely offline.
 */
export async function downloadAndCacheMaterial(
  material: CourseMaterialItem,
  options: { saveToDevice?: boolean } = { saveToDevice: true }
): Promise<{ ok: boolean; fromCache: boolean; error?: string }> {
  const saveToDevice = options.saveToDevice !== false;
  const canonicalId = material.resourceId || material.id;
  const filename = getSafePdfFilename(material);

  // 1. Check if already cached in IndexedDB
  const existing = await getOfflineDocument(canonicalId);
  if (existing && existing.blob && existing.blob.size > 0) {
    if (saveToDevice) {
      triggerBrowserBlobDownload(existing.blob, filename);
    }
    // Best-effort download count ping if online
    if (typeof navigator !== "undefined" && navigator.onLine) {
      fetch(`/api/resources/${encodeURIComponent(canonicalId)}/download?format=json`, {
        method: "GET",
      }).catch(() => {});
    }
    return { ok: true, fromCache: true };
  }

  // 2. If offline and not yet cached, cannot fetch for the first time
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      ok: false,
      fromCache: false,
      error: "You are offline and this document has not been downloaded yet.",
    };
  }

  // 3. Fetch PDF binary from same-origin proxy download endpoint
  try {
    const proxyUrl = `${getMaterialDownloadUrl(material)}?proxy=1`;
    let response = await fetch(proxyUrl);

    if (!response.ok && material.fileUrl) {
      response = await fetch(material.fileUrl);
    }

    if (!response.ok) {
      // Fallback to standard browser navigation if fetch fails
      if (saveToDevice && typeof window !== "undefined") {
        window.location.assign(getMaterialDownloadUrl(material));
      }
      return { ok: false, fromCache: false, error: "Could not cache PDF for offline viewing." };
    }

    const rawBlob = await response.blob();
    const pdfBlob =
      rawBlob.type && rawBlob.type !== "application/octet-stream"
        ? rawBlob
        : new Blob([rawBlob], { type: "application/pdf" });

    await saveOfflineDocument(material, pdfBlob);

    if (saveToDevice) {
      triggerBrowserBlobDownload(pdfBlob, filename);
    }

    return { ok: true, fromCache: false };
  } catch {
    if (saveToDevice && typeof window !== "undefined" && navigator.onLine) {
      window.location.assign(getMaterialDownloadUrl(material));
    }
    return { ok: false, fromCache: false, error: "Failed to download document." };
  }
}

/**
 * Cache catalog metadata list in IndexedDB so /resources works offline
 */
export async function cacheCatalogResources(items: CourseMaterialItem[]): Promise<void> {
  const db = await openOfflineDb();
  if (!db || items.length === 0) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RESOURCES, "readwrite");
      const store = tx.objectStore(STORE_RESOURCES);
      for (const item of items) {
        const normalized = normalizeMaterial(item);
        store.put(normalized);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Read cached catalog metadata from IndexedDB (merged with any downloaded documents)
 */
export async function getCachedCatalogResources(): Promise<CourseMaterialItem[]> {
  const db = await openOfflineDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_RESOURCES, STORE_DOWNLOADS], "readonly");
      const resReq = tx.objectStore(STORE_RESOURCES).getAll();
      const dlReq = tx.objectStore(STORE_DOWNLOADS).getAll();

      tx.oncomplete = () => {
        const map = new Map<string, CourseMaterialItem>();
        const catList = Array.isArray(resReq.result)
          ? (resReq.result as CourseMaterialItem[])
          : [];
        for (const item of catList) {
          const norm = normalizeMaterial(item);
          map.set(norm.id, norm);
        }
        const dlList = Array.isArray(dlReq.result)
          ? (dlReq.result as OfflineDocumentRecord[])
          : [];
        for (const rec of dlList) {
          if (rec?.material) {
            const norm = normalizeMaterial(rec.material);
            map.set(norm.id, norm);
          }
        }
        resolve(Array.from(map.values()));
      };
      tx.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Persist reading progress locally (and sync to server if online)
 */
export async function saveReadingProgress(
  resourceId: string,
  percentage: number,
  page = 1
): Promise<void> {
  const db = await openOfflineDb();
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const record: ReadingProgressRecord = {
    id: resourceId,
    percentage: clamped,
    page: Math.max(1, Math.round(page)),
    updatedAt: new Date().toISOString(),
  };

  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_READING, "readwrite");
        tx.objectStore(STORE_READING).put(record);
        tx.oncomplete = () => {
          notifyVaultUpdated();
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    fetch(`/api/resources/${encodeURIComponent(resourceId)}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentage: record.percentage, page: record.page }),
    }).catch(() => {});
  }
}

export async function getReadingProgress(
  resourceId: string
): Promise<ReadingProgressRecord | null> {
  const db = await openOfflineDb();
  if (!db || !resourceId) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_READING, "readonly");
      const req = tx.objectStore(STORE_READING).get(resourceId);
      req.onsuccess = () => resolve((req.result as ReadingProgressRecord) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getAllReadingProgress(): Promise<ReadingProgressRecord[]> {
  const db = await openOfflineDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_READING, "readonly");
      const req = tx.objectStore(STORE_READING).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as ReadingProgressRecord[]) : [];
        list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

