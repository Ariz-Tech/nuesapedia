"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
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
    options?: { saveToDevice?: boolean }
  ) => Promise<{ ok: boolean; fromCache: boolean; error?: string }>;
  removeOffline: (id: string) => Promise<void>;
  clearOfflineVault: () => Promise<void>;
  recentReadingIds: string[];
  isOffline: boolean;
}

const SavedResourcesContext = createContext<SavedResourcesContextValue | null>(null);

export function SavedResourcesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [savedItems, setSavedItems] = useState<CourseMaterialItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loadingSaved, setLoadingSaved] = useState<boolean>(true);

  const [offlineDocs, setOfflineDocs] = useState<OfflineDocumentRecord[]>([]);
  const [recentReadingIds, setRecentReadingIds] = useState<string[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const refreshOfflineVault = useCallback(async () => {
    const [docs, reading] = await Promise.all([
      getAllOfflineDocuments(),
      getAllReadingProgress(),
    ]);
    setOfflineDocs(docs);
    setRecentReadingIds(reading.map((r) => r.id));
  }, []);

  const refreshSaved = useCallback(async (catalogLookup?: CourseMaterialItem[]) => {
    try {
      const result = await fetchSavedMaterials(catalogLookup);
      setSavedItems(result.items);
      setIsAuthenticated(result.isAuthenticated);
    } catch {
      setSavedItems(readLocalSaved());
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  // Sync online/offline connectivity status
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load initial saved bookmarks & offline documents, and re-sync when auth user changes
  useEffect(() => {
    refreshSaved();
    refreshOfflineVault();
  }, [user?.id, refreshSaved, refreshOfflineVault]);

  // Listen to cross-component & cross-tab updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSavedChanged = () => {
      setSavedItems(readLocalSaved());
    };
    const handleOfflineChanged = () => {
      refreshOfflineVault();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "nuesapedia_saved_materials_v1") {
        setSavedItems(readLocalSaved());
      }
    };

    window.addEventListener(SAVED_MATERIALS_EVENT, handleSavedChanged);
    window.addEventListener(OFFLINE_VAULT_EVENT, handleOfflineChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(SAVED_MATERIALS_EVENT, handleSavedChanged);
      window.removeEventListener(OFFLINE_VAULT_EVENT, handleOfflineChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshOfflineVault]);

  const savedIds = useMemo(
    () => new Set(savedItems.map((i) => i.resourceId || i.id)),
    [savedItems]
  );

  const offlineIds = useMemo(
    () => new Set(offlineDocs.map((d) => d.id)),
    [offlineDocs]
  );

  const isSaved = useCallback(
    (id: string) => savedIds.has(id),
    [savedIds]
  );

  const isOfflineAvailable = useCallback(
    (id: string) => offlineIds.has(id),
    [offlineIds]
  );

  const toggleSave = useCallback(
    async (item: CourseMaterialItem): Promise<boolean> => {
      const key = item.resourceId || item.id;
      if (savedIds.has(key)) {
        await removeMaterialBookmark(key);
        setSavedItems((prev) => prev.filter((x) => (x.resourceId || x.id) !== key));
        return false;
      } else {
        await saveMaterialBookmark(item);
        setSavedItems(readLocalSaved());
        return true;
      }
    },
    [savedIds]
  );

  const removeSaved = useCallback(async (id: string): Promise<void> => {
    await removeMaterialBookmark(id);
    setSavedItems((prev) => prev.filter((x) => (x.resourceId || x.id) !== id));
  }, []);

  const downloadMaterial = useCallback(
    async (
      item: CourseMaterialItem,
      options: { saveToDevice?: boolean } = { saveToDevice: true }
    ) => {
      const key = item.resourceId || item.id;
      setDownloadingIds((prev) => new Set(prev).add(key));
      try {
        const res = await downloadAndCacheMaterial(item, options);
        await refreshOfflineVault();
        return res;
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
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

  const offlineTotalBytes = useMemo(
    () => offlineDocs.reduce((sum, doc) => sum + (doc.sizeBytes || 0), 0),
    [offlineDocs]
  );

  const value = useMemo<SavedResourcesContextValue>(
    () => ({
      savedItems,
      savedIds,
      savedCount: savedIds.size,
      isAuthenticated: Boolean(user) || isAuthenticated,
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
      user,
      isAuthenticated,
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
    throw new Error("useSavedResources must be used inside SavedResourcesProvider");
  }
  return ctx;
}

