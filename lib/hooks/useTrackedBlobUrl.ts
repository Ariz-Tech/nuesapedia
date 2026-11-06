"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Custom hook to safely generate and manage Object URLs (e.g. from IndexedDB Blobs)
 * ensuring all created URLs are tracked and cleanly revoked on unmount or replacement,
 * preventing browser memory leaks.
 */
export function useTrackedBlobUrl() {
  const trackedUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedUrl = useCallback((blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    trackedUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeTrackedUrl = useCallback((url: string | null | undefined): void => {
    if (!url) return;
    if (trackedUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      trackedUrlsRef.current.delete(url);
    }
  }, []);

  useEffect(() => {
    const tracked = trackedUrlsRef.current;
    return () => {
      tracked.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      tracked.clear();
    };
  }, []);

  return { createTrackedUrl, revokeTrackedUrl };
}

