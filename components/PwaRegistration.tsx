"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WifiOff, HardDriveDownload } from "lucide-react";
import { useSavedResources } from "@/context/SavedResourcesContext";

export default function PwaRegistration() {
  const { isOffline, offlineCount } = useSavedResources();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        console.warn("Service worker registration skipped:", err);
      });
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-[#0C3B2E] text-white border-b border-emerald-900/60 px-4 py-2 text-xs font-medium"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>
            <strong>Offline Mode</strong> &bull; Showing Downloaded &amp; Cached Vault
          </span>
        </div>

        <Link
          href="/saved?tab=offline"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-emerald-100 text-[11px] font-semibold transition-colors"
        >
          <HardDriveDownload className="w-3 h-3" />
          <span>
            Downloaded Documents ({offlineCount})
          </span>
        </Link>
      </div>
    </div>
  );
}

