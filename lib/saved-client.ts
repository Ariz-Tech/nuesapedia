"use client";

export interface CourseMaterialItem {
  id: string;
  resourceId?: string;
  title: string;
  courseCode: string;
  department: string;
  level?: string;
  semester?: string;
  sessionYear?: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  downloads?: number;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  description?: string;
  createdAt?: string;
}

const LEGACY_SHARED_KEY = "nuesapedia_saved_materials_v1";
const GUEST_SAVED_KEY = "nuesapedia_saved_guest_v2";
export const SAVED_MATERIALS_EVENT = "nuesa-saved-materials-changed";

function getStorageKey(userId?: string | null): string {
  return userId ? `nuesapedia_saved_user_${userId}` : GUEST_SAVED_KEY;
}

export function extractYoutubeId(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1];
}

export function isVideoMaterial(item: Partial<CourseMaterialItem>): boolean {
  if (item.medium === "YOUTUBE") return true;
  if (item.youtubeVideoId || extractYoutubeId(item.youtubeUrl)) return true;
  if (extractYoutubeId(item.fileUrl)) return true;
  return false;
}

export function getMaterialDownloadUrl(item: {
  id: string;
  resourceId?: string;
}): string {
  const targetId = item.resourceId || item.id;
  return `/api/resources/${encodeURIComponent(targetId)}/download`;
}

export function getMaterialViewUrl(item: {
  id: string;
  resourceId?: string;
  medium?: "PDF" | "YOUTUBE";
  fileUrl?: string;
}): string {
  const targetId = item.resourceId || item.id;
  if (item.medium === "YOUTUBE") {
    return item.fileUrl || "";
  }
  return `/api/resources/${encodeURIComponent(targetId)}/view`;
}

export function normalizeMaterial(
  raw: Partial<CourseMaterialItem> & { id: string }
): CourseMaterialItem {
  const canonicalId = raw.resourceId || raw.id;
  const videoId =
    raw.youtubeVideoId ||
    extractYoutubeId(raw.youtubeUrl) ||
    extractYoutubeId(raw.fileUrl);
  const video = raw.medium === "YOUTUBE" || Boolean(videoId);

  return {
    id: canonicalId,
    resourceId: canonicalId,
    title: raw.title || "Academic Resource",
    courseCode: raw.courseCode || "GEN 101",
    department: raw.department || "General Engineering",
    level: raw.level || "100L",
    semester: raw.semester || "First Semester",
    sessionYear: raw.sessionYear || "2025/2026",
    type: raw.type || "Lecture Notes",
    medium: video ? "YOUTUBE" : "PDF",
    fileUrl: video
      ? raw.youtubeUrl || raw.fileUrl
      : `/api/resources/${encodeURIComponent(canonicalId)}/view`,
    fileName: raw.fileName,
    fileSize: raw.fileSize || (video ? "Streaming Video" : "PDF Document"),
    downloads: typeof raw.downloads === "number" ? raw.downloads : 0,
    youtubeUrl:
      raw.youtubeUrl ||
      (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined),
    youtubeVideoId: videoId,
    thumbnailUrl:
      raw.thumbnailUrl ||
      (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined),
    description: raw.description,
    createdAt: raw.createdAt,
  };
}

export function readLocalSaved(userId?: string | null): CourseMaterialItem[] {
  if (typeof window === "undefined") return [];
  try {
    // Purge legacy un-namespaced storage key to prevent cross-account contamination on shared PCs
    if (window.localStorage.getItem(LEGACY_SHARED_KEY)) {
      window.localStorage.removeItem(LEGACY_SHARED_KEY);
    }

    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string")
      .map((x) => normalizeMaterial(x));
  } catch {
    return [];
  }
}

export function writeLocalSaved(
  items: CourseMaterialItem[],
  userId?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(SAVED_MATERIALS_EVENT));
  } catch {
    // Ignore storage quota errors on localStorage
  }
}

/**
 * Purges user-scoped local bookmark cache on logout so shared campus PCs
 * never leak or cross-sync bookmarks into the next student's account.
 */
