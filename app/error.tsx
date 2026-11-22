"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("[The NUESA Library] Route error boundary caught:", error);
  }, [error]);

  const handleRecover = () => {
    if (typeof retry === "function") {
      retry();
    } else if (typeof reset === "function") {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C3B2E] tracking-tight mb-3">
          Something went wrong
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          An unexpected error interrupted this page. Your saved bookmarks and offline downloaded documents remain safe on your device.
        </p>

        {error?.digest && (
          <p className="text-[11px] font-mono text-slate-400 mb-6">
            Reference ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRecover}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-sm font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <Link
            href="/resources"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Go to Library</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
