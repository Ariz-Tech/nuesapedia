"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Bookmark,
  Download,
  ExternalLink,
  Share2,
  Check,
  CheckCircle2,
  Flag,
  Loader2,
  FileText,
  Play,
  WifiOff,
  HardDriveDownload,
  Maximize2,
  Presentation,
} from "lucide-react";
import {
  type CourseMaterialItem,
  extractYoutubeId,
  getMaterialViewUrl,
  shareOrCopyMaterialLink,
} from "@/lib/saved-client";
import {
  getOfflineDocument,
  getReadingProgress,
  saveReadingProgress,
} from "@/lib/offline-vault";
import { useSavedResources } from "@/context/SavedResourcesContext";
import { getResourceBadgeStyle } from "@/lib/badge-styles";
import { resolveCourseMetadata } from "@/lib/courses";
import { extractApiError } from "@/lib/api-helpers";
import { getFileFormatDisplay } from "@/lib/file-utils";
import { useTrackedBlobUrl } from "@/lib/hooks/useTrackedBlobUrl";

interface ResourceViewerModalProps {
  material: CourseMaterialItem | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (item: CourseMaterialItem) => void;
  isTogglingBookmark?: boolean;
}

const REPORT_REASONS = [
  "Corrupted or unreadable document",
  "Wrong course code or department",
  "Duplicate or outdated material",
  "Broken video link",
  "Inappropriate content",
];

export default function ResourceViewerModal(props: ResourceViewerModalProps) {
  if (!props.material) return null;
  const key = props.material.resourceId || props.material.id;
  return <ResourceViewerModalOpen key={key} {...props} material={props.material} />;
}

