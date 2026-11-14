/**
 * Shared, dependency-free formatting helpers usable from both server
 * (API responses) and client ("use client") code. Kept free of any
 * `next/server` imports so client bundles never pull in server-only modules.
 */

/**
 * Formats a byte count as a human-readable size string.
 *
 * The `fallback` label is returned for `null`, `undefined`, non-finite, or
 * non-positive values, allowing callers to choose context-appropriate copy
 * (e.g. "0 B" for storage totals, "PDF Document" when a size is unknown).
 */
export function formatBytes(
  bytes: number | null | undefined,
  fallback = "0 B"
): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return fallback;
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
