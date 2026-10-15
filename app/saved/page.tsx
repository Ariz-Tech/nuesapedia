"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENTS } from "@/lib/departments";
import {
  Bookmark,
  BookmarkX,
  FileText,
  Play,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  BookOpen,
  Loader2,
  ExternalLink,
  GraduationCap,
  Layers,
  CheckCircle2,
} from "lucide-react";

interface SavedItem {
  id: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type: string;
  fileSize: string;
  createdAt: string;
}

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export default function SavedVaultPage() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedVault();
  }, []);

  const fetchSavedVault = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saved");
      const data = await res.json();

      if (res.status === 401 || !data.success) {
        setIsAuthenticated(false);
        setSavedItems([]);
        return;
      }

      setIsAuthenticated(true);
      setSavedItems(data.data || []);
    } catch (err) {
      console.error("Failed to fetch saved vault:", err);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (resourceId: string, itemTitle: string) => {
    try {
      setRemovingId(resourceId);
      const res = await fetch(`/api/saved?resourceId=${encodeURIComponent(resourceId)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSavedItems((prev) => prev.filter((item) => item.resourceId !== resourceId));
        setFeedbackMsg(`"${itemTitle}" removed from your vault`);
        setTimeout(() => setFeedbackMsg(null), 3500);
      }
    } catch (err) {
      console.error("Failed to remove item:", err);
    } finally {
      setRemovingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    return savedItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        item.title.toLowerCase().includes(q) ||
        item.courseCode.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q);

      const matchesDept =
        selectedDept === "All" ||
        item.department.toLowerCase().includes(selectedDept.toLowerCase());

      const isVideo =
        item.type.toLowerCase().includes("video") ||
        item.type.toLowerCase().includes("youtube");
      const matchesType =
        selectedType === "All" ||
        (selectedType === "PDF" && !isVideo) ||
        (selectedType === "Video" && isVideo);

      return matchesQuery && matchesDept && matchesType;
    });
  }, [savedItems, searchQuery, selectedDept, selectedType]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200/80 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3">
              <Bookmark className="w-3.5 h-3.5 text-[#00875A]" />
              <span>Personal Academic Vault • Flow 4</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Saved Resources
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
              Your personal shelf of bookmarked textbooks, past question solutions, and video tutorials. Synchronized across devices with one-click offline access.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-all"
            >
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Browse Catalog</span>
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold shadow-2xs transition-all"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Explore Courses</span>
            </Link>
          </div>
        </div>

        {/* Toast Feedback */}
        {feedbackMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
              <span>{feedbackMsg}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading your saved vault...</p>
          </div>
        )}

        {/* Guest / Unauthenticated State */}
        {!loading && isAuthenticated === false && (
          <div className="max-w-xl mx-auto py-16 px-6 text-center bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Bookmark className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Sign In to Access Your Saved Vault
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              Save key study manuals, syllabus past questions, and YouTube tutorials to access them anytime without searching again.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login?redirect=/saved"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-sm font-semibold transition-all shadow-sm"
              >
                Log In to Your Account
              </Link>
              <Link
                href="/signup"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all"
              >
                Create Free Account
              </Link>
            </div>
          </div>
        )}

        {/* Authenticated Vault View */}
        {!loading && isAuthenticated && (
          <>
            {/* Filter Bar */}
            <div className="mb-8 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter saved items by course, title, or department..."
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

                <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/80">
                  <button
                    onClick={() => setSelectedType("All")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedType === "All"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All ({savedItems.length})
                  </button>
                  <button
                    onClick={() => setSelectedType("PDF")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedType === "PDF"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setSelectedType("Video")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedType === "Video"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Videos
                  </button>
                </div>
              </div>
            </div>

            {/* Empty Vault State */}
            {savedItems.length === 0 && (
              <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8">
                <Bookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-800">Your Vault is Empty</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                  Browse the master library or engineering video vault and click the bookmark button to save items here for quick offline reference.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link
                    href="/resources"
                    className="px-5 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold shadow-2xs"
                  >
                    Browse Resources
                  </Link>
                  <Link
                    href="/videos"
                    className="px-5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                  >
                    Watch Videos
                  </Link>
                </div>
              </div>
            )}

            {/* Filtered Empty State */}
            {savedItems.length > 0 && filteredItems.length === 0 && (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8">
                <BookmarkX className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-700">No matching saved items</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Try clearing your search query or selecting &quot;All Departments&quot;.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDept("All");
                    setSelectedType("All");
                  }}
                  className="mt-4 px-4 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Reset Filters
                </button>
              </div>
            )}

            {/* Saved Cards Grid */}
            {filteredItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => {
                  const isVideo =
                    item.type.toLowerCase().includes("video") ||
                    item.type.toLowerCase().includes("youtube");

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                    >
                      <div className="p-5">
                        {/* Course & Type Badges */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                            {item.courseCode}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              isVideo
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isVideo ? (
                              <YoutubeIcon className="w-3.5 h-3.5 text-red-600" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-[#00875A]" />
                            )}
                            <span>{item.type || (isVideo ? "Video" : "PDF")}</span>
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 group-hover:text-[#00875A] transition-colors">
                          {item.title}
                        </h3>

                        {/* Department & File Size */}
                        <p className="mt-2 text-xs text-slate-500 line-clamp-1">
                          {item.department}
                        </p>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium border-t border-slate-100 pt-3">
                          <span>Size: {item.fileSize || "6.2 MB"}</span>
                          <span>
                            Saved {new Date(item.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                        <Link
                          href={`/resources/${item.resourceId}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00875A] hover:text-[#00734c] transition-colors"
                        >
                          <span>{isVideo ? "Watch Video" : "Read Online"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRemove(item.resourceId, item.title)}
                            disabled={removingId === item.resourceId}
                            title="Remove from saved vault"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            {removingId === item.resourceId ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
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

      <Footer />
    </div>
  );
}