function ResourceViewerModalOpen({
  material,
  onClose,
  isBookmarked,
  onToggleBookmark,
  isTogglingBookmark = false,
}: Omit<ResourceViewerModalProps, "material"> & { material: CourseMaterialItem }) {
  const { isOfflineAvailable, downloadMaterial, downloadingIds, isOffline } =
    useSavedResources();

  const dialogRef = useRef<HTMLDivElement>(null);
  const { createTrackedUrl, revokeTrackedUrl } = useTrackedBlobUrl();
  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const [checkingOffline, setCheckingOffline] = useState<boolean>(
    material.medium !== "YOUTUBE"
  );
  const [readingPct, setReadingPct] = useState<number>(0);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showReportBar, setShowReportBar] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState<string>("");
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const canonicalId = material.resourceId || material.id;
  const isVideo = material.medium === "YOUTUBE";

  // Escape key, Tab focus trap, and body scroll lock
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      prevActive?.focus?.();
    };
  }, [onClose]);

  // Load cached PDF Blob from IndexedDB & existing reading progress (honest tracking)
  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;
    let studyTimer: number | undefined;

    (async () => {
      const existingProgress = await getReadingProgress(canonicalId);
      if (active && existingProgress) {
        setReadingPct(existingProgress.percentage);
      }

      if (isVideo) {
        if (active) setCheckingOffline(false);
        return;
      }

      try {
        const record = await getOfflineDocument(canonicalId);
        if (!active) return;
        if (record && record.blob && record.blob.size > 0) {
          localUrl = createTrackedUrl(record.blob);
          setOfflineBlobUrl(localUrl);
        } else {
          setOfflineBlobUrl(null);
        }
      } finally {
        if (active) setCheckingOffline(false);
      }

      // Record "In Progress (25%)" only after 5 seconds of actual PDF viewing if not started
      if (active && (!existingProgress || existingProgress.percentage === 0)) {
        studyTimer = window.setTimeout(() => {
          if (!active) return;
          setReadingPct((prev) => {
            if (prev > 0) return prev;
            void saveReadingProgress(canonicalId, 25, 1);
            return 25;
          });
        }, 5000);
      }
    })();

    return () => {
      active = false;
      if (studyTimer) window.clearTimeout(studyTimer);
      if (localUrl) {
        revokeTrackedUrl(localUrl);
      }
    };
  }, [canonicalId, isVideo, isOffline, createTrackedUrl, revokeTrackedUrl]);

  const videoId =
    extractYoutubeId(material.youtubeVideoId) ||
    extractYoutubeId(material.youtubeUrl);
  const youtubeWatchUrl =
    material.youtubeUrl ||
    (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined);

  const badge = getResourceBadgeStyle(material);
  const courseMeta = resolveCourseMetadata(material.courseCode, {
    department: material.department,
    level: material.level,
    semester: material.semester,
  });

  const cachedOffline = isOfflineAvailable(canonicalId) || Boolean(offlineBlobUrl);
  const isDownloading = downloadingIds.has(canonicalId);
  const onlinePdfViewUrl = getMaterialViewUrl(material);
  const canDownloadPdf = !isVideo && (!isOffline || cachedOffline);
  const pdfSrc = offlineBlobUrl || (!isOffline ? onlinePdfViewUrl : undefined);

  const handleShare = async () => {
    await shareOrCopyMaterialLink(material);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleToggleCompleted = async () => {
    const nextPct = readingPct >= 100 ? 25 : 100;
    setReadingPct(nextPct);
    await saveReadingProgress(canonicalId, nextPct, 1);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError(null);
    try {
      setSubmittingReport(true);
      const res = await fetch(
        `/api/resources/${encodeURIComponent(canonicalId)}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceTitle: material.title,
            courseCode: material.courseCode,
            reason: reportReason,
            details: reportDetails.trim(),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(extractApiError(data, "Could not submit report."));
        return;
      }
      setReportSubmitted(true);
      window.setTimeout(() => {
        setShowReportBar(false);
      }, 1800);
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white w-full max-w-6xl max-h-[94vh] rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#0C3B2E] text-white font-mono text-[11px] font-bold">
                {material.courseCode}
              </span>
              {material.sessionYear && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                  {material.sessionYear}
                </span>
              )}
              {cachedOffline && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#00875A] border border-emerald-200 text-[11px] font-bold">
                  <HardDriveDownload className="w-3 h-3" />
                  <span>Available Offline</span>
                </span>
              )}
              {material.level && material.level !== "All Levels" && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  {material.level}
                </span>
              )}
              <span className="text-[11px] text-slate-400 font-medium truncate">
                {courseMeta.title}
              </span>
            </div>

            <h2
              id="viewer-modal-title"
              className="text-base sm:text-lg font-extrabold text-[#0C3B2E] truncate"
            >
              {material.title}
            </h2>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {!isVideo && (
              <button
                type="button"
                onClick={handleToggleCompleted}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  readingPct >= 100
                    ? "bg-emerald-50 border-emerald-200 text-[#00875A]"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title="Track whether you have finished studying this document"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{readingPct >= 100 ? "Completed" : "Mark Completed"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleBookmark(material)}
              disabled={isTogglingBookmark}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isBookmarked
                  ? "bg-slate-100 border-slate-300 text-slate-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {isTogglingBookmark ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bookmark
                  className={
                    isBookmarked
                      ? "w-3.5 h-3.5 fill-slate-900 text-slate-900"
                      : "w-3.5 h-3.5 text-slate-600"
                  }
                  strokeWidth={1.8}
                />
              )}
              <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              title="Share or copy direct link to this material"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00875A]" />
                  <span className="text-[#00875A] font-bold">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {canDownloadPdf && (
              <button
                type="button"
                disabled={isDownloading}
                onClick={async () => {
                  const res = await downloadMaterial(material, {
                    saveToDevice: true,
                  });
                  if (res.ok && !offlineBlobUrl) {
                    const rec = await getOfflineDocument(canonicalId);
                    if (rec?.blob) {
                      setOfflineBlobUrl(createTrackedUrl(rec.blob));
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{cachedOffline ? "Save PDF Copy" : "Download"}</span>
              </button>
            )}

            {isVideo && youtubeWatchUrl && !isOffline && (
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0C3B2E] hover:bg-[#0A251D] text-white text-xs font-bold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>YouTube</span>
              </a>
            )}

            {!isVideo && pdfSrc && (
              <a
                href={pdfSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
                title="Open document in new tab"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Tab</span>
              </a>
            )}

            {!isOffline && (
              <button
                type="button"
                onClick={() => setShowReportBar((prev) => !prev)}
                title="Report broken file or wrong course metadata"
                aria-label="Report issue with this material"
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  showReportBar
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-200 text-slate-400 hover:text-amber-700 hover:bg-amber-50/50"
                }`}
              >
                <Flag className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Report Issue Bar */}
        {showReportBar && (
          <div className="px-4 sm:px-6 py-3 bg-amber-50/80 border-b border-amber-200/80 shrink-0">
            {reportSubmitted ? (
              <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[#00875A]" />
                <span>Thank you — issue flagged for faculty moderators.</span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitReport}
                className="flex flex-col sm:flex-row sm:items-center gap-2.5"
              >
                <label
                  htmlFor="viewer-report-reason"
                  className="text-xs font-bold text-amber-900 shrink-0"
                >
                  Report Issue:
                </label>
                <select
                  id="viewer-report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-slate-800"
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
                  placeholder="Optional note (e.g. should be MEE 302)"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-800"
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
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {submittingReport ? "Sending..." : "Submit Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportBar(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Mobile Document Helper Banner (addresses mobile WebView iframe limitations) */}
        {!isVideo && pdfSrc && (
          <div className="sm:hidden px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] font-medium text-emerald-900">
              On mobile? Open document directly for smooth multi-page reading.
            </span>
            <a
              href={pdfSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00875A] text-white text-[11px] font-bold"
            >
              <span>Open Document</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Viewer Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-5">
          {isVideo ? (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                {isOffline ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-8 text-center">
                    <WifiOff className="w-10 h-10 text-amber-400 mb-3" />
                    <p className="text-sm font-bold mb-1">
                      Video streaming requires an internet connection
                    </p>
                    <p className="text-xs text-slate-300 max-w-md">
                      You are currently offline. Downloaded documents remain fully readable offline from your Resources and Saved pages.
                    </p>
                  </div>
                ) : videoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title={material.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white p-8 text-center">
                    <Play className="w-12 h-12 text-red-500 mb-3" />
                    <p className="text-sm font-semibold mb-3">
                      Video stream ready on YouTube
                    </p>
                    {youtubeWatchUrl && (
                      <a
                        href={youtubeWatchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                      >
                        <span>Watch on YouTube</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {material.description && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  <span className="font-bold text-[#0C3B2E] block mb-1">
                    Course Material Overview
                  </span>
                  {material.description}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[72vh] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-inner">
              {checkingOffline ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-slate-500">
                  <Loader2 className="w-7 h-7 text-[#00875A] animate-spin mb-2" />
                  <p className="text-xs font-medium">Opening document...</p>
                </div>
              ) : pdfSrc &&
                (() => {
                  const formatInfo = getFileFormatDisplay(material.fileName);
                  return formatInfo.isPresentation || formatInfo.isWord || formatInfo.isSpreadsheet;
                })() ? (
                (() => {
                  const formatInfo = getFileFormatDisplay(material.fileName);
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-slate-50/50">
                      <div
                        className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-sm ${
                          formatInfo.isPresentation
                            ? "bg-amber-100 text-amber-700"
                            : formatInfo.isWord
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-[#00875A]"
                        }`}
                      >
                        {formatInfo.isPresentation ? (
                          <Presentation className="w-8 h-8" />
                        ) : (
                          <FileText className="w-8 h-8" />
                        )}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                        {formatInfo.label} • {formatInfo.extension}
                      </span>
                      <h4 className="text-lg font-bold text-slate-900 max-w-md mb-2">
                        {material.title}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mb-6">
                        {material.fileName || "This file"} is ready for review or study. Download it directly to your device or open it in your Office reader.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => downloadMaterial(material, { saveToDevice: true })}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download {formatInfo.isPresentation ? "Slides" : "Document"}</span>
                        </button>
                        <a
                          href={pdfSrc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          <span>Open File Directly</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })()
              ) : pdfSrc ? (
                <iframe
                  src={`${pdfSrc}#toolbar=1&view=FitH`}
                  title={material.title}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
                  className="w-full h-full border-0"
                />
              ) : isOffline ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <WifiOff className="w-12 h-12 text-amber-500 mb-3" />
                  <p className="text-sm font-bold text-[#0C3B2E]">
                    Not Downloaded for Offline Reading Yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Connect to the internet once and click Download on this document — it will be saved automatically so you can read it anytime offline.
                  </p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <FileText className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-[#0C3B2E]">
                    Document preview unavailable
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    This course material does not have an attached preview URL yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
