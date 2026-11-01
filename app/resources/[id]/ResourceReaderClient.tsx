"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { resolveCourseMetadata } from "@/lib/courses";
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
  getReadingProgress,
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
} from "lucide-react";

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

  const [resource, setResource] = useState<CourseMaterialItem | null>(initialResource);
  const [offlineBlobUrl, setOfflineBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialResource);
  const [activeTab, setActiveTab] = useState<"reader" | "details">("reader");
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [readingPct, setReadingPct] = useState(0);

  useEffect(() => {
    let mounted = true;
    let createdBlobUrl: string | null = null;
    let studyTimer: number | undefined;

    async function load() {
      try {
        let found: CourseMaterialItem | null = initialResource;

        // 1. Check IndexedDB offline vault first for instant offline availability
        const [offlineDoc, existingProg] = await Promise.all([
          getOfflineDocument(resourceId),
          getReadingProgress(resourceId),
        ]);
        if (mounted && existingProg) {
          setReadingPct(existingProg.percentage);
        }

        if (offlineDoc) {
          found = normalizeMaterial(offlineDoc.material);
          if (offlineDoc.blob && offlineDoc.blob.size > 0) {
            createdBlobUrl = URL.createObjectURL(offlineDoc.blob);
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
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [resourceId, initialResource]);

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
                  await saveReadingProgress(canonicalId, nextPct, 1);
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
                  if (res.ok && !offlineBlobUrl) {
                    const rec = await getOfflineDocument(canonicalId);
                    if (rec?.blob) {
                      setOfflineBlobUrl(URL.createObjectURL(rec.blob));
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
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
                      title={resource.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
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
                      Mobile tip: tap <strong>Open Fullscreen</strong> for smooth multi-page PDF scrolling.
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

                <div className="relative w-full h-[680px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                  {pdfSrc ? (
                    <iframe
                      src={`${pdfSrc}#toolbar=1&view=FitH`}
                      title={resource.title}
                      className="w-full h-full border-0"
                    />
                  ) : isOffline ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <WifiOff className="w-12 h-12 text-amber-500 mb-2" />
                      <p className="text-sm font-bold text-[#0C3B2E]">
                        Not Downloaded for Offline Reading Yet
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        Connect to the internet and click Download PDF once — it will be stored in your Offline Vault automatically.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Course</div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {resource.courseCode} — {courseMeta.title}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Department</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.department}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Academic Level</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">{resource.level}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Semester</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.semester}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Category</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.type}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Verification</div>
                <div className="text-sm font-bold text-emerald-700 mt-1 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Faculty Approved</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

