"use client";

import React, { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Loader2, Maximize2, WifiOff } from "lucide-react";
import type { PdfPageText } from "@/lib/ai-context";

export interface PdfViewerLoaderProps {
  src: string;
  title: string;
  initialPage?: number;
  targetPage?: { page: number; nonce: number } | null;
  onPageChange?: (page: number, totalPages: number) => void;
  onTextExtractorReady?: (extractor: (() => Promise<PdfPageText[]>) | null) => void;
  compact?: boolean;
}

const LazyPdfCanvasViewer = dynamic(() => import("@/components/PdfCanvasViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-500">
      <Loader2 className="w-7 h-7 text-[#00875A] animate-spin mb-2" />
      <p className="text-xs font-medium">Loading PDF reader...</p>
    </div>
  ),
});

let preloadStarted = false;

/**
 * Warms the lazy `PdfCanvasViewer` and `pdfjs-dist` chunks while the student is online
 * (e.g., when downloading a PDF to the Offline Vault) so Service Worker `SHELL_CACHE`
 * already has the viewer chunks when reading offline later.
 */
export function preloadPdfViewerChunks(): void {
  if (preloadStarted || typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  preloadStarted = true;
  void import("@/components/PdfCanvasViewer").catch(() => {
    preloadStarted = false;
  });
  void import("pdfjs-dist").catch(() => {});
}

interface BoundaryProps {
  src: string;
  title: string;
  children: ReactNode;
}

interface BoundaryState {
  failedToLoadChunk: boolean;
}

class PdfChunkErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { failedToLoadChunk: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { failedToLoadChunk: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(
      "[PdfViewerLoader] Lazy PDF chunk unavailable (likely offline); falling back to native viewer:",
      error
    );
  }

  render() {
    if (this.state.failedToLoadChunk) {
      return (
        <div className="w-full h-full flex flex-col bg-slate-100">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-[11px] text-amber-900">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline fallback viewer active. Tap Open for fullscreen reading.</span>
            </span>
            <a
              href={this.props.src}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0C3B2E] text-white font-semibold"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Open</span>
            </a>
          </div>
          <iframe
            src={`${this.props.src}#toolbar=1&view=FitH`}
            title={this.props.title}
            className="w-full flex-1 border-0"
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default function PdfViewerLoader(props: PdfViewerLoaderProps) {
  return (
    <PdfChunkErrorBoundary src={props.src} title={props.title}>
      <LazyPdfCanvasViewer {...props} />
    </PdfChunkErrorBoundary>
  );
}
