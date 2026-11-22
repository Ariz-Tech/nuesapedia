"use client";

import type { CourseMaterialItem } from "./saved-client";
import { getMaterialDownloadUrl, isVideoMaterial } from "./saved-client";
import { formatBytes } from "./format";

// Re-exported from the shared formatter so client and server output stay in sync.
export { formatBytes };

const DB_NAME = "nuesapedia_offline_db";
const DB_VERSION = 3;
const DOCS_STORE = "offline_documents";
const DOCS_META_STORE = "offline_metadata";
const CATALOG_STORE = "catalog_cache";
const PROGRESS_STORE = "reading_progress";

export const OFFLINE_VAULT_EVENT = "nuesa-offline-vault-changed";
export const READING_PROGRESS_EVENT = "nuesa-reading-progress-changed";

export interface OfflineDocumentMeta {
  id: string;
  material: CourseMaterialItem;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  savedAt: string;
}

export interface OfflineDocumentRecord extends OfflineDocumentMeta {
  blob: Blob;
}

export interface ReadingProgressRecord {
  id: string;
  percentage: number;
  page: number;
  updatedAt: string;
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

// Singleton cached IndexedDB connection avoids open/close thrashing on every operation.
let sharedDbPromise: Promise<IDBDatabase> | null = null;

function openVaultDb(): Promise<IDBDatabase> {
  if (sharedDbPromise) {
    return sharedDbPromise;
  }

  sharedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      sharedDbPromise = null;
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DOCS_META_STORE)) {
        const metaStore = db.createObjectStore(DOCS_META_STORE, { keyPath: "id" });
        // Backfill lightweight metadata from existing v2 blob records during upgrade
        const tx = request.transaction;
        if (tx && db.objectStoreNames.contains(DOCS_STORE)) {
          const docsStore = tx.objectStore(DOCS_STORE);
          const cursorReq = docsStore.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const rec = cursor.value as OfflineDocumentRecord;
            if (rec && rec.id) {
              metaStore.put({
                id: rec.id,
                material: rec.material,
                mimeType: rec.mimeType || "application/pdf",
                sizeBytes: rec.sizeBytes || rec.blob?.size || 0,
                filename: rec.filename,
                savedAt: rec.savedAt,
              } satisfies OfflineDocumentMeta);
            }
            cursor.continue();
          };
        }
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        sharedDbPromise = null;
      };
      db.onclose = () => {
        sharedDbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      sharedDbPromise = null;
      reject(request.error || new Error("Failed to open IndexedDB."));
    };
  });

  return sharedDbPromise;
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
  const meta: OfflineDocumentMeta = {
    id: canonicalId,
    material: { ...material, id: canonicalId, resourceId: canonicalId },
    mimeType: blob.type || "application/pdf",
    sizeBytes: blob.size,
    filename: getSafePdfFilename(material),
    savedAt: new Date().toISOString(),
  };
  const record: OfflineDocumentRecord = {
    ...meta,
    blob,
  };

  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([DOCS_STORE, DOCS_META_STORE], "readwrite");
    tx.objectStore(DOCS_STORE).put(record);
    tx.objectStore(DOCS_META_STORE).put(meta);
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
    return await new Promise<OfflineDocumentRecord | null>((resolve, reject) => {
      const tx = db.transaction(DOCS_STORE, "readonly");
      const req = tx.objectStore(DOCS_STORE).get(id);
      req.onsuccess = () => resolve((req.result as OfflineDocumentRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Returns ONLY lightweight document metadata (no multi-MB PDF Blobs in RAM)
 * for global React state, badges, and offline vault listing.
 */
export async function getAllOfflineDocumentMeta(): Promise<OfflineDocumentMeta[]> {
  try {
    const db = await openVaultDb();
    const records = await new Promise<OfflineDocumentMeta[]>((resolve, reject) => {
      const tx = db.transaction(DOCS_META_STORE, "readonly");
      const req = tx.objectStore(DOCS_META_STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as OfflineDocumentMeta[]) || []);
      req.onerror = () => reject(req.error);
    });
    return records.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * @deprecated Prefer `getAllOfflineDocumentMeta()` for listing and `getOfflineDocument(id)`
 * to load a single Blob on demand. Kept for backwards compatibility.
 */
export async function getAllOfflineDocuments(): Promise<OfflineDocumentMeta[]> {
  return getAllOfflineDocumentMeta();
}

export async function removeOfflineDocument(id: string): Promise<void> {
  try {
    const db = await openVaultDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DOCS_STORE, DOCS_META_STORE], "readwrite");
      tx.objectStore(DOCS_STORE).delete(id);
      tx.objectStore(DOCS_META_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DOCS_STORE, DOCS_META_STORE], "readwrite");
      tx.objectStore(DOCS_STORE).clear();
      tx.objectStore(DOCS_META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROGRESS_STORE, "readwrite");
      tx.objectStore(PROGRESS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(READING_PROGRESS_EVENT));
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
    const saved = await saveOfflineDocument(material, blob);
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
  } catch {
    // Ignore
  }
}

export async function getCachedCatalogResources(): Promise<CourseMaterialItem[]> {
  try {
    const db = await openVaultDb();
    return await new Promise<CourseMaterialItem[]>((resolve, reject) => {
      const tx = db.transaction(CATALOG_STORE, "readonly");
      const req = tx.objectStore(CATALOG_STORE).getAll();
      req.onsuccess = () =>
        resolve((req.result as CourseMaterialItem[]) || []);
      req.onerror = () => reject(req.error);
    });
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROGRESS_STORE, "readwrite");
      tx.objectStore(PROGRESS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== "undefined") {
      // Dedicated event so reading progress updates never trigger offline-vault reloads
      window.dispatchEvent(new CustomEvent(READING_PROGRESS_EVENT));
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
    return await new Promise<ReadingProgressRecord | null>(
      (resolve, reject) => {
        const tx = db.transaction(PROGRESS_STORE, "readonly");
        const req = tx.objectStore(PROGRESS_STORE).get(resourceId);
        req.onsuccess = () =>
          resolve((req.result as ReadingProgressRecord) || null);
        req.onerror = () => reject(req.error);
      }
    );
  } catch {
    return null;
  }
}

/**
 * Hydrates reading progress across devices by reconciling IndexedDB with
 * `GET /api/resources/:id/progress` for signed-in users.
 * Picks the newer record by `updatedAt` (or server when local has none),
 * persists the winner locally, and silently returns local state for guests/offline.
 */
export async function syncReadingProgress(
  resourceId: string
): Promise<ReadingProgressRecord | null> {
  const local = await getReadingProgress(resourceId);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return local;
  }

  try {
    const res = await fetch(
      `/api/resources/${encodeURIComponent(resourceId)}/progress`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return local;
    }

    const data = await res.json().catch(() => null);
    const remote = data?.progress;
    if (
      !data?.success ||
      !remote ||
      (!remote.updatedAt && (remote.percentage ?? 0) === 0 && (remote.page ?? 1) <= 1)
    ) {
      // Server has no saved progress yet; push local progress up if present
      if (local && (local.percentage > 0 || local.page > 1)) {
        fetch(`/api/resources/${encodeURIComponent(resourceId)}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            percentage: local.percentage,
            page: local.page,
          }),
        }).catch(() => {});
      }
      return local;
    }

    const remoteRecord: ReadingProgressRecord = {
      id: resourceId,
      percentage: Math.max(0, Math.min(100, Math.round(Number(remote.percentage) || 0))),
      page: Math.max(1, Math.round(Number(remote.page) || 1)),
      updatedAt:
        typeof remote.updatedAt === "string" && remote.updatedAt
          ? remote.updatedAt
          : new Date().toISOString(),
    };

    const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const remoteTime = new Date(remoteRecord.updatedAt).getTime();

    if (!local || remoteTime >= localTime) {
      try {
        const db = await openVaultDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(PROGRESS_STORE, "readwrite");
          tx.objectStore(PROGRESS_STORE).put(remoteRecord);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(READING_PROGRESS_EVENT));
        }
      } catch {
        // Ignore IndexedDB error
      }
      return remoteRecord;
    }

    // Local progress is newer — push up to server so other devices catch up
    fetch(`/api/resources/${encodeURIComponent(resourceId)}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percentage: local.percentage,
        page: local.page,
      }),
    }).catch(() => {});
    return local;
  } catch {
    return local;
  }
}

export async function getAllReadingProgress(): Promise<ReadingProgressRecord[]> {
  try {
    const db = await openVaultDb();
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
  } catch {
    return [];
  }
}
