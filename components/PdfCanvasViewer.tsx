"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type TouchEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Moon,
  Sun,
  Loader2,
  Maximize2,
  X,
  AlertCircle,
} from "lucide-react";
import type { PdfPageText } from "@/lib/ai-context";

interface PdfCanvasViewerProps {
  src: string;
  title: string;
  initialPage?: number;
  targetPage?: { page: number; nonce: number } | null;
  onPageChange?: (page: number, totalPages: number) => void;
  onTextExtractorReady?: (extractor: (() => Promise<PdfPageText[]>) | null) => void;
  compact?: boolean;
}

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNum: number) => Promise<PdfPageProxy>;
  cleanup?: (keepLoadedFonts?: boolean) => Promise<void> | void;
  destroy?: () => Promise<void> | void;
};

type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas?: HTMLCanvasElement;
  }) => { promise: Promise<void>; cancel: () => void };
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
};

export default function PdfCanvasViewer({
  src,
  title,
  initialPage = 1,
  targetPage = null,
  onPageChange,
  onTextExtractorReady,
  compact = false,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PdfDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  const onTextExtractorReadyRef = useRef(onTextExtractorReady);
  const initialPageRef = useRef(initialPage);

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(Math.max(1, initialPage));
  const [pageInput, setPageInput] = useState(String(Math.max(1, initialPage)));
  const [lastTargetNonce, setLastTargetNonce] = useState<number | null>(null);

  // Sync page when parent requests a jump (e.g. clicking [Page N] in AI Study Companion)
  if (targetPage && numPages > 0 && targetPage.nonce !== lastTargetNonce) {
    const clamped = Math.min(Math.max(1, targetPage.page), numPages);
    setLastTargetNonce(targetPage.nonce);
    setPageNumber(clamped);
    setPageInput(String(clamped));
  }
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [renderingPage, setRenderingPage] = useState(false);
  const [fallbackToIframe, setFallbackToIframe] = useState(false);
  const [nightMode, setNightMode] = useState(false);

  // In-document search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useEffect(() => {
    onTextExtractorReadyRef.current = onTextExtractorReady;
  }, [onTextExtractorReady]);

  useEffect(() => {
    initialPageRef.current = initialPage;
  }, [initialPage]);

  // Keep container width responsive for mobile/desktop fit-to-width rendering
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load PDF document via pdfjs-dist (falls back cleanly to iframe if CORS/format fails)
  useEffect(() => {
    let cancelled = false;
    let loadingTask: { promise: Promise<PdfDocumentProxy>; destroy?: () => Promise<void> } | null = null;

    async function loadPdf() {
      setLoadingDoc(true);
      setFallbackToIframe(false);
      setNumPages(0);
      setMatchPages([]);
      setMatchIndex(0);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // Resolve same-origin `/api/resources/:id/view` into its direct signed R2 URL first so
        // cross-origin redirects to R2 never fail CORS when `withCredentials: true` meets `ACAO: *`.
        let resolvedUrl = src;
        if (src.startsWith("/api/resources/") && src.includes("/view")) {
          const sep = src.includes("?") ? "&" : "?";
          const metaRes = await fetch(`${src}${sep}format=json`, {
            credentials: "same-origin",
            cache: "no-store",
          });
          if (metaRes.ok) {
            const metaJson = (await metaRes.json().catch(() => null)) as {
              success?: boolean;
              viewUrl?: string;
            } | null;
            if (metaJson?.success && typeof metaJson.viewUrl === "string" && metaJson.viewUrl) {
              resolvedUrl = metaJson.viewUrl;
            }
          }
        }

        const isSameOriginUrl =
          resolvedUrl.startsWith("/") || resolvedUrl.startsWith("blob:");

        loadingTask = pdfjs.getDocument({
          url: resolvedUrl,
          withCredentials: isSameOriginUrl,
        }) as unknown as { promise: Promise<PdfDocumentProxy>; destroy?: () => Promise<void> };

        const doc = await loadingTask.promise;
        if (cancelled) {
          if (typeof doc.destroy === "function") {
            void Promise.resolve(doc.destroy()).catch(() => {});
          } else if (typeof loadingTask.destroy === "function") {
            void Promise.resolve(loadingTask.destroy()).catch(() => {});
          }
          return;
        }

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        const clampedInitial = Math.min(Math.max(1, initialPageRef.current), doc.numPages);
        setPageNumber(clampedInitial);
        setPageInput(String(clampedInitial));

        // Expose lazy, cached page-text extractor for the AI Study Companion (zero upfront cost)
        let cachedPagesPromise: Promise<PdfPageText[]> | null = null;
        onTextExtractorReadyRef.current?.(() => {
          if (cachedPagesPromise) return cachedPagesPromise;
          cachedPagesPromise = (async () => {
            const extracted: PdfPageText[] = [];
            const maxPages = Math.min(doc.numPages, 120);
            for (let i = 1; i <= maxPages; i += 1) {
              try {
                const p = await doc.getPage(i);
                const content = await p.getTextContent();
                const text = content.items
                  .map((it) => it.str || "")
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim();
                extracted.push({ page: i, text });
              } catch {
                extracted.push({ page: i, text: "" });
              }
            }
            return extracted;
          })();
          return cachedPagesPromise;
        });
      } catch (err) {
        if (!cancelled) {
          console.warn("[PdfCanvasViewer] Falling back to native PDF frame:", err);
          onTextExtractorReadyRef.current?.(null);
          setFallbackToIframe(true);
        }
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      onTextExtractorReadyRef.current?.(null);
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancel errors
        }
        renderTaskRef.current = null;
      }
      const activeDoc = pdfDocRef.current;
      pdfDocRef.current = null;
      try {
        if (loadingTask && typeof loadingTask.destroy === "function") {
          void Promise.resolve(loadingTask.destroy()).catch(() => {});
        } else if (activeDoc && typeof activeDoc.destroy === "function") {
          void Promise.resolve(activeDoc.destroy()).catch(() => {});
        } else if (activeDoc && typeof activeDoc.cleanup === "function") {
          void Promise.resolve(activeDoc.cleanup()).catch(() => {});
        }
      } catch {
        // Ignore teardown errors when switching documents
      }
    };
  }, [src]);

  // Render active page onto HiDPI canvas whenever page, zoom, or container width changes
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0 || fallbackToIframe) return;

    let cancelled = false;

    async function renderCurrentPage() {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation
        }
        renderTaskRef.current = null;
      }

      setRenderingPage(true);
      try {
        const page = await doc!.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(260, (containerWidth || 760) - 32);
        const fitScale = Math.min(2.2, availableWidth / baseViewport.width);
        const cssScale = Math.max(0.45, Math.min(3.5, fitScale * zoomScale));
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);

        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });

        canvas!.width = Math.floor(renderViewport.width);
        canvas!.height = Math.floor(renderViewport.height);
        canvas!.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas!.style.height = `${Math.floor(cssViewport.height)}px`;

        const ctx = canvas!.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);

        const task = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          canvas: canvas!,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (!cancelled) {
          onPageChangeRef.current?.(pageNumber, numPages);
        }
      } catch (err: unknown) {
        const errName = (err as { name?: string })?.name;
        if (!cancelled && errName !== "RenderingCancelledException") {
          console.warn("[PdfCanvasViewer] Page render error:", err);
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    }

    void renderCurrentPage();

    return () => {
      cancelled = true;
    };
  }, [pageNumber, numPages, zoomScale, containerWidth, fallbackToIframe]);

  const goToPage = useCallback(
    (next: number) => {
      if (numPages <= 0) return;
      const clamped = Math.min(Math.max(1, next), numPages);
      setPageNumber(clamped);
      setPageInput(String(clamped));
    },
    [numPages]
  );

  const handleRunSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    const doc = pdfDocRef.current;
    if (!q || !doc || numPages === 0) {
      setMatchPages([]);
      return;
    }

    setSearching(true);
    try {
      const hits: number[] = [];
      // Cap scan at 200 pages to stay snappy on phones
      const maxScan = Math.min(numPages, 200);
      for (let i = 1; i <= maxScan; i += 1) {
        const page = await doc.getPage(i);
        const text = await page.getTextContent();
        const combined = text.items.map((it) => it.str || "").join(" ").toLowerCase();
        if (combined.includes(q)) {
          hits.push(i);
        }
      }
      setMatchPages(hits);
      setMatchIndex(0);
      if (hits.length > 0) {
        goToPage(hits[0]);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleStepMatch = (delta: number) => {
    if (matchPages.length === 0) return;
    const nextIdx = (matchIndex + delta + matchPages.length) % matchPages.length;
    setMatchIndex(nextIdx);
    goToPage(matchPages[nextIdx]);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    // Swipe left/right only when not zoomed in horizontally
    if (zoomScale <= 1.05 && Math.abs(dx) > 65) {
      if (dx < 0) goToPage(pageNumber + 1);
      else goToPage(pageNumber - 1);
    }
  };

  if (fallbackToIframe) {
    return (
      <div className="w-full h-full flex flex-col bg-slate-100">
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between gap-2 text-[11px] text-amber-900">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Showing browser PDF viewer. On mobile, use Fullscreen for best results.</span>
          </span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0C3B2E] text-white font-semibold"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Open</span>
          </a>
        </div>
        <iframe
          src={`${src}#toolbar=1&view=FitH`}
          title={title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
          className="w-full flex-1 border-0"
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col select-none ${
        nightMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          goToPage(pageNumber + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPage(pageNumber - 1);
        }
      }}
    >
      {/* Reader Toolbar */}
      <div
        className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap shrink-0 ${
          nightMode
            ? "bg-slate-900 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pageNumber <= 1 || loadingDoc}
            onClick={() => goToPage(pageNumber - 1)}
            aria-label="Previous page"
            className={`p-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 cursor-pointer ${
              nightMode
                ? "border-slate-700 hover:bg-slate-800"
                : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseInt(pageInput, 10);
              if (!Number.isNaN(parsed)) goToPage(parsed);
            }}
            className="flex items-center gap-1 text-xs font-semibold"
          >
            <input
              type="text"
              inputMode="numeric"
              aria-label="Current page number"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const parsed = parseInt(pageInput, 10);
                if (!Number.isNaN(parsed)) goToPage(parsed);
                else setPageInput(String(pageNumber));
              }}
              className={`w-10 text-center py-1 rounded-lg border text-xs font-bold ${
                nightMode
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
            <span className={nightMode ? "text-slate-400" : "text-slate-500"}>
              / {numPages || "—"}
            </span>
          </form>

          <button
            type="button"
            disabled={pageNumber >= numPages || loadingDoc}
            onClick={() => goToPage(pageNumber + 1)}
            aria-label="Next page"
            className={`p-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 cursor-pointer ${
              nightMode
                ? "border-slate-700 hover:bg-slate-800"
                : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom + Search + Night Mode + Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))))}
            aria-label="Zoom out"
            className={`p-1.5 rounded-lg border cursor-pointer ${
              nightMode
                ? "border-slate-700 hover:bg-slate-800"
                : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomScale(1)}
            title="Reset zoom to fit width"
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
              nightMode
                ? "border-slate-700 hover:bg-slate-800"
                : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            {Math.round(zoomScale * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoomScale((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
            aria-label="Zoom in"
            className={`p-1.5 rounded-lg border cursor-pointer ${
              nightMode
                ? "border-slate-700 hover:bg-slate-800"
                : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {zoomScale !== 1 && (
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              aria-label="Reset zoom"
              className={`hidden sm:inline-flex p-1.5 rounded-lg border cursor-pointer ${
                nightMode
                  ? "border-slate-700 hover:bg-slate-800"
                  : "border-slate-200 hover:bg-slate-100"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-label="Search text inside PDF"
            title="Search inside document"
            className={`p-1.5 rounded-lg border cursor-pointer ${
              searchOpen
                ? "border-emerald-500 bg-emerald-50 text-[#00875A]"
                : nightMode
                  ? "border-slate-700 hover:bg-slate-800"
                  : "border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setNightMode((prev) => !prev)}
            aria-label={nightMode ? "Switch to light mode" : "Switch to dark study mode"}
            title={nightMode ? "Light mode" : "Dark study mode"}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              nightMode
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-slate-200 hover:bg-slate-100 text-slate-700"
            }`}
          >
            {nightMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {!compact && (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              title="Open raw PDF in new tab"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0C3B2E] hover:bg-[#0A251D] text-white text-[11px] font-semibold"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Raw PDF</span>
            </a>
          )}
        </div>
      </div>

      {/* Collapsible In-Document Search Bar */}
      {searchOpen && (
        <form
          onSubmit={handleRunSearch}
          className={`px-3 sm:px-4 py-2 border-b flex items-center gap-2 flex-wrap shrink-0 ${
            nightMode
              ? "bg-slate-900/90 border-slate-800"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find keyword or formula in document..."
            className={`flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border text-xs ${
              nightMode
                ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
                : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
            }`}
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#00875A] hover:bg-[#00734c] disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
          >
            {searching ? "Searching..." : "Find"}
          </button>

          {matchPages.length > 0 ? (
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <span>
                {matchIndex + 1}/{matchPages.length} (p.{matchPages[matchIndex]})
              </span>
              <button
                type="button"
                onClick={() => handleStepMatch(-1)}
                aria-label="Previous search match"
                className="p-1 rounded border border-slate-300/60 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleStepMatch(1)}
                aria-label="Next search match"
                className="p-1 rounded border border-slate-300/60 cursor-pointer"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : searchQuery.trim() && !searching ? (
            <span className="text-[11px] text-slate-500">No matches</span>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
              setMatchPages([]);
            }}
            aria-label="Close search"
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Scrollable Canvas Viewport */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-auto flex flex-col items-center p-3 sm:p-4 relative"
      >
        {loadingDoc ? (
          <div className="m-auto flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="w-7 h-7 text-[#00875A] animate-spin mb-2" />
            <p className="text-xs font-medium text-slate-500">
              Rendering document pages...
            </p>
          </div>
        ) : (
          <div className="relative my-auto">
            {renderingPage && (
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-[11px] font-semibold inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Rendering…</span>
              </div>
            )}
            <canvas
              ref={canvasRef}
              aria-label={`${title} — Page ${pageNumber} of ${numPages}`}
              className={`block rounded-xl shadow-md transition-all ${
                nightMode ? "invert hue-rotate-180 opacity-95" : "bg-white"
              }`}
            />
          </div>
        )}
      </div>

      {/* Mobile bottom quick-nav hint */}
      {numPages > 1 && (
        <div
          className={`px-3 py-1.5 border-t flex items-center justify-between text-[11px] shrink-0 ${
            nightMode
              ? "bg-slate-900 border-slate-800 text-slate-400"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          <span>
            Page <strong>{pageNumber}</strong> of <strong>{numPages}</strong> (
            {Math.round((pageNumber / numPages) * 100)}%)
          </span>
          <span className="hidden sm:inline">Use ← / → arrow keys to turn pages</span>
          <span className="sm:hidden">Swipe left or right to turn pages</span>
        </div>
      )}
    </div>
  );
}
