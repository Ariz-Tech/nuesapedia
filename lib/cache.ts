import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_CATALOG_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export const PUBLIC_COURSES_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export const PRIVATE_NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
};

const globalForCatalogCache = globalThis as unknown as {
  __nuesapediaCoursesCache?: Map<string, { data: unknown; expiresAt: number }>;
};

export function getInProcessCoursesCache(): Map<
  string,
  { data: unknown; expiresAt: number }
> {
  if (!globalForCatalogCache.__nuesapediaCoursesCache) {
    globalForCatalogCache.__nuesapediaCoursesCache = new Map();
  }
  return globalForCatalogCache.__nuesapediaCoursesCache;
}

export function clearInProcessCoursesCache(): void {
  globalForCatalogCache.__nuesapediaCoursesCache?.clear();
}

/**
 * Safely invalidates Next.js ISR / tag caches and in-process catalog caches
 * after moderation approvals, rejections, edits, or deletions.
 * Never throws when invoked outside a Next.js request context (e.g. unit tests).
 */
export function revalidateCatalog(resourceId?: string): void {
  clearInProcessCoursesCache();
  try {
    revalidateTag("catalog", "max");
    revalidatePath("/");
    revalidatePath("/resources");
    if (resourceId) {
      revalidatePath(`/resources/${resourceId}`);
    }
  } catch {
    // Running outside Next.js server request context (e.g., node:test)
  }
}
