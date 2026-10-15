"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENTS } from "@/lib/departments";
import {
  Search,
  Filter,
  FileText,
  Play,
  Download,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Loader2,
  ArrowRight,
  BookOpen,
} from "lucide-react";

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface ResourceItem {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester?: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  fileUrl?: string;
  fileSize?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  description?: string;
}

const LEVELS = ["All Levels", "100L", "200L", "300L", "400L", "500L"];
const CATEGORIES = ["All Categories", "Lecture Note", "Past Question", "Textbook", "Lab Manual", "Video Tutorial"];

export default function ResourcesCatalogPage() {
  const [liveResources, setLiveResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [selectedMedium, setSelectedMedium] = useState<"ALL" | "PDF" | "YOUTUBE">("ALL");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  // Fetch approved resources from API
  useEffect(() => {
    fetch("/api/resources")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.resources) {
          setLiveResources(data.resources);
        }
      })
      .catch((err) => console.error("Failed to fetch live resources:", err))
      .finally(() => setLoading(false));
  }, []);

  // Use only live verified resources from database
  const allResources = liveResources;

  // Handle Bookmark Save
  const handleBookmark = async (resItem: ResourceItem) => {
    try {
      setSavingId(resItem.id);
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resItem.id,
          title: resItem.title,
          courseCode: resItem.courseCode,
          department: resItem.department,
          type: resItem.type,
          fileSize: resItem.fileSize || "Cloudinary / R2 File",
        }),
      });

      if (res.ok) {
        setSavedSuccessId(resItem.id);
        setTimeout(() => setSavedSuccessId(null), 3000);
      }
    } catch (err) {
      console.error("Bookmark error:", err);
    } finally {
      setSavingId(null);
    }
  };

  const filteredResources = useMemo(() => {
    return allResources.filter((item) => {
      if (selectedDept !== "All Departments" && item.department !== selectedDept) return false;
      if (selectedLevel !== "All Levels" && item.level !== selectedLevel) return false;
      if (selectedMedium !== "ALL" && item.medium !== selectedMedium) return false;
      if (
        selectedCategory !== "All Categories" &&
        !item.type.toLowerCase().includes(selectedCategory.toLowerCase())
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = item.title.toLowerCase().includes(q);
        const mCode = item.courseCode.toLowerCase().includes(q);
        const mDept = item.department.toLowerCase().includes(q);
        const mDesc = (item.description || "").toLowerCase().includes(q);
        if (!mTitle && !mCode && !mDept && !mDesc) return false;
      }
      return true;
    });
  }, [allResources, selectedDept, selectedLevel, selectedMedium, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs mb-8">
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
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Academic Library & Resource Vault
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Browse verified lecture notes, past questions, textbooks, lab manuals, and video tutorials contributed by faculty lecturers and peer scholars.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
              >
                <span>Contribute Material</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by course code, title, topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
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
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>

            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value as "ALL" | "PDF" | "YOUTUBE")}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              <option value="ALL">All Media</option>
              <option value="PDF">PDF Documents</option>
              <option value="YOUTUBE">YouTube Videos</option>
            </select>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading faculty resources...</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900 mb-1">No materials found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Try adjusting your department or level filter, or be the first to upload lecture notes for this course.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00875A] text-white text-xs font-semibold"
            >
              <span>Submit Resource</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResources.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                          item.medium === "YOUTUBE"
                            ? "bg-red-50 text-red-700 border border-red-200/80"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                        }`}
                      >
                        {item.medium === "YOUTUBE" ? (
                          <YoutubeIcon className="w-3.5 h-3.5 text-red-600" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{item.medium === "YOUTUBE" ? "YouTube Video" : "PDF Document"}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-extrabold uppercase font-mono">
                        {item.courseCode}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.level}
                    </span>
                  </div>

                  {/* YouTube Thumbnail if applicable */}
                  {item.medium === "YOUTUBE" && item.youtubeVideoId && (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3 group/thumb">
                      <Image
                        src={`https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`}
                        alt="Video Thumbnail"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover/thumb:bg-black/35 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Title & Description */}
                  <Link href={`/resources/${item.id}`} className="block">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug mb-1.5 line-clamp-2">
                      {item.title}
                    </h3>
                  </Link>

                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{item.department}</span>
                    <span>•</span>
                    <span>{item.fileSize || "Free Access"}</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* View / Read in Browser */}
                    <Link
                      href={`/resources/${item.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#00875A] hover:text-[#00734c]"
                    >
                      <span>{item.medium === "YOUTUBE" ? "Watch Video" : "Read Online"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Action Buttons: Save & Direct Access */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleBookmark(item)}
                      disabled={savingId === item.id}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        savedSuccessId === item.id
                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      title="Save to My Profile Vault"
                    >
                      {savingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : savedSuccessId === item.id ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {item.fileUrl && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer"
                        title={item.medium === "YOUTUBE" ? "Open on YouTube" : "Direct Download / Cloudflare R2"}
                      >
                        {item.medium === "YOUTUBE" ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
