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

const LOCAL_SAVED_KEY = "nuesapedia_saved_materials_v1";
export const SAVED_MATERIALS_EVENT = "nuesa-saved-materials-changed";

/**
 * Reliably extract an 11-character YouTube video ID from either an ID or a URL
 */
export function extractYoutubeId(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1];
}

/**
 * Determine if a resource item is a video material
 */
export function isVideoMaterial(item: Partial<CourseMaterialItem>): boolean {
  if (item.medium === "YOUTUBE") return true;
  if (item.youtubeVideoId || item.youtubeUrl) return true;
  const t = (item.type || "").toLowerCase();
  return t.includes("video") || t.includes("youtube");
}

/**
 * Build the direct download endpoint URL for a downloadable resource
 */
export function getMaterialDownloadUrl(item: { id: string; resourceId?: string }): string {
  const targetId = item.resourceId || item.id;
  return `/api/resources/${encodeURIComponent(targetId)}/download`;
}

/**
 * Normalize raw API resource / saved item into a consistent CourseMaterialItem
 */
export function normalizeMaterial(raw: Partial<CourseMaterialItem> & { id: string }): CourseMaterialItem {
  const canonicalId = raw.resourceId || raw.id;
  const ytId = extractYoutubeId(raw.youtubeVideoId) || extractYoutubeId(raw.youtubeUrl);
  const video = raw.medium === "YOUTUBE" || Boolean(ytId) || isVideoMaterial(raw);

  return {
    id: canonicalId,
    resourceId: canonicalId,
    title: raw.title || "Untitled Course Material",
    courseCode: (raw.courseCode || "ENG").trim().toUpperCase(),
    department: raw.department || "Faculty of Engineering",
    level: raw.level || "All Levels",
    semester: raw.semester || "First Semester",
    sessionYear: raw.sessionYear,
    type: raw.type || (video ? "Video Tutorial" : "Lecture Note"),
    medium: video ? "YOUTUBE" : "PDF",
    fileUrl: raw.fileUrl,
    fileName: raw.fileName,
    fileSize: raw.fileSize || (video ? "Video Stream" : "PDF Document"),
    downloads: typeof raw.downloads === "number" ? raw.downloads : 0,
    youtubeUrl: raw.youtubeUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined),
    youtubeVideoId: ytId,
    thumbnailUrl:
      raw.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined),
    description: raw.description,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export function readLocalSaved(): CourseMaterialItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CourseMaterialItem => Boolean(item && (item.id || item.resourceId)))
      .map((item) => normalizeMaterial(item));
  } catch {
    return [];
  }
}

