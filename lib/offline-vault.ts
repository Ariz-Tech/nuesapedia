"use client";

import type { CourseMaterialItem } from "./saved-client";
import { getMaterialDownloadUrl, isVideoMaterial } from "./saved-client";

const DB_NAME = "nuesapedia_offline_db";
const DB_VERSION = 2;
const DOCS_STORE = "offline_documents";
const CATALOG_STORE = "catalog_cache";
const PROGRESS_STORE = "reading_progress";

export const OFFLINE_VAULT_EVENT = "nuesa-offline-vault-changed";

export interface OfflineDocumentRecord {
  id: string;
  material: CourseMaterialItem;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  savedAt: string;
}

export interface ReadingProgressRecord {
  id: string;
  percentage: number;
  page: number;
  updatedAt: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getSafeDocumentFilename(material: CourseMaterialItem): string {
  if (material.fileName) {
    const safe = material.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (safe.includes(".")) return safe;
  }
  const base = `${material.courseCode}_${material.title}`
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 90);
  return `${base || "nuesapedia_resource"}.pdf`;
}

export const getSafePdfFilename = getSafeDocumentFilename;

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Failed to open IndexedDB."));
  });
}

export async function estimateVaultStorage(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
} | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return null;
  }
  try {
    const est = await navigator.storage.estimate();
    const usageBytes = est.usage ?? 0;
    const quotaBytes = est.quota ?? 0;
    return {
      usageBytes,
      quotaBytes,
      availableBytes: Math.max(0, quotaBytes - usageBytes),
    };
  } catch {
    return null;
  }
}

export function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function saveOfflineDocument(
  material: CourseMaterialItem,
  blob: Blob
): Promise<OfflineDocumentRecord> {
  const est = await estimateVaultStorage();
  if (est && est.quotaBytes > 0 && blob.size + 5 * 1024 * 1024 > est.availableBytes) {
    throw new Error(
      `Insufficient device storage (${formatBytes(est.availableBytes)} free). Clear older offline PDFs in Saved -> Offline Vault first.`
    );
  }

  const canonicalId = material.resourceId || material.id;
  const record: OfflineDocumentRecord = {
    id: canonicalId,
    material: { ...material, id: canonicalId, resourceId: canonicalId },
    blob,
    mimeType: blob.type || "application/pdf",
    sizeBytes: blob.size,
    filename: getSafePdfFilename(material),
    savedAt: new Date().toISOString(),
  };

  const db = await openVaultDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOCS_STORE, "readwrite");
      tx.objectStore(DOCS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        if (tx.error?.name === "QuotaExceededError") {
          reject(
            new Error(
              "Device offline storage is full. Please remove some offline documents in your Offline Vault."
            )
          );
        } else {
          reject(tx.error || new Error("Failed to save document offline."));
        }
      };
    });
  } finally {
    db.close();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
  }
  return record;
}

