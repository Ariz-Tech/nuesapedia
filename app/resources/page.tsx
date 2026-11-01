"use client";

import { Suspense, useState, useEffect, useMemo, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ResourceViewerModal from "@/components/ResourceViewerModal";
import { DEPARTMENTS, getDepartmentBySlug } from "@/lib/departments";
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
} from "@/lib/offline-vault";
import { useSavedResources } from "@/context/SavedResourcesContext";
import {
  Search,
  FileText,
  Play,
  Download,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  ArrowRight,
  Eye,
  RotateCcw,
  HardDriveDownload,
  Share2,
  Check,
  Clock,
  MessageSquarePlus,
  X,
  ArrowUpDown,
  PackageOpen,
} from "lucide-react";

const LEVELS = ["All Levels", "100L", "200L", "300L", "400L", "500L"];
const SEMESTERS = ["All Semesters", "First Semester", "Second Semester"];
const CATEGORIES = [
  "All Categories",
  "Lecture Note",
  "Past Question",
  "Textbook",
  "Lab Manual",
  "Video Tutorial",
];
type SortOption = "newest" | "popular" | "course";

function normalizeCategoryParam(raw: string | null): string {
  if (!raw) return "All Categories";
  const lower = raw.trim().toLowerCase();
  if (lower.includes("lecture") || lower.includes("handout")) return "Lecture Note";
  if (lower.includes("past")) return "Past Question";
  if (lower.includes("textbook") || lower.includes("reference")) return "Textbook";
  if (lower.includes("lab")) return "Lab Manual";
  if (lower.includes("video")) return "Video Tutorial";
  const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
  return exact || "All Categories";
}

