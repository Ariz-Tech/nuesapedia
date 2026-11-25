"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { resolveCourseMetadata } from "@/lib/courses";
import { extractApiError } from "@/lib/api-helpers";
import { useTrackedBlobUrl } from "@/lib/hooks/useTrackedBlobUrl";
import {
  type CourseMaterialItem,
  normalizeMaterial,
  extractYoutubeId,
  getMaterialViewUrl,
  shareOrCopyMaterialLink,
} from "@/lib/saved-client";
import { getResourceBadgeStyle } from "@/lib/badge-styles";
import {
  getOfflineDocument,
  getCachedCatalogResources,
  syncReadingProgress,
  saveReadingProgress,
} from "@/lib/offline-vault";
import { useSavedResources } from "@/context/SavedResourcesContext";
import {
  ArrowLeft,
  Download,
  Bookmark,
  FileText,
  Play,
  ExternalLink,
  BookOpen,
  Loader2,
  Maximize2,
  ShieldCheck,
  Eye,
  HardDriveDownload,
  WifiOff,
  Share2,
  Check,
  CheckCircle2,
  Flag,
} from "lucide-react";
import { getFileFormatDisplay } from "@/lib/file-utils";
import DocumentFallbackPreview from "@/components/DocumentFallbackPreview";
import AiStudyCompanion from "@/components/AiStudyCompanion";
import type { PdfPageText } from "@/lib/ai-context";

const PdfCanvasViewer = dynamic(() => import("@/components/PdfCanvasViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-500">
      <Loader2 className="w-7 h-7 text-[#00875A] animate-spin mb-2" />
      <p className="text-xs font-medium">Loading mobile-ready PDF reader...</p>
    </div>
  ),
});

const REPORT_REASONS = [
  "Corrupted or unreadable document",
  "Wrong course code or department",
  "Duplicate or outdated material",
  "Broken video link",
  "Inappropriate content",
];

interface ResourceReaderClientProps {
  resourceId: string;
  initialResource: CourseMaterialItem | null;
}