export function writeLocalSaved(items: CourseMaterialItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(SAVED_MATERIALS_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Load saved materials from server (if authenticated) merged with local metadata cache,
 * falling back seamlessly to localStorage for guest users.
 */
export async function fetchSavedMaterials(
  catalogLookup?: CourseMaterialItem[]
): Promise<{ items: CourseMaterialItem[]; isAuthenticated: boolean }> {
  const localItems = readLocalSaved();
  const localMap = new Map<string, CourseMaterialItem>();
  for (const item of localItems) {
    localMap.set(item.resourceId || item.id, item);
  }

  const catalogMap = new Map<string, CourseMaterialItem>();
  if (catalogLookup) {
    for (const item of catalogLookup) {
      catalogMap.set(item.id, item);
    }
  }

  try {
    const res = await fetch("/api/saved", { cache: "no-store" });
    if (res.status === 401) {
      // Enrich guest items with latest catalog info if available
      const enrichedGuest = localItems.map((loc) => {
        const key = loc.resourceId || loc.id;
        const fromCat = catalogMap.get(key);
        return fromCat ? normalizeMaterial({ ...loc, ...fromCat, createdAt: loc.createdAt }) : loc;
      });
      return { items: enrichedGuest, isAuthenticated: false };
    }

    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { items: localItems, isAuthenticated: false };
    }

    const serverRaw: Array<Partial<CourseMaterialItem> & { id: string; resourceId?: string }> =
      Array.isArray(data.data) ? data.data : [];

    const serverIds = new Set(serverRaw.map((s) => s.resourceId || s.id));

    // Sync any guest-bookmarked items into the user's account once logged in
    for (const loc of localItems) {
      const key = loc.resourceId || loc.id;
      if (!serverIds.has(key)) {
        fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: key,
            title: loc.title,
            courseCode: loc.courseCode,
            department: loc.department,
            type: loc.medium === "YOUTUBE" && !loc.type.toLowerCase().includes("video") ? "Video Tutorial" : loc.type,
            fileSize: loc.fileSize || (loc.medium === "YOUTUBE" ? "Video Stream" : "PDF Document"),
          }),
        }).catch(() => {});
      }
    }

    const merged: CourseMaterialItem[] = serverRaw.map((srv) => {
      const key = srv.resourceId || srv.id;
      const cached = localMap.get(key);
      const fromCat = catalogMap.get(key);
      return normalizeMaterial({
        ...cached,
        ...srv,
        ...fromCat,
        id: key,
        resourceId: key,
        createdAt: srv.createdAt || cached?.createdAt,
      });
    });

    // Include newly synced local items not yet in serverRaw response
    for (const loc of localItems) {
      const key = loc.resourceId || loc.id;
      if (!serverIds.has(key)) {
        const fromCat = catalogMap.get(key);
        merged.unshift(fromCat ? normalizeMaterial({ ...loc, ...fromCat, createdAt: loc.createdAt }) : loc);
      }
    }

    writeLocalSaved(merged);
    return { items: merged, isAuthenticated: true };
  } catch {
    return { items: localItems, isAuthenticated: false };
  }
}

/**
 * Add a material to bookmarks (both localStorage and server API if authenticated)
 */
export async function saveMaterialBookmark(item: CourseMaterialItem): Promise<void> {
  const normalized = normalizeMaterial(item);
  const current = readLocalSaved();
  const key = normalized.resourceId || normalized.id;

  const filtered = current.filter((x) => (x.resourceId || x.id) !== key);
  writeLocalSaved([normalized, ...filtered]);

  try {
    await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceId: key,
        title: normalized.title,
        courseCode: normalized.courseCode,
        department: normalized.department,
        type:
          normalized.medium === "YOUTUBE" && !normalized.type.toLowerCase().includes("video")
            ? "Video Tutorial"
            : normalized.type,
        fileSize:
          normalized.fileSize || (normalized.medium === "YOUTUBE" ? "Video Stream" : "PDF Document"),
      }),
    });
  } catch {
    // Kept in localStorage for offline/guest resilience
  }
}

/**
 * Remove a material from bookmarks (both localStorage and server API if authenticated)
 */
export async function removeMaterialBookmark(resourceId: string): Promise<void> {
  const current = readLocalSaved();
  writeLocalSaved(current.filter((x) => (x.resourceId || x.id) !== resourceId));

  try {
    await fetch(`/api/saved?resourceId=${encodeURIComponent(resourceId)}`, {
      method: "DELETE",
    });
  } catch {
    // Local removal already applied
  }
}

/**
 * Share or copy a direct deep link to open a course material immediately in the library
 */
export async function shareOrCopyMaterialLink(
  item: CourseMaterialItem
): Promise<"shared" | "copied"> {
  if (typeof window === "undefined") return "copied";
  const canonicalId = item.resourceId || item.id;
  const shareUrl = `${window.location.origin}/resources?open=${encodeURIComponent(canonicalId)}`;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: `${item.courseCode} — ${item.title} | The NUESA Library`,
        text: `Check out ${item.courseCode}: ${item.title} on The NUESA Library`,
        url: shareUrl,
      });
      return "shared";
    } catch {
      // User cancelled or Web Share unavailable on desktop; fall through to clipboard
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
  }
  return "copied";
}

