"use client";

import { useEffect, useState } from "react";
import {
  X,
  Download,
  Bookmark,
  ExternalLink,
  FileText,
  Play,
  Loader2,
  Maximize2,
  HardDriveDownload,
  WifiOff,
  Share2,
  Check,
  Flag,
} from "lucide-react";
import { resolveCourseMetadata } from "@/lib/courses";
import {
  type CourseMaterialItem,
  extractYoutubeId,
  shareOrCopyMaterialLink,
} from "@/lib/saved-client";
import { getResourceBadgeStyle } from "@/lib/badge-styles";
import { getOfflineDocument, saveReadingProgress } from "@/lib/offline-vault";
import { useSavedResources } from "@/context/SavedResourcesContext";

const REPORT_REASONS = [
  "Broken or corrupt file",
  "Wrong course code or department",
  "Missing or illegible pages",
  "Duplicate material",
];

interface ResourceViewerModalProps {
  material: CourseMaterialItem | null;
  isBookmarked: boolean;
  isTogglingBookmark?: boolean;
  onToggleBookmark: (item: CourseMaterialItem) => void;
  onClose: () => void;
}

export default function ResourceViewerModal({
  material,
  isBookmarked,
  isTogglingBookmark = false,
  onToggleBookmark,
  onClose,
}: ResourceViewerModalProps) {
  const { isOfflineAvailable, downloadingIds, downloadMaterial, isOffline } =
    useSavedResources();

  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const [checkingOffline, setCheckingOffline] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Issue report bar state
  const [showReportBar, setShowReportBar] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState<string>("");
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);

  // Escape key & scroll lock
  useEffect(() => {
    if (!material) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [material, onClose]);

  // Reset transient UI state & load cached PDF Blob from IndexedDB
  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | null = null;

    setCopiedLink(false);
    setShowReportBar(false);
    setReportSubmitted(false);
    setReportDetails("");

    async function resolveViewerSource() {
      if (!material) {
        setOfflineBlobUrl(null);
        return;
      }

      const canonicalId = material.resourceId || material.id;
      saveReadingProgress(canonicalId, 100, 1).catch(() => {});

      if (material.medium === "YOUTUBE") {
        setOfflineBlobUrl(null);
        return;
      }

      setCheckingOffline(true);
      try {
        const record = await getOfflineDocument(canonicalId);
        if (!active) return;
        if (record && record.blob && record.blob.size > 0) {
          createdObjectUrl = URL.createObjectURL(record.blob);
          setOfflineBlobUrl(createdObjectUrl);
        } else {
          setOfflineBlobUrl(null);
        }
      } finally {
        if (active) setCheckingOffline(false);
      }
    }

    resolveViewerSource();

    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [material, isOffline]);

  if (!material) return null;

  const canonicalId = material.resourceId || material.id;
  const isVideo = material.medium === "YOUTUBE";
  const videoId =
    extractYoutubeId(material.youtubeVideoId) || extractYoutubeId(material.youtubeUrl);
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
  const canDownloadPdf = !isVideo && (Boolean(material.fileUrl) || cachedOffline);
  const pdfSrc = offlineBlobUrl || (!isOffline ? material.fileUrl : undefined);

  const handleShare = async () => {
    await shareOrCopyMaterialLink(material);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2400);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingReport(true);
      const res = await fetch(`/api/resources/${encodeURIComponent(canonicalId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceTitle: material.title,
          courseCode: material.courseCode,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      if (res.ok) {
        setReportSubmitted(true);
        window.setTimeout(() => {
          setShowReportBar(false);
        }, 1800);
      }
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
      <div className="bg-white w-full max-w-6xl max-h-[94vh] rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
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
                  const res = await downloadMaterial(material, { saveToDevice: true });
                  if (res.ok && !offlineBlobUrl) {
                    const rec = await getOfflineDocument(canonicalId);
                    if (rec?.blob) {
                      setOfflineBlobUrl(URL.createObjectURL(rec.blob));
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
                title="Open PDF in new browser tab"
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
                <span className="text-xs font-bold text-amber-900 shrink-0">
                  Report Issue:
                </span>
                <select
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
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Optional note (e.g. should be MEE 302)"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-800"
                />
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
                      You are currently offline. Downloaded PDF documents remain fully readable offline from your Resources and Saved pages.
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
              ) : pdfSrc ? (
                <iframe
                  src={`${pdfSrc}#toolbar=1&view=FitH`}
                  title={material.title}
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
