"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResourceViewerModal from "@/components/ResourceViewerModal";
import { DEPARTMENTS } from "@/lib/departments";
import { resolveCourseMetadata } from "@/lib/courses";
import {
  type CourseMaterialItem,
  normalizeMaterial,
  shareOrCopyMaterialLink,
} from "@/lib/saved-client";
import { getResourceBadgeStyle } from "@/lib/badge-styles";
import {
  cacheCatalogResources,
  getCachedCatalogResources,
  formatBytes,
} from "@/lib/offline-vault";
import { useSavedResources } from "@/context/SavedResourcesContext";
import {
  Bookmark,
  BookmarkX,
  Play,
  Download,
  Trash2,
  Search,
  BookOpen,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Eye,
  HardDriveDownload,
  Share2,
  Check,
  X,
} from "lucide-react";

type ShelfFilter = "All" | "Offline" | "PDF" | "Video";

function SavedVaultContent() {
  const searchParams = useSearchParams();
  const {
    savedItems,
    isSaved,
    toggleSave,
    removeSaved,
    refreshSaved,
    isAuthenticated,
    loadingSaved,
    offlineDocs,
    offlineCount,
    offlineTotalBytes,
    isOfflineAvailable,
    downloadingIds,
    downloadMaterial,
    removeOffline,
    clearOfflineVault,
    isOffline,
  } = useSavedResources();

  const [hydrating, setHydrating] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedType, setSelectedType] = useState<ShelfFilter>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialItem | null>(null);
  const [confirmClearVault, setConfirmClearVault] = useState(false);
  const [clearingVault, setClearingVault] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync ?tab=offline query param or default to Offline tab if offline and user has downloaded docs
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "offline") {
      setSelectedType("Offline");
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    async function hydrateCatalogAndSaved() {
      try {
        let catalog: CourseMaterialItem[] = [];
        if (typeof navigator === "undefined" || navigator.onLine) {
          const catRes = await fetch("/api/resources?limit=500").catch(() => null);
          const catJson = catRes && catRes.ok ? await catRes.json() : null;
          const list = Array.isArray(catJson?.data)
            ? catJson.data
            : Array.isArray(catJson?.resources)
              ? catJson.resources
              : [];
          if (catJson?.success && list.length > 0) {
            catalog = list.map((r: CourseMaterialItem) => normalizeMaterial(r));
            cacheCatalogResources(catalog).catch(() => {});
          }
        }

        if (catalog.length === 0) {
          catalog = await getCachedCatalogResources();
        }

        await refreshSaved(catalog);
      } finally {
        if (mounted) setHydrating(false);
      }
    }

    hydrateCatalogAndSaved();
    return () => {
      mounted = false;
    };
  }, [refreshSaved]);

  // Unified shelf combining Bookmarked items + Downloaded Offline documents
  const combinedItems = useMemo(() => {
    const map = new Map<string, CourseMaterialItem>();
    for (const doc of offlineDocs) {
      if (doc.material) {
        const norm = normalizeMaterial(doc.material);
        map.set(norm.resourceId || norm.id, norm);
      }
    }
    for (const item of savedItems) {
      const key = item.resourceId || item.id;
      const existing = map.get(key);
      map.set(key, existing ? normalizeMaterial({ ...existing, ...item }) : item);
    }
    return Array.from(map.values());
  }, [savedItems, offlineDocs]);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleToggleBookmark = async (item: CourseMaterialItem) => {
    const targetId = item.resourceId || item.id;
    try {
      setBusyId(targetId);
      const nowSaved = await toggleSave(item);
      showToast(
        nowSaved
          ? `Bookmarked "${item.title}"`
          : `Removed "${item.title}" from Bookmarks`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveFromShelf = async (item: CourseMaterialItem) => {
    const targetId = item.resourceId || item.id;
    const bookmarked = isSaved(targetId);
    const cached = isOfflineAvailable(targetId);

    try {
      setBusyId(targetId);
      if (selectedType === "Offline" && cached) {
        await removeOffline(targetId);
        showToast(`Removed offline copy of "${item.title}"`);
      } else {
        if (bookmarked) await removeSaved(targetId);
        if (cached && !bookmarked) await removeOffline(targetId);
        showToast(`Removed "${item.title}" from Saved`);
      }
      if (activeMaterial && (activeMaterial.resourceId || activeMaterial.id) === targetId) {
        setActiveMaterial(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (item: CourseMaterialItem) => {
    const res = await downloadMaterial(item, { saveToDevice: true });
    if (res.ok) {
      showToast(
        res.fromCache
          ? `Saved PDF copy of "${item.title}" from Offline Vault`
          : `Downloaded "${item.title}" & saved for offline reading`
      );
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const filteredItems = useMemo(() => {
    return combinedItems.filter((item) => {
      const targetId = item.resourceId || item.id;
      const q = searchQuery.toLowerCase().trim();
      const courseTitle = resolveCourseMetadata(item.courseCode).title.toLowerCase();
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.courseCode.toLowerCase().includes(q) ||
        courseTitle.includes(q) ||
        item.department.toLowerCase().includes(q);

      const matchesDept =
        selectedDept === "All" ||
        item.department.toLowerCase().includes(selectedDept.toLowerCase());

      const isVideo = item.medium === "YOUTUBE";
      const matchesType =
        selectedType === "All" ||
        (selectedType === "Offline" && isOfflineAvailable(targetId)) ||
        (selectedType === "PDF" && !isVideo) ||
        (selectedType === "Video" && isVideo);

      return matchesQuery && matchesDept && matchesType;
    });
  }, [combinedItems, searchQuery, selectedDept, selectedType, isOfflineAvailable]);

  const loading = hydrating && loadingSaved && combinedItems.length === 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200/80 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3">
              <Bookmark className="w-3.5 h-3.5 text-[#00875A]" />
              <span>Personal Study Shelf &amp; Offline Vault</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0C3B2E] tracking-tight">
              Saved &amp; Downloaded Materials
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
              Access your bookmarked course materials and downloaded PDF documents — downloaded documents open and read seamlessly even when you are completely offline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold shadow-2xs transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>Browse All Resources</span>
            </Link>
          </div>
        </div>

        {/* Offline Storage Meter & Cache Controls */}
        {!loading && offlineCount > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00875A] text-white flex items-center justify-center shrink-0">
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-[#0C3B2E]">
                  Offline Vault: {offlineCount} {offlineCount === 1 ? "PDF" : "PDFs"} &bull;{" "}
                  {formatBytes(offlineTotalBytes)} stored on this device
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600">
                  These documents open instantly inside the reader even with zero internet connection.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {confirmClearVault ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-rose-200">
                  <span className="text-[11px] font-bold text-rose-700">Clear offline copies?</span>
                  <button
                    type="button"
                    disabled={clearingVault}
                    onClick={async () => {
                      setClearingVault(true);
                      await clearOfflineVault();
                      setClearingVault(false);
                      setConfirmClearVault(false);
                      showToast("Cleared offline PDF cache from this device.");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    {clearingVault ? "Clearing..." : "Yes, Clear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearVault(false)}
                    className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearVault(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-slate-700 hover:text-rose-700 hover:border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Offline Cache</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Optional Cloud Sync Banner for Guests */}
        {!loading && !isAuthenticated && !isOffline && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <p className="text-xs sm:text-sm text-slate-600">
              Your bookmarks and downloaded PDFs are stored on this device.{" "}
              <span className="font-semibold text-[#0C3B2E]">Sign in</span> anytime to sync your bookmarks across all your devices.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-semibold transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}

        {/* Toast Feedback */}
        {feedbackMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
              <span>{feedbackMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading your saved &amp; downloaded materials...</p>
          </div>
        )}

        {/* Saved & Downloaded Materials View */}
        {!loading && (
          <>
            {combinedItems.length > 0 && (
              <div className="mb-8 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by course code, title, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] transition-all"
                  />
                </div>

                {/* Department & Type Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                  >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <div className="inline-flex flex-wrap rounded-xl p-1 bg-slate-100 border border-slate-200/80 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedType("All")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedType === "All"
                          ? "bg-white text-[#0C3B2E] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All ({combinedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedType("Offline")}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedType === "Offline"
                          ? "bg-[#00875A] text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <HardDriveDownload className="w-3 h-3" />
                      <span>Downloaded ({offlineCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedType("PDF")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedType === "PDF"
                          ? "bg-white text-[#0C3B2E] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      PDFs
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedType("Video")}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedType === "Video"
                          ? "bg-white text-[#0C3B2E] shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Videos
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty Saved State */}
            {combinedItems.length === 0 && (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#0C3B2E]">
                  No Saved or Downloaded Materials Yet
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                  Browse the Resources page and click Bookmark or Download on any lecture handout, past question, textbook, or video lecture. Downloaded PDFs stay readable even offline.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link
                    href="/resources"
                    className="px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold shadow-2xs"
                  >
                    Browse Resources
                  </Link>
                </div>
              </div>
            )}

            {/* Filtered Empty State */}
            {combinedItems.length > 0 && filteredItems.length === 0 && (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
                <BookmarkX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-[#0C3B2E]">
                  {selectedType === "Offline"
                    ? "No downloaded offline documents yet"
                    : "No matching saved items"}
                </h3>
                <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                  {selectedType === "Offline"
                    ? "Click Download on any PDF document to store it on this device for offline reading."
                    : "Try clearing your search query or resetting your filters."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDept("All");
                    setSelectedType("All");
                  }}
                  className="mt-4 px-4 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Show All Saved Items
                </button>
              </div>
            )}

            {/* Saved Cards Grid */}
            {filteredItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => {
                  const targetId = item.resourceId || item.id;
                  const isVideo = item.medium === "YOUTUBE";
                  const bookmarked = isSaved(targetId);
                  const cachedOffline = isOfflineAvailable(targetId);
                  const isDownloading = downloadingIds.has(targetId);
                  const badge = getResourceBadgeStyle(item);
                  const courseMeta = resolveCourseMetadata(item.courseCode, {
                    department: item.department,
                    level: item.level,
                    semester: item.semester,
                  });
                  const canDownloadPdf = !isVideo && (Boolean(item.fileUrl) || cachedOffline);

                  return (
                    <div
                      key={targetId}
                      className="bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-6 group"
                    >
                      <div>
                        {/* Course & Type Badges + Top-Right Bookmark */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#0C3B2E] text-white font-mono text-[11px] font-bold">
                              {item.courseCode}
                            </span>
                            {cachedOffline && (
                              <span
                                title="Stored in browser IndexedDB for offline viewing"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#00875A] border border-emerald-200 text-[10px] font-bold"
                              >
                                <HardDriveDownload className="w-3 h-3" />
                                <span>Available Offline</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleBookmark(item)}
                            disabled={busyId === targetId}
                            aria-label={bookmarked ? "Remove bookmark" : "Bookmark resource"}
                            title={bookmarked ? "Bookmarked" : "Bookmark to Saved"}
                            className="p-1.5 -mr-1.5 -mt-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                          >
                            {bookmarked ? (
                              <Bookmark className="h-5 w-5 fill-slate-900 text-slate-900" />
                            ) : (
                              <Bookmark
                                className="h-5 w-5 text-slate-500 hover:text-slate-800"
                                strokeWidth={1.8}
                              />
                            )}
                          </button>
                        </div>

                        {/* Clickable YouTube Thumbnail */}
                        {isVideo && item.youtubeVideoId && !isOffline && (
                          <button
                            type="button"
                            onClick={() => setActiveMaterial(item)}
                            className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3 group/thumb block cursor-pointer"
                            aria-label={`Watch ${item.title}`}
                          >
                            <Image
                              src={
                                item.thumbnailUrl ||
                                `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`
                              }
                              alt={item.title}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover/thumb:bg-black/40 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                                <Play className="w-4 h-4 fill-white ml-0.5" />
                              </div>
                            </div>
                          </button>
                        )}

                        <div className="text-[11px] font-semibold text-[#00875A] mb-1 line-clamp-1">
                          {courseMeta.title}
                        </div>

                        {/* Title */}
                        <button
                          type="button"
                          onClick={() => setActiveMaterial(item)}
                          className="text-left block w-full cursor-pointer"
                        >
                          <h3 className="font-bold text-[#0C3B2E] text-base sm:text-lg line-clamp-2 group-hover:text-[#00875A] transition-colors leading-snug">
                            {item.title}
                          </h3>
                        </button>

                        {/* Department & File Size */}
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-medium">
                          <span className="truncate">{item.department}</span>
                          <span className="shrink-0 ml-2">
                            {item.fileSize || (isVideo ? "Video Stream" : "PDF")}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions: Read/Watch, Remove, Download */}
                      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveMaterial(item)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isVideo
                              ? "bg-[#DBEAFE]/60 hover:bg-[#DBEAFE] text-[#2563EB]"
                              : "bg-emerald-50 hover:bg-emerald-100 text-[#00875A]"
                          }`}
                        >
                          {isVideo ? (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Watch</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>{cachedOffline ? "Read Offline" : "Read"}</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await shareOrCopyMaterialLink(item);
                              setCopiedId(targetId);
                              window.setTimeout(() => setCopiedId(null), 2200);
                            }}
                            title="Share or copy direct link"
                            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-[#00875A] hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-pointer"
                          >
                            {copiedId === targetId ? (
                              <Check className="w-3.5 h-3.5 text-[#00875A]" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromShelf(item)}
                            disabled={busyId === targetId}
                            title={
                              selectedType === "Offline"
                                ? "Delete offline copy"
                                : "Remove from Saved"
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            {busyId === targetId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Remove</span>
                          </button>

                          {canDownloadPdf ? (
                            <button
                              type="button"
                              disabled={isDownloading}
                              onClick={() => handleDownload(item)}
                              className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 ${
                                cachedOffline
                                  ? "bg-emerald-50 border border-emerald-200 text-[#0C3B2E] hover:bg-emerald-100"
                                  : "bg-[#0C3B2E] hover:bg-[#0A251D] text-white"
                              }`}
                              title={
                                cachedOffline
                                  ? "Save PDF copy from offline vault"
                                  : "Download PDF & save for offline viewing"
                              }
                            >
                              {isDownloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : cachedOffline ? (
                                <HardDriveDownload className="w-3.5 h-3.5 text-[#00875A]" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">
                                {cachedOffline ? "Save Copy" : "Download"}
                              </span>
                            </button>
                          ) : (
                            item.youtubeUrl &&
                            !isOffline && (
                              <a
                                href={item.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all"
                                title="Open on YouTube"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* In-Page Reader & Video Player Modal */}
      <ResourceViewerModal
        material={activeMaterial}
        isBookmarked={
          activeMaterial ? isSaved(activeMaterial.resourceId || activeMaterial.id) : false
        }
        isTogglingBookmark={
          activeMaterial
            ? busyId === (activeMaterial.resourceId || activeMaterial.id)
            : false
        }
        onToggleBookmark={handleToggleBookmark}
        onClose={() => setActiveMaterial(null)}
      />

      <Footer />
    </div>
  );
}

export default function SavedVaultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
          <Navbar />
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">
              Loading saved &amp; offline materials...
            </p>
          </div>
          <Footer />
        </div>
      }
    >
      <SavedVaultContent />
    </Suspense>
  );
}
