"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  type CourseMaterialItem,
  fetchSavedMaterials,
  saveMaterialBookmark,
  removeMaterialBookmark,
  readLocalSaved,
  SAVED_MATERIALS_EVENT,
} from "@/lib/saved-client";
import {
  type OfflineDocumentRecord,
  getAllOfflineDocuments,
  getAllReadingProgress,
  downloadAndCacheMaterial,
  removeOfflineDocument,
  clearAllOfflineDocuments,
  OFFLINE_VAULT_EVENT,
} from "@/lib/offline-vault";
import { useAuth } from "@/context/AuthContext";

interface SavedResourcesContextValue {
  savedItems: CourseMaterialItem[];
  savedIds: Set<string>;
  savedCount: number;
  isAuthenticated: boolean;
  loadingSaved: boolean;
  isSaved: (id: string) => boolean;
  toggleSave: (item: CourseMaterialItem) => Promise<boolean>;
  removeSaved: (id: string) => Promise<void>;
  refreshSaved: (catalogLookup?: CourseMaterialItem[]) => Promise<void>;
  offlineDocs: OfflineDocumentRecord[];
  offlineIds: Set<string>;
  offlineCount: number;
  offlineTotalBytes: number;
  isOfflineAvailable: (id: string) => boolean;
  downloadingIds: Set<string>;
  downloadMaterial: (
    item: CourseMaterialItem,
    options?: { saveToDevice?: boolean; signal?: AbortSignal }
  ) => Promise<{ ok: boolean; fromCache: boolean; error?: string }>;
  removeOffline: (id: string) => Promise<void>;
  clearOfflineVault: () => Promise<void>;
  recentReadingIds: string[];
  isOffline: boolean;
}

const SavedResourcesContext = createContext<SavedResourcesContextValue | null>(
  null
);

function subscribeOnlineStatus(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOfflineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? !navigator.onLine : false;
}

function getServerOfflineSnapshot(): boolean {
  return false;
}

export function SavedResourcesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const activeUserId = user?.id ?? null;

  const [savedItems, setSavedItems] = useState<CourseMaterialItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState<boolean>(true);
  const [offlineDocs, setOfflineDocs] = useState<OfflineDocumentRecord[]>([]);
  const [recentReadingIds, setRecentReadingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOfflineSnapshot,
    getServerOfflineSnapshot
  );

  const refreshOfflineVault = useCallback(async () => {
    const [docs, reading] = await Promise.all([
      getAllOfflineDocuments(),
      getAllReadingProgress(),
    ]);
    setOfflineDocs(docs);
    setRecentReadingIds(reading.map((r) => r.id));
  }, []);

  const refreshSaved = useCallback(
    async (catalogLookup?: CourseMaterialItem[]) => {
      try {
        const result = await fetchSavedMaterials(catalogLookup, activeUserId);
        setSavedItems(result.items);
      } catch {
        setSavedItems(readLocalSaved(activeUserId));
      } finally {
        setLoadingSaved(false);
      }
    },
    [activeUserId]
  );

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      const [savedResult, docs, reading] = await Promise.all([
        fetchSavedMaterials(undefined, activeUserId).catch(() => ({
          items: readLocalSaved(activeUserId),
          isAuthenticated: Boolean(activeUserId),
        })),
        getAllOfflineDocuments(),
        getAllReadingProgress(),
      ]);

      if (!cancelled) {
        setSavedItems(savedResult.items);
        setOfflineDocs(docs);
        setRecentReadingIds(reading.map((r) => r.id));
        setLoadingSaved(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUserId, authLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSavedChanged = () => {
      setSavedItems(readLocalSaved(activeUserId));
    };
    const handleVaultChanged = () => {
      void refreshOfflineVault();
    };

    window.addEventListener(SAVED_MATERIALS_EVENT, handleSavedChanged);
    window.addEventListener(OFFLINE_VAULT_EVENT, handleVaultChanged);
    return () => {
      window.removeEventListener(SAVED_MATERIALS_EVENT, handleSavedChanged);
      window.removeEventListener(OFFLINE_VAULT_EVENT, handleVaultChanged);
    };
  }, [activeUserId, refreshOfflineVault]);

  const savedIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of savedItems) {
      set.add(item.id);
      if (item.resourceId) set.add(item.resourceId);
    }
    return set;
  }, [savedItems]);

  const offlineIds = useMemo(
    () => new Set(offlineDocs.map((d) => d.id)),
    [offlineDocs]
  );

  const offlineTotalBytes = useMemo(
    () => offlineDocs.reduce((acc, doc) => acc + (doc.sizeBytes || 0), 0),
    [offlineDocs]
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const isOfflineAvailable = useCallback(
    (id: string) => offlineIds.has(id),
    [offlineIds]
  );

  const toggleSave = useCallback(
    async (item: CourseMaterialItem): Promise<boolean> => {
      const targetId = item.resourceId || item.id;
      if (savedIds.has(targetId)) {
        await removeMaterialBookmark(targetId, activeUserId);
        return false;
      }
      await saveMaterialBookmark(item, activeUserId);
      return true;
    },
    [savedIds, activeUserId]
  );

  const removeSaved = useCallback(
    async (id: string) => {
      await removeMaterialBookmark(id, activeUserId);
    },
    [activeUserId]
  );

  const downloadMaterial = useCallback(
    async (
      item: CourseMaterialItem,
      options?: { saveToDevice?: boolean; signal?: AbortSignal }
    ) => {
      const targetId = item.resourceId || item.id;
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });

      try {
        const res = await downloadAndCacheMaterial(item, options);
        await refreshOfflineVault();
        return res;
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      }
    },
    [refreshOfflineVault]
  );

  const removeOffline = useCallback(
    async (id: string) => {
      await removeOfflineDocument(id);
      await refreshOfflineVault();
    },
    [refreshOfflineVault]
  );

  const clearOfflineVault = useCallback(async () => {
    await clearAllOfflineDocuments();
    await refreshOfflineVault();
  }, [refreshOfflineVault]);

  const value = useMemo<SavedResourcesContextValue>(
    () => ({
      savedItems,
      savedIds,
      savedCount: savedItems.length,
      isAuthenticated: Boolean(activeUserId),
      loadingSaved,
      isSaved,
      toggleSave,
      removeSaved,
      refreshSaved,
      offlineDocs,
      offlineIds,
      offlineCount: offlineDocs.length,
      offlineTotalBytes,
      isOfflineAvailable,
      downloadingIds,
      downloadMaterial,
      removeOffline,
      clearOfflineVault,
      recentReadingIds,
      isOffline,
    }),
    [
      savedItems,
      savedIds,
      activeUserId,
      loadingSaved,
      isSaved,
      toggleSave,
      removeSaved,
      refreshSaved,
      offlineDocs,
      offlineIds,
      offlineTotalBytes,
      isOfflineAvailable,
      downloadingIds,
      downloadMaterial,
      removeOffline,
      clearOfflineVault,
      recentReadingIds,
      isOffline,
    ]
  );

  return (
    <SavedResourcesContext.Provider value={value}>
      {children}
    </SavedResourcesContext.Provider>
  );
}

export function useSavedResources(): SavedResourcesContextValue {
  const ctx = useContext(SavedResourcesContext);
  if (!ctx) {
    throw new Error(
      "useSavedResources must be used within a SavedResourcesProvider"
    );
  }
  return ctx;
}