export async function getOfflineDocument(
  id: string
): Promise<OfflineDocumentRecord | null> {
  try {
    const db = await openVaultDb();
    try {
      return await new Promise<OfflineDocumentRecord | null>((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readonly");
        const req = tx.objectStore(DOCS_STORE).get(id);
        req.onsuccess = () => resolve((req.result as OfflineDocumentRecord) || null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function getAllOfflineDocuments(): Promise<OfflineDocumentRecord[]> {
  try {
    const db = await openVaultDb();
    try {
      const records = await new Promise<OfflineDocumentRecord[]>(
        (resolve, reject) => {
          const tx = db.transaction(DOCS_STORE, "readonly");
          const req = tx.objectStore(DOCS_STORE).getAll();
          req.onsuccess = () =>
            resolve((req.result as OfflineDocumentRecord[]) || []);
          req.onerror = () => reject(req.error);
        }
      );
      return records.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      );
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function removeOfflineDocument(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readwrite");
        tx.objectStore(DOCS_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
    }
  } catch {
    // Ignore
  }
}

export async function clearAllOfflineDocuments(): Promise<void> {
  try {
    const db = await openVaultDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DOCS_STORE, "readwrite");
        tx.objectStore(DOCS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
    }
  } catch {
    // Ignore
  }
}

export async function clearLocalReadingProgress(): Promise<void> {
  try {
    const db = await openVaultDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PROGRESS_STORE, "readwrite");
        tx.objectStore(PROGRESS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
    }
  } catch {
    // Ignore
  }
}

export async function downloadAndCacheMaterial(
  material: CourseMaterialItem,
  options?: { saveToDevice?: boolean; signal?: AbortSignal }
): Promise<{ ok: boolean; fromCache: boolean; error?: string }> {
  const saveToDevice = options?.saveToDevice !== false;
  const canonicalId = material.resourceId || material.id;

  if (isVideoMaterial(material)) {
    const targetUrl =
      material.youtubeUrl ||
      (material.youtubeVideoId
        ? `https://www.youtube.com/watch?v=${material.youtubeVideoId}`
        : material.fileUrl);
    if (targetUrl && typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      return { ok: true, fromCache: false };
    }
    return { ok: false, fromCache: false, error: "Video URL unavailable." };
  }

  const cached = await getOfflineDocument(canonicalId);
  if (cached) {
    if (saveToDevice) {
      triggerBrowserBlobDownload(cached.blob, cached.filename);
    }
    return { ok: true, fromCache: true };
  }

  try {
    const metaRes = await fetch(
      `/api/resources/${encodeURIComponent(canonicalId)}/download?format=json`,
      { signal: options?.signal }
    );
    if (!metaRes.ok) {
      return {
        ok: false,
        fromCache: false,
        error: "Unable to authorize resource download.",
      };
    }

    const meta = await metaRes.json();
    const targetUrl: string =
      meta?.downloadUrl || getMaterialDownloadUrl(material);

    const fileRes = await fetch(targetUrl, { signal: options?.signal });
    if (!fileRes.ok) {
      throw new Error(`HTTP ${fileRes.status}`);
    }

    const blob = await fileRes.blob();
    const docBlob = blob;
    const saved = await saveOfflineDocument(material, docBlob);
    if (saveToDevice) {
      triggerBrowserBlobDownload(saved.blob, saved.filename);
    }
    return { ok: true, fromCache: false };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      return { ok: false, fromCache: false, error: "Download cancelled." };
    }
    if (saveToDevice && typeof window !== "undefined") {
      window.open(getMaterialDownloadUrl(material), "_blank", "noopener,noreferrer");
      return { ok: true, fromCache: false };
    }
    return {
      ok: false,
      fromCache: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to download document for offline study.",
    };
  }
}

export async function cacheCatalogResources(
  items: CourseMaterialItem[]
): Promise<void> {
  try {
    const db = await openVaultDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CATALOG_STORE, "readwrite");
        const store = tx.objectStore(CATALOG_STORE);
        store.clear();
        for (const item of items.slice(0, 200)) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Ignore
  }
}

export async function getCachedCatalogResources(): Promise<CourseMaterialItem[]> {
  try {
    const db = await openVaultDb();
    try {
      return await new Promise<CourseMaterialItem[]>((resolve, reject) => {
        const tx = db.transaction(CATALOG_STORE, "readonly");
        const req = tx.objectStore(CATALOG_STORE).getAll();
        req.onsuccess = () =>
          resolve((req.result as CourseMaterialItem[]) || []);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function saveReadingProgress(
  resourceId: string,
  percentage: number,
  page: number = 1
): Promise<void> {
  const clampedPct = Math.max(0, Math.min(100, Math.round(percentage)));
  const clampedPage = Math.max(1, Math.round(page));
  const record: ReadingProgressRecord = {
    id: resourceId,
    percentage: clampedPct,
    page: clampedPage,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openVaultDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PROGRESS_STORE, "readwrite");
        tx.objectStore(PROGRESS_STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(OFFLINE_VAULT_EVENT));
    }
  } catch {
    // Ignore IndexedDB error
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    fetch(`/api/resources/${encodeURIComponent(resourceId)}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentage: clampedPct, page: clampedPage }),
    }).catch(() => {});
  }
}

export async function getReadingProgress(
  resourceId: string
): Promise<ReadingProgressRecord | null> {
  try {
    const db = await openVaultDb();
    try {
      return await new Promise<ReadingProgressRecord | null>(
        (resolve, reject) => {
          const tx = db.transaction(PROGRESS_STORE, "readonly");
          const req = tx.objectStore(PROGRESS_STORE).get(resourceId);
          req.onsuccess = () =>
            resolve((req.result as ReadingProgressRecord) || null);
          req.onerror = () => reject(req.error);
        }
      );
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function getAllReadingProgress(): Promise<ReadingProgressRecord[]> {
  try {
    const db = await openVaultDb();
    try {
      const records = await new Promise<ReadingProgressRecord[]>(
        (resolve, reject) => {
          const tx = db.transaction(PROGRESS_STORE, "readonly");
          const req = tx.objectStore(PROGRESS_STORE).getAll();
          req.onsuccess = () =>
            resolve((req.result as ReadingProgressRecord[]) || []);
          req.onerror = () => reject(req.error);
        }
      );
      return records.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}