function ResourcesCatalogContent() {
  const searchParams = useSearchParams();
  const {
    isSaved,
    toggleSave,
    savedCount,
    refreshSaved,
    offlineDocs,
    offlineCount,
    isOfflineAvailable,
    downloadingIds,
    downloadMaterial,
    recentReadingIds,
    isOffline,
  } = useSavedResources();

  const [catalogResources, setCatalogResources] = useState<CourseMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting (initialized directly from URL query params without cascading effect setState)
  const [selectedDept, setSelectedDept] = useState(() => {
    const dept = searchParams.get("dept") || searchParams.get("department");
    if (!dept) return "All Departments";
    const bySlug = getDepartmentBySlug(dept);
    const byName = DEPARTMENTS.find((d) => d.toLowerCase() === dept.toLowerCase());
    return bySlug?.name || byName || dept;
  });
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [selectedSemester, setSelectedSemester] = useState(() => {
    const sem = searchParams.get("semester");
    return sem && SEMESTERS.includes(sem) ? sem : "All Semesters";
  });
  const [selectedCourse, setSelectedCourse] = useState(() => {
    const course = searchParams.get("course");
    return course ? course.toUpperCase() : "All Courses";
  });
  const [selectedMedium, setSelectedMedium] = useState<
    "ALL" | "PDF" | "YOUTUBE" | "OFFLINE"
  >(() => {
    const medium = searchParams.get("medium");
    return medium === "PDF" || medium === "YOUTUBE" || medium === "OFFLINE"
      ? medium
      : "ALL";
  });
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const category = searchParams.get("category");
    return category ? normalizeCategoryParam(category) : "All Categories";
  });
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get("search") ?? searchParams.get("q") ?? ""
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedDept,
    selectedLevel,
    selectedSemester,
    selectedCourse,
    selectedMedium,
    selectedCategory,
    deferredQuery,
    sortBy,
  ]);

  // Active Bookmark / Download / Share / Course Pack Toast & Viewer Modal
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<CourseMaterialItem | null>(null);
  const [downloadingPack, setDownloadingPack] = useState<boolean>(false);

  // Request Missing Material Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqCourseCode, setReqCourseCode] = useState("");
  const [reqDepartment, setReqDepartment] = useState<string>(DEPARTMENTS[0]);
  const [reqLevel, setReqLevel] = useState("200L");
  const [reqType, setReqType] = useState("Past Question");
  const [reqDetails, setReqDetails] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    if (!showRequestModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowRequestModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showRequestModal]);

  // Fetch approved course materials from API with bounded SQL pagination & IndexedDB offline fallback
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        let normalized: CourseMaterialItem[] = [];
        let fetchedOnline = false;

        // If user specifically requested OFFLINE items, read directly from IndexedDB
        if (selectedMedium === "OFFLINE") {
          const cached = await getCachedCatalogResources();
          const map = new Map<string, CourseMaterialItem>();
          for (const doc of offlineDocs) {
            if (doc.material) {
              map.set(doc.id, normalizeMaterial(doc.material));
            }
          }
          for (const c of cached) {
            if (isOfflineAvailable(c.resourceId || c.id) && !map.has(c.id)) {
              map.set(c.id, normalizeMaterial(c));
            }
          }
          const offlineList = Array.from(map.values());
          if (mounted) {
            setCatalogResources(offlineList);
            setTotalCount(offlineList.length);
            setTotalPages(Math.max(1, Math.ceil(offlineList.length / 24)));
            setLoading(false);
          }
          return;
        }

        if (typeof navigator === "undefined" || navigator.onLine) {
          try {
            const params = new URLSearchParams();
            params.set("page", String(currentPage));
            params.set("limit", "24");
            if (selectedDept !== "All Departments") params.set("department", selectedDept);
            if (selectedLevel !== "All Levels") params.set("level", selectedLevel);
            if (selectedSemester !== "All Semesters") params.set("semester", selectedSemester);
            if (selectedCourse !== "All Courses") params.set("course", selectedCourse);
            if (selectedCategory !== "All Categories") params.set("type", selectedCategory);
            if (selectedMedium !== "ALL") params.set("medium", selectedMedium);
            if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
            params.set("sort", sortBy);

            const res = await fetch(`/api/resources?${params.toString()}`);
            const data = res.ok ? await res.json() : null;
            const list = Array.isArray(data?.resources)
              ? data.resources
              : Array.isArray(data?.data)
                ? data.data
                : [];
            if (data?.success) {
              normalized = list.map((r: CourseMaterialItem) => normalizeMaterial(r));
              fetchedOnline = true;
              if (mounted) {
                setTotalCount(Number(data.pagination?.total) || normalized.length);
                setTotalPages(Number(data.pagination?.totalPages) || 1);
              }
              if (normalized.length > 0) {
                cacheCatalogResources(normalized).catch(() => {});
              }
            }
          } catch {
            fetchedOnline = false;
          }
        }

        if (!fetchedOnline || normalized.length === 0) {
          const cached = await getCachedCatalogResources();
          if (cached.length > 0) {
            normalized = cached;
            if (mounted) {
              setTotalCount(cached.length);
              setTotalPages(Math.max(1, Math.ceil(cached.length / 24)));
            }
          }
        }

        if (!mounted) return;
        setCatalogResources(normalized);
        await refreshSaved(normalized);

        // Auto-open viewer if ?open=<id> is provided
        const openId = new URLSearchParams(window.location.search).get("open");
        if (openId) {
          const found = normalized.find((r) => (r.resourceId || r.id) === openId);
          if (found) setActiveMaterial(found);
        }
      } catch (err) {
        console.error("Failed to fetch course materials:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [
    currentPage,
    selectedDept,
    selectedLevel,
    selectedSemester,
    selectedCourse,
    selectedMedium,
    selectedCategory,
    deferredQuery,
    sortBy,
    offlineDocs,
    isOfflineAvailable,
    refreshSaved,
  ]);

  // Merge live/cached catalog with all IndexedDB downloaded documents so downloaded PDFs are ALWAYS visible offline
  const allResources = useMemo(() => {
    const map = new Map<string, CourseMaterialItem>();
    for (const item of catalogResources) {
      map.set(item.id, item);
    }
    for (const doc of offlineDocs) {
      if (doc.material && !map.has(doc.id)) {
        map.set(doc.id, normalizeMaterial(doc.material));
      }
    }
    return Array.from(map.values());
  }, [catalogResources, offlineDocs]);

  // Recently opened / Continue Reading items (up to 3)
  const continueReadingItems = useMemo(() => {
    if (recentReadingIds.length === 0 || allResources.length === 0) return [];
    const lookup = new Map(allResources.map((r) => [r.resourceId || r.id, r]));
    const items: CourseMaterialItem[] = [];
    for (const id of recentReadingIds) {
      const found = lookup.get(id);
      if (found) items.push(found);
      if (items.length >= 3) break;
    }
    return items;
  }, [recentReadingIds, allResources]);

  // Dynamically derive available courses from loaded materials
  const availableCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allResources) {
      if (selectedDept !== "All Departments" && item.department !== selectedDept) continue;
      if (selectedLevel !== "All Levels" && item.level !== selectedLevel) continue;
      if (selectedSemester !== "All Semesters" && item.semester !== selectedSemester) continue;
      const code = item.courseCode.trim().toUpperCase();
      if (!map.has(code)) {
        const meta = resolveCourseMetadata(code, {
          department: item.department,
          level: item.level,
          semester: item.semester,
        });
        map.set(code, meta.title);
      }
    }
    return Array.from(map.entries())
      .map(([code, title]) => ({ code, title }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [allResources, selectedDept, selectedLevel, selectedSemester]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3400);
  };

  const handleToggleBookmark = async (item: CourseMaterialItem) => {
    const key = item.resourceId || item.id;
    try {
      setTogglingId(key);
      const nowSaved = await toggleSave(item);
      showToast(
        nowSaved
          ? `Saved "${item.title}" to your Saved materials`
          : `Removed "${item.title}" from Saved`
      );
    } catch (err) {
      console.error("Bookmark toggle error:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDownload = async (item: CourseMaterialItem) => {
    const res = await downloadMaterial(item, { saveToDevice: true });
    if (res.ok) {
      showToast(
        res.fromCache
          ? `Downloaded "${item.title}" from Offline Vault`
          : `Downloaded "${item.title}" & saved for offline reading`
      );
    } else if (res.error) {
      showToast(res.error);
    }
  };

  const handleShare = async (item: CourseMaterialItem) => {
    const key = item.resourceId || item.id;
    await shareOrCopyMaterialLink(item);
    setCopiedId(key);
    showToast(`Copied direct link to "${item.courseCode} — ${item.title}"`);
    window.setTimeout(() => setCopiedId(null), 2200);
  };

  const handleSubmitMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqCourseCode.trim()) return;
    try {
      setSubmittingRequest(true);
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: reqCourseCode.trim().toUpperCase(),
          department: reqDepartment,
          level: reqLevel,
          type: reqType,
          details: reqDetails.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowRequestModal(false);
        setReqCourseCode("");
        setReqDetails("");
        showToast("Material request sent to faculty moderators & student contributors!");
      } else {
        showToast(data?.error?.message || "Could not submit request right now.");
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const resetAllFilters = () => {
    setSelectedDept("All Departments");
    setSelectedLevel("All Levels");
    setSelectedSemester("All Semesters");
    setSelectedCourse("All Courses");
    setSelectedMedium("ALL");
    setSelectedCategory("All Categories");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedDept !== "All Departments" ||
    selectedLevel !== "All Levels" ||
    selectedSemester !== "All Semesters" ||
    selectedCourse !== "All Courses" ||
    selectedMedium !== "ALL" ||
    selectedCategory !== "All Categories" ||
    Boolean(searchQuery.trim());

  const filteredResources = useMemo(() => {
    // When online and not specifically filtering local Offline Vault, PostgreSQL already executed exact filtering & sorting
    if (typeof navigator !== "undefined" && navigator.onLine && selectedMedium !== "OFFLINE") {
      return catalogResources;
    }

    // Offline / local cache filtering
    const matches = allResources.filter((item) => {
      const canonicalId = item.resourceId || item.id;
      if (selectedDept !== "All Departments" && item.department !== selectedDept) return false;
      if (selectedLevel !== "All Levels" && item.level !== selectedLevel) return false;
      if (selectedSemester !== "All Semesters" && item.semester !== selectedSemester) return false;
      if (
        selectedCourse !== "All Courses" &&
        item.courseCode.trim().toUpperCase() !== selectedCourse
      ) {
        return false;
      }
      if (selectedMedium === "OFFLINE") {
        if (!isOfflineAvailable(canonicalId)) return false;
      } else if (selectedMedium !== "ALL" && item.medium !== selectedMedium) {
        return false;
      }
      if (selectedCategory !== "All Categories") {
        const catNeedle = selectedCategory.toLowerCase().replace(/s$/, "");
        const itemType = item.type.toLowerCase();
        if (selectedCategory === "Video Tutorial") {
          if (item.medium !== "YOUTUBE" && !itemType.includes("video")) return false;
        } else if (!itemType.includes(catNeedle)) {
          return false;
        }
      }
      if (deferredQuery.trim()) {
        const q = deferredQuery.toLowerCase().trim();
        const compactQ = q.replace(/\s+/g, "");
        const courseTitle = resolveCourseMetadata(item.courseCode).title.toLowerCase();
        const codeLower = item.courseCode.toLowerCase();
        const mTitle = item.title.toLowerCase().includes(q);
        const mCode = codeLower.includes(q) || codeLower.replace(/\s+/g, "").includes(compactQ);
        const mCourseName = courseTitle.includes(q);
        const mDept = item.department.toLowerCase().includes(q);
        const mDesc = (item.description || "").toLowerCase().includes(q);
        const mSession = (item.sessionYear || "").toLowerCase().includes(q);
        if (!mTitle && !mCode && !mCourseName && !mDept && !mDesc && !mSession) return false;
      }
      return true;
    });

    const sorted = [...matches];
    if (sortBy === "popular") {
      sorted.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    } else if (sortBy === "course") {
      sorted.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
    } else {
      sorted.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
    return sorted;
  }, [
    allResources,
    catalogResources,
    selectedDept,
    selectedLevel,
    selectedSemester,
    selectedCourse,
    selectedMedium,
    selectedCategory,
    deferredQuery,
    sortBy,
    isOfflineAvailable,
  ]);

  // Uncached PDFs for active course (for 1-click "Save Course Pack Offline")
  const uncachedCoursePdfs = useMemo(() => {
    if (selectedCourse === "All Courses") return [];
    return filteredResources.filter(
      (r) =>
        r.medium !== "YOUTUBE" &&
        Boolean(r.fileUrl) &&
        !isOfflineAvailable(r.resourceId || r.id)
    );
  }, [selectedCourse, filteredResources, isOfflineAvailable]);

  const handleSaveCoursePackOffline = async () => {
    if (uncachedCoursePdfs.length === 0 || downloadingPack) return;
    setDownloadingPack(true);
    let savedOk = 0;
    try {
      for (const pdf of uncachedCoursePdfs) {
        const res = await downloadMaterial(pdf, { saveToDevice: false });
        if (res.ok) savedOk++;
      }
      showToast(
        savedOk > 0
          ? `Saved ${savedOk} ${selectedCourse} ${savedOk === 1 ? "PDF" : "PDFs"} into your Offline Vault!`
          : "Could not cache course PDFs right now."
      );
    } finally {
      setDownloadingPack(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header & Unified Course Material Filter Bar */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4 text-emerald-400" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00875A]">
                  Digital Faculty Repository
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C3B2E] tracking-tight">
                Course Materials &amp; Resources
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                View all engineering course materials in one place — click any material to read documents, watch video lectures, bookmark to Saved, or download for offline reading.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {!isOffline && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedDept !== "All Departments" && DEPARTMENTS.includes(selectedDept)) {
                      setReqDepartment(selectedDept);
                    }
                    if (selectedCourse !== "All Courses") {
                      setReqCourseCode(selectedCourse);
                    } else if (searchQuery.trim()) {
                      setReqCourseCode(searchQuery.trim().toUpperCase().slice(0, 12));
                    }
                    setShowRequestModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4 text-[#00875A]" />
                  <span>Request Material</span>
                </button>
              )}
              <Link
                href="/saved"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs"
              >
                <Bookmark className="w-4 h-4 text-[#00875A]" />
                <span>Saved ({savedCount})</span>
              </Link>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
              >
                <span>Contribute Material</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search course code, course name, topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedCourse("All Courses");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              <option value="All Departments">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value);
                setSelectedCourse("All Courses");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>

            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setSelectedCourse("All Courses");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              {SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              <option value="All Courses">All Courses ({availableCourses.length})</option>
              {availableCourses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <select
              value={selectedMedium}
              onChange={(e) =>
                setSelectedMedium(
                  e.target.value as "ALL" | "PDF" | "YOUTUBE" | "OFFLINE"
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              <option value="ALL">All Formats</option>
              <option value="PDF">PDF Documents</option>
              <option value="YOUTUBE">Video Lectures</option>
              <option value="OFFLINE">Downloaded ({offlineCount})</option>
            </select>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMsg && (
          <div className="mb-5 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00875A] shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <Link
              href="/saved"
              className="text-[#00875A] hover:underline text-xs font-bold ml-4 shrink-0"
            >
              View Saved
            </Link>
          </div>
        )}

        {/* Continue Reading Strip (shown when user has recently opened documents and isn't deep-searching) */}
        {!loading && !hasActiveFilters && continueReadingItems.length > 0 && (
          <div className="mb-6 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              <Clock className="w-3.5 h-3.5 text-[#00875A]" />
              <span>Continue Reading</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {continueReadingItems.map((recent) => {
                const rid = recent.resourceId || recent.id;
                const isVid = recent.medium === "YOUTUBE";
                return (
                  <button
                    key={rid}
                    type="button"
                    onClick={() => setActiveMaterial(recent)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/80 hover:border-[#00875A]/50 hover:bg-emerald-50/30 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
                      {isVid ? (
                        <Play className="w-4 h-4 fill-current" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono text-[#0C3B2E]">
                          {recent.courseCode}
                        </span>
                        {isOfflineAvailable(rid) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-[#00875A]">
                            Offline
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-[#00875A] truncate">
                        {recent.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories, Course Pack Offline Button & Sort Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat && selectedMedium !== "OFFLINE"
                    ? "bg-[#0C3B2E] text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setSelectedMedium((prev) => (prev === "OFFLINE" ? "ALL" : "OFFLINE"))
              }
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedMedium === "OFFLINE"
                  ? "bg-[#00875A] text-white shadow-2xs"
                  : "bg-emerald-50 border border-emerald-200 text-[#0C3B2E] hover:bg-emerald-100"
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Downloaded ({offlineCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium shrink-0">
            {!isOffline && uncachedCoursePdfs.length > 0 && (
              <button
                type="button"
                disabled={downloadingPack}
                onClick={handleSaveCoursePackOffline}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                {downloadingPack ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PackageOpen className="w-3.5 h-3.5" />
                )}
                <span>
                  {downloadingPack
                    ? `Saving ${selectedCourse}...`
                    : `Save ${selectedCourse} Offline (${uncachedCoursePdfs.length} PDFs)`}
                </span>
              </button>
            )}

            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort course materials"
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="popular">Most Downloaded</option>
                <option value="course">Course Code (A–Z)</option>
              </select>
            </div>

            {!loading && (
              <span>
                Showing <strong className="text-slate-900">{totalCount || filteredResources.length}</strong>{" "}
                {(totalCount || filteredResources.length) === 1 ? "material" : "materials"}
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-[#00875A] font-semibold hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading course materials...</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-[#0C3B2E] mb-1">
              {selectedMedium === "OFFLINE"
                ? "No downloaded documents yet"
                : "No course materials found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
              {selectedMedium === "OFFLINE"
                ? "Click Download on any PDF handout, textbook, or past question to save it into your offline vault for reading without internet."
                : hasActiveFilters
                  ? "No materials matched your active filters. Reset filters or request this course material from peers and moderators."
                  : isOffline
                    ? "You are currently offline and no materials have been cached yet. Connect once and download documents to view them offline."
                    : "No approved course materials are in the repository yet. Contribute the first lecture note, past question, or video tutorial."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              {!isOffline && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        setReqCourseCode(searchQuery.trim().toUpperCase().slice(0, 12));
                      }
                      setShowRequestModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-[#0C3B2E] text-xs font-semibold cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-[#00875A]" />
                    <span>Request This Material</span>
                  </button>
                  <Link
                    href="/upload"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-semibold"
                  >
                    <span>Submit Material</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredResources.map((item) => {
                const canonicalId = item.resourceId || item.id;
                const isVideo = item.medium === "YOUTUBE";
                const bookmarked = isSaved(canonicalId);
                const cachedOffline = isOfflineAvailable(canonicalId);
                const isDownloading = downloadingIds.has(canonicalId);
                const badge = getResourceBadgeStyle(item);
                const courseMeta = resolveCourseMetadata(item.courseCode, {
                  department: item.department,
                  level: item.level,
                  semester: item.semester,
                });
                const canDownloadPdf = !isVideo && (Boolean(item.fileUrl) || cachedOffline);

                return (
                  <div
                    key={canonicalId}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: Resource Type Pill + Course Code + Top-Right Bookmark Icon */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${badge.className}`}
                          >
                            {badge.label}
                          </span>

                          <span className="px-2 py-0.5 rounded-md bg-[#0C3B2E] text-white text-[11px] font-bold uppercase font-mono">
                            {item.courseCode}
                          </span>

                          {item.sessionYear && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold">
                              {item.sessionYear}
                            </span>
                          )}

                          {cachedOffline && (
                            <span
                              title="Stored in browser IndexedDB for offline viewing"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#00875A] border border-emerald-200 text-[10px] font-bold"
                            >
                              <HardDriveDownload className="w-3 h-3" />
                              <span>Offline</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleBookmark(item)}
                          disabled={togglingId === canonicalId}
                          aria-label={bookmarked ? "Remove from Saved" : "Save resource"}
                          title={bookmarked ? "Remove from Saved" : "Bookmark to Saved"}
                          className="p-1.5 -mr-1.5 -mt-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                        >
                          {togglingId === canonicalId ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          ) : bookmarked ? (
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
                          className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3 group/thumb block cursor-pointer text-left"
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
                            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md group-hover/thumb:scale-105 transition-transform">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Course Name Subtitle */}
                      <div className="text-[11px] font-semibold text-[#00875A] mb-1 line-clamp-1">
                        {courseMeta.title}
                      </div>

                      {/* Material Title (opens Reader / Video Player) */}
                      <button
                        type="button"
                        onClick={() => setActiveMaterial(item)}
                        className="text-left block w-full cursor-pointer"
                      >
                        <h3 className="text-base sm:text-lg font-bold text-[#0C3B2E] group-hover:text-[#00875A] transition-colors leading-snug mb-1.5 line-clamp-2">
                          {item.title}
                        </h3>
                      </button>

                      {item.description && (
                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span className="truncate max-w-[160px]">{item.department}</span>
                        {item.level && (
                          <>
                            <span>&bull;</span>
                            <span className="shrink-0">{item.level}</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span className="shrink-0">{item.fileSize || "Free Access"}</span>
                      </div>
                    </div>

                    {/* Action Bar: Read / Watch, Share, Download */}
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
                          onClick={() => handleShare(item)}
                          title="Share or copy direct link"
                          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-[#00875A] hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-pointer"
                        >
                          {copiedId === canonicalId ? (
                            <Check className="w-3.5 h-3.5 text-[#00875A]" />
                          ) : (
                            <Share2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {canDownloadPdf ? (
                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() => handleDownload(item)}
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 ${
                              cachedOffline
                                ? "bg-emerald-50 border border-emerald-200 text-[#0C3B2E] hover:bg-emerald-100"
                                : "bg-[#0C3B2E] hover:bg-[#0A251D] text-white"
                            }`}
                            title={
                              cachedOffline
                                ? "Available offline — click to save another PDF copy"
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
                            <span>{cachedOffline ? "Downloaded" : "Download"}</span>
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

            {/* Server-backed Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  Showing page <strong className="text-slate-900">{currentPage}</strong> of{" "}
                  <strong className="text-slate-900">{totalPages}</strong>{" "}
                  ({totalCount || filteredResources.length}{" "}
                  {(totalCount || filteredResources.length) === 1 ? "material" : "materials"})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-2xs transition-all"
                  >
                    Previous Page
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-4 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold disabled:opacity-40 cursor-pointer shadow-2xs transition-all"
                  >
                    Next Page
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Request Missing Material Modal */}
      {showRequestModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRequestModal(false);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00875A]">
                  Student Request Board
                </span>
                <h3
                  id="request-modal-title"
                  className="text-lg font-extrabold text-[#0C3B2E] mt-0.5"
                >
                  Request Missing Course Material
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close request modal"
                onClick={() => setShowRequestModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMaterialRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MEE 305"
                    value={reqCourseCode}
                    onChange={(e) => setReqCourseCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Level
                  </label>
                  <select
                    value={reqLevel}
                    onChange={(e) => setReqLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                  >
                    {["100L", "200L", "300L", "400L", "500L"].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <select
                  value={reqDepartment}
                  onChange={(e) => setReqDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Needed Material Type
                </label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                >
                  <option value="Past Question">Past Question</option>
                  <option value="Lecture Note">Lecture Note / Handout</option>
                  <option value="Textbook">Textbook / Reference</option>
                  <option value="Lab Manual">Lab Manual</option>
                  <option value="Video Tutorial">Video Tutorial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Details / Session Needed (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reqDetails}
                  onChange={(e) => setReqDetails(e.target.value)}
                  placeholder="e.g. 2023/2024 Second Semester Past Questions or Dr. Adeyemi's slides"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest || !reqCourseCode.trim()}
                  className="px-5 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submittingRequest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-Page Reader & Video Player Modal */}
      <ResourceViewerModal
        material={activeMaterial}
        isBookmarked={
          activeMaterial ? isSaved(activeMaterial.resourceId || activeMaterial.id) : false
        }
        isTogglingBookmark={
          activeMaterial
            ? togglingId === (activeMaterial.resourceId || activeMaterial.id)
            : false
        }
        onToggleBookmark={handleToggleBookmark}
        onClose={() => setActiveMaterial(null)}
      />

      <Footer />
    </div>
  );
}

function ResourcesCatalogKeyedWrapper() {
  const searchParams = useSearchParams();
  return <ResourcesCatalogContent key={searchParams.toString()} />;
}

export default function ResourcesCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
          <Navbar />
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading course materials...</p>
          </div>
          <Footer />
        </div>
      }
    >
      <ResourcesCatalogKeyedWrapper />
    </Suspense>
  );
}