export function clearUserSavedCache(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_SHARED_KEY);
    if (userId) {
      window.localStorage.removeItem(getStorageKey(userId));
    }
    window.dispatchEvent(new CustomEvent(SAVED_MATERIALS_EVENT));
  } catch {
    // Ignore
  }
}

export async function fetchSavedMaterials(
  catalogLookup?: CourseMaterialItem[],
  userId?: string | null
): Promise<{ items: CourseMaterialItem[]; isAuthenticated: boolean }> {
  const lookupMap = new Map<string, CourseMaterialItem>();
  if (catalogLookup) {
    for (const c of catalogLookup) {
      lookupMap.set(c.id, c);
      if (c.resourceId) lookupMap.set(c.resourceId, c);
    }
  }

  // Unauthenticated guest mode: read strictly from guest namespace
  if (!userId) {
    const guestItems = readLocalSaved(null).map((item) => {
      const enriched = lookupMap.get(item.resourceId || item.id);
      return enriched ? normalizeMaterial({ ...item, ...enriched }) : item;
    });
    return { items: guestItems, isAuthenticated: false };
  }

  try {
    const res = await fetch("/api/saved", { cache: "no-store" });
    if (res.status === 401) {
      return { items: readLocalSaved(null), isAuthenticated: false };
    }
    if (!res.ok) {
      return { items: readLocalSaved(userId), isAuthenticated: true };
    }

    const data = await res.json();
    const serverSaved: Record<string, unknown>[] = Array.isArray(data?.saved)
      ? data.saved
      : [];

    const normalized = serverSaved.map((raw) => {
      const resourceId = String(raw.resourceId || raw.id);
      const fromCatalog = lookupMap.get(resourceId);
      return normalizeMaterial({
        ...(fromCatalog || {}),
        ...(raw as Partial<CourseMaterialItem>),
        id: resourceId,
        resourceId,
      });
    });

    // Cache under user-namespaced key for offline viewing by THIS user only
    writeLocalSaved(normalized, userId);
    return { items: normalized, isAuthenticated: true };
  } catch {
    return { items: readLocalSaved(userId), isAuthenticated: true };
  }
}

export async function saveMaterialBookmark(
  item: CourseMaterialItem,
  userId?: string | null
): Promise<void> {
  const normalized = normalizeMaterial(item);
  const existing = readLocalSaved(userId);
  const filtered = existing.filter(
    (x) => (x.resourceId || x.id) !== (normalized.resourceId || normalized.id)
  );
  writeLocalSaved([normalized, ...filtered], userId);

  if (!userId) return;

  try {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceId: normalized.resourceId || normalized.id,
        title: normalized.title,
        courseCode: normalized.courseCode,
        department: normalized.department,
        type: normalized.type,
        fileSize: normalized.fileSize,
      }),
    });
  } catch {
    // Offline fallback remains stored in user-scoped localStorage
  }
}

export async function removeMaterialBookmark(
  resourceId: string,
  userId?: string | null
): Promise<void> {
  const existing = readLocalSaved(userId);
  const filtered = existing.filter(
    (x) => x.id !== resourceId && x.resourceId !== resourceId
  );
  writeLocalSaved(filtered, userId);

  if (!userId) return;

  try {
    await fetch(`/api/saved?resourceId=${encodeURIComponent(resourceId)}`, {
      method: "DELETE",
    });
  } catch {
    // Ignore network error while offline
  }
}

export async function shareOrCopyMaterialLink(
  item: Pick<CourseMaterialItem, "id" | "resourceId" | "title" | "courseCode">
): Promise<"shared" | "copied" | "failed"> {
  if (typeof window === "undefined") return "failed";
  const targetId = item.resourceId || item.id;
  const shareUrl = `${window.location.origin}/resources/${encodeURIComponent(targetId)}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${item.courseCode} — ${item.title}`,
        text: `Study ${item.courseCode}: ${item.title} on NUESApedia`,
        url: shareUrl,
      });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "failed";
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    return "copied";
  } catch {
    return "failed";
  }
}