export default function ResourceReaderClient({
  resourceId,
  initialResource,
}: ResourceReaderClientProps) {
  const {
    isSaved,
    toggleSave,
    isOfflineAvailable,
    downloadingIds,
    downloadMaterial,
    isOffline,
  } = useSavedResources();

  const { createTrackedUrl, revokeTrackedUrl } = useTrackedBlobUrl();
  const [resource, setResource] = useState<CourseMaterialItem | null>(initialResource);
  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialResource);
  const [activeTab, setActiveTab] = useState<"reader" | "details">("reader");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [readingPct, setReadingPct] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined);
  const [targetPage, setTargetPage] = useState<{ page: number; nonce: number } | null>(null);
  const [videoActivated, setVideoActivated] = useState(false);

  // Student "Report Issue" bar state
  const [showReportBar, setShowReportBar] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pdfTextExtractorRef = useRef<(() => Promise<PdfPageText[]>) | null>(null);

  useEffect(() => {
    let mounted = true;
    let createdBlobUrl: string | null = null;
    let studyTimer: number | undefined;

    async function load() {
      try {
        let found: CourseMaterialItem | null = initialResource;

        // 1. Check IndexedDB offline vault + hydrate cross-device reading progress
        const [offlineDoc, existingProg] = await Promise.all([
          getOfflineDocument(resourceId),
          syncReadingProgress(resourceId),
        ]);
        if (mounted && existingProg) {
          setReadingPct(existingProg.percentage);
          setCurrentPage(Math.max(1, existingProg.page || 1));
        }

        if (offlineDoc) {
          found = normalizeMaterial(offlineDoc.material);
          if (offlineDoc.blob && offlineDoc.blob.size > 0) {
            createdBlobUrl = createTrackedUrl(offlineDoc.blob);
            if (mounted) setOfflineBlobUrl(createdBlobUrl);
          }
        }

        // 2. If no initialResource or offlineDoc, fetch metadata online
        if (!found && (typeof navigator === "undefined" || navigator.onLine)) {
          try {
            const res = await fetch(`/api/resources/${encodeURIComponent(resourceId)}`);
            const data = res.ok ? await res.json() : null;
            const rawItem = data?.data || data?.resource;
            if (data?.success && rawItem) {
              found = normalizeMaterial(rawItem);
            }
          } catch {
            // Fall through to cached catalog when offline
          }
        }

        // 3. Offline fallback to IndexedDB cached catalog
        if (!found) {
          const cachedCatalog = await getCachedCatalogResources();
          const match = cachedCatalog.find((r) => r.id === resourceId);
          if (match) found = normalizeMaterial(match);
        }

        if (!mounted) return;
        setResource(found);

        // Honest study progress: mark 25% ("In Progress") after 5s of viewing a PDF
        if (
          found &&
          found.medium === "PDF" &&
          (!existingProg || existingProg.percentage === 0)
        ) {
          studyTimer = window.setTimeout(() => {
            if (!mounted) return;
            setReadingPct((prev) => {
              if (prev > 0) return prev;
              void saveReadingProgress(found!.id, 25, 1);
              return 25;
            });
          }, 5000);
        }
      } catch (err) {
        console.error("Failed to load resource:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
      if (studyTimer) window.clearTimeout(studyTimer);
      if (progressTimerRef.current) window.clearTimeout(progressTimerRef.current);
      if (createdBlobUrl) {
        revokeTrackedUrl(createdBlobUrl);
      }
    };
  }, [resourceId, initialResource, createTrackedUrl, revokeTrackedUrl]);

  const handlePageChange = useCallback(
    (page: number, pagesCount: number) => {
      const targetId = resource?.resourceId || resource?.id || resourceId;
      const pct =
        pagesCount > 0 ? Math.max(1, Math.min(100, Math.round((page / pagesCount) * 100))) : 25;
      setCurrentPage(page);
      if (pagesCount > 0) setTotalPages(pagesCount);
      setReadingPct((prev) => (prev >= 100 && page < pagesCount ? prev : Math.max(prev, pct)));

      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = window.setTimeout(() => {
        void saveReadingProgress(targetId, pct, page);
      }, 900);
    },
    [resource, resourceId]
  );

  const handleTextExtractorReady = useCallback(
    (extractor: (() => Promise<PdfPageText[]>) | null) => {
      pdfTextExtractorRef.current = extractor;
    },
    []
  );

  const getPdfTextExtractor = useCallback(() => pdfTextExtractorRef.current, []);

  const handleJumpToPage = useCallback((page: number) => {
    setActiveTab("reader");
    setTargetPage({ page, nonce: Date.now() });
  }, []);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resource) return;
    setReportError(null);
    const targetId = resource.resourceId || resource.id;
    try {
      setSubmittingReport(true);
      const res = await fetch(`/api/resources/${encodeURIComponent(targetId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceTitle: resource.title,
          courseCode: resource.courseCode,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(extractApiError(data, "Could not submit report."));
        return;
      }
      setReportSubmitted(true);
      setReportDetails("");
      window.setTimeout(() => {
        setShowReportBar(false);
        setReportSubmitted(false);
      }, 2200);
    } catch {
      setReportError("Network error. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!resource) return;
    try {
      setSavingBookmark(true);
      await toggleSave(resource);
    } catch (err) {
      console.error("Bookmark error:", err);
    } finally {
      setSavingBookmark(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Opening course material...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-[#0C3B2E] mb-2">Material Not Found</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed max-w-md">
            This course material does not exist in the vault or has not been downloaded for offline access yet.
          </p>
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Resources</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const canonicalId = resource.resourceId || resource.id;
  const bookmarked = isSaved(canonicalId);
  const cachedOffline = isOfflineAvailable(canonicalId) || Boolean(offlineBlobUrl);
  const isDownloading = downloadingIds.has(canonicalId);
  const isVideo = resource.medium === "YOUTUBE";
  const videoId =
    extractYoutubeId(resource.youtubeVideoId) || extractYoutubeId(resource.youtubeUrl);
  const badge = getResourceBadgeStyle(resource);
  const onlinePdfViewUrl = getMaterialViewUrl(resource);
  const canDownloadPdf = !isVideo && (!isOffline || cachedOffline);
  const pdfSrc = offlineBlobUrl || (!isOffline ? onlinePdfViewUrl : undefined);
  const formatInfo = getFileFormatDisplay(resource.fileName);
  const isOfficeFallback =
    formatInfo.isPresentation || formatInfo.isWord || formatInfo.isSpreadsheet;
  const showAiStudyCompanion = !isVideo && !isOfficeFallback;
  const courseMeta = resolveCourseMetadata(resource.courseCode, {
    department: resource.department,
    level: resource.level,
    semester: resource.semester,
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Top Action Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Resources</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {!isVideo && (
              <button
                type="button"
                onClick={async () => {
                  const nextPct = readingPct >= 100 ? 25 : 100;
                  setReadingPct(nextPct);
                  await saveReadingProgress(canonicalId, nextPct, currentPage);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  readingPct >= 100
                    ? "bg-emerald-50 border-emerald-200 text-[#00875A]"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{readingPct >= 100 ? "Completed" : "Mark Completed"}</span>
              </button>
            )}
            {!isOffline && (
              <button
                type="button"
                onClick={() => {
                  setShowReportBar((prev) => !prev);
                  setReportError(null);
                }}
                aria-label="Report issue with this material"
                title="Report broken file, illegible scan, or wrong course code"
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  showReportBar
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50/50"
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report Issue</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await shareOrCopyMaterialLink(resource);
                setCopiedLink(true);
                window.setTimeout(() => setCopiedLink(false), 2400);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00875A]" />
                  <span className="text-[#00875A] font-bold">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleBookmark}
              disabled={savingBookmark}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                bookmarked
                  ? "bg-slate-100 border-slate-300 text-slate-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {savingBookmark ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bookmark
                  className={
                    bookmarked
                      ? "w-4 h-4 fill-slate-900 text-slate-900"
                      : "w-4 h-4 text-slate-600"
                  }
                  strokeWidth={1.8}
                />
              )}
              <span>{bookmarked ? "Bookmarked" : "Bookmark"}</span>
            </button>

            {canDownloadPdf && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={async () => {
                  const res = await downloadMaterial(resource, { saveToDevice: true });
                  if (res.ok) {
                    const rec = await getOfflineDocument(canonicalId);
                    if (rec?.blob) {
                      const previousUrl = offlineBlobUrl;
                      const nextUrl = createTrackedUrl(rec.blob);
                      setOfflineBlobUrl(nextUrl);
                      if (previousUrl && previousUrl !== nextUrl) {
                        revokeTrackedUrl(previousUrl);
                      }
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{cachedOffline ? "Save PDF Copy" : "Download PDF"}</span>
              </button>
            )}

            {isVideo && resource.youtubeUrl && !isOffline && (
              <a
                href={resource.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0C3B2E] hover:bg-[#0A251D] text-white text-xs font-bold transition-all shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Watch on YouTube</span>
              </a>
            )}
          </div>
        </div>

        {/* Inline Student Issue Report Panel */}
        {showReportBar && (
          <div className="mb-6 px-4 sm:px-6 py-4 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-2xs">
            {reportSubmitted ? (
              <div className="text-xs sm:text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00875A]" />
                <span>Thank you — this material has been flagged for faculty moderators.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitReport}
                className="flex flex-col sm:flex-row sm:items-center gap-2.5"
              >
                <label
                  htmlFor="reader-report-reason"
                  className="text-xs font-bold text-amber-900 shrink-0"
                >
                  Report Issue:
                </label>
                <select
                  id="reader-report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-800"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Additional report details"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Optional note (e.g. pages 4–6 blurry or wrong course code)"
                  className="flex-1 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs text-slate-800"
                />
                {reportError && (
                  <span className="text-xs font-semibold text-rose-700">
                    {reportError}
                  </span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {submittingReport ? "Sending..." : "Submit Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportBar(false)}
                    className="px-2 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Header Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${badge.className}`}
            >
              {badge.label}
            </span>

            <span className="px-2.5 py-1 rounded-xl bg-[#0C3B2E] text-white font-mono text-xs font-extrabold uppercase">
              {resource.courseCode}
            </span>

            {cachedOffline && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-[#00875A] border border-emerald-200 text-xs font-bold">
                <HardDriveDownload className="w-3.5 h-3.5" />
                <span>Available Offline</span>
              </span>
            )}

            {resource.level && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                {resource.level}
              </span>
            )}

            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              {resource.department}
            </span>
          </div>

          <div className="text-xs font-bold text-[#00875A] mb-1">{courseMeta.title}</div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#0C3B2E] tracking-tight leading-snug mb-3">
            {resource.title}
          </h1>

          {resource.description && (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl mb-4">
              {resource.description}
            </p>
          )}

          {/* Sub-Tabs */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("reader")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reader"
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {isVideo ? <Play className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isVideo ? "Watch Lecture" : "Read Document"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "details"
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Course Details</span>
            </button>
          </div>
        </div>

        {/* Reader / Video Player */}
        {activeTab === "reader" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs">
            {isVideo ? (
              <div className="space-y-4">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                  {isOffline ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 text-center">
                      <WifiOff className="w-10 h-10 text-amber-400 mb-2" />
                      <p className="text-sm font-bold">
                        Video streaming requires an internet connection
                      </p>
                    </div>
                  ) : videoId ? (
                    videoActivated ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                        title={resource.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVideoActivated(true)}
                        aria-label={`Play video: ${resource.title}`}
                        className="relative w-full h-full group cursor-pointer block"
                      >
                        <Image
                          src={
                            resource.thumbnailUrl ||
                            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                          }
                          alt={resource.title}
                          fill
                          sizes="(max-width: 1024px) 100vw, 1024px"
                          priority
                          className="object-cover opacity-85 group-hover:opacity-95 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex flex-col items-center justify-center gap-3">
                          <span className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                            <Play className="w-7 h-7 fill-white ml-1" />
                          </span>
                          <span className="px-3 py-1 rounded-full bg-black/65 text-white text-xs font-semibold">
                            Click to load YouTube lecture
                          </span>
                        </div>
                      </button>
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-6">
                      <Play className="w-12 h-12 text-red-500 mb-2" />
                      <p className="text-sm">Video streaming link ready</p>
                    </div>
                  )}
                </div>

                {resource.youtubeUrl && !isOffline && (
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>Streamed via verified YouTube educational resource</span>
                    <a
                      href={resource.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00875A] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open in YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {pdfSrc && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="sm:hidden text-[11px] font-medium text-emerald-900 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                      Mobile tip: tap <strong>Open Fullscreen</strong> for smooth multi-page viewing.
                    </span>
                    <a
                      href={pdfSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto px-3 py-1.5 rounded-xl bg-[#0C3B2E] text-white hover:bg-[#0A251D] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Open Fullscreen</span>
                    </a>
                  </div>
                )}

                <div className="relative w-full h-[65vh] min-h-[420px] sm:h-[75vh] max-h-[860px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                  {pdfSrc && isOfficeFallback ? (
                    <DocumentFallbackPreview
                      title={resource.title}
                      fileName={resource.fileName}
                      fileUrl={pdfSrc}
                      onDownload={() => downloadMaterial(resource, { saveToDevice: true })}
                    />
                  ) : pdfSrc ? (
                    <PdfCanvasViewer
                      src={pdfSrc}
                      title={resource.title}
                      initialPage={currentPage}
                      targetPage={targetPage}
                      onPageChange={handlePageChange}
                      onTextExtractorReady={handleTextExtractorReady}
                    />
                  ) : isOffline ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <WifiOff className="w-12 h-12 text-amber-500 mb-2" />
                      <p className="text-sm font-bold text-[#0C3B2E]">
                        Not Downloaded for Offline Reading Yet
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Connect to the internet and click Download once — it will be stored in your Offline Vault automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-700">
                        Document preview unavailable
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Metadata Tab */}
        {activeTab === "details" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-[#0C3B2E] mb-4">
              Course &amp; Material Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Course</div>
                <div className="text-sm font-extrabold text-brand-forest mt-1">
                  {resource.courseCode} — {courseMeta.title}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Department</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.department}</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Academic Level</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">{resource.level}</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Semester</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.semester}</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Category</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.type}</div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-subtle border border-slate-200/70">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Verification</div>
                <div className="text-sm font-bold text-brand-emerald mt-1 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Faculty Approved</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showAiStudyCompanion && (
        <AiStudyCompanion
          key={canonicalId}
          resourceId={canonicalId}
          resourceTitle={resource.title}
          courseCode={resource.courseCode}
          currentPage={currentPage}
          totalPages={totalPages}
          isOffline={isOffline}
          getPdfTextExtractor={getPdfTextExtractor}
          onJumpToPage={handleJumpToPage}
        />
      )}

      <Footer />
    </div>
  );
}

