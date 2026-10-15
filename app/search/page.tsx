"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
  ArrowRight,
  Sparkles,
  Loader2,
  BookOpen,
  GraduationCap,
  Layers,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  type: string;
  medium: string;
  department: string;
  level: string;
  course: {
    code: string;
    title: string;
  };
  fileUrl?: string;
  youtubeUrl?: string;
  highlight?: string;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [selectedMedium, setSelectedMedium] = useState("All");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [query, selectedDept, selectedLevel, selectedMedium]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedDept !== "All") params.set("department", selectedDept);
      if (selectedLevel !== "All") params.set("level", selectedLevel);
      if (selectedMedium !== "All") params.set("type", selectedMedium);

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setResults(data.data || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (item: SearchItem) => {
    try {
      setSavingId(item.id);
      const isAlready = savedIds.has(item.id);

      if (isAlready) {
        await fetch(`/api/bookmarks/${item.id}`, { method: "DELETE" });
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      } else {
        await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: item.id,
            title: item.title,
            courseCode: item.course.code,
            department: item.department,
            type: item.type,
            fileSize: "6.0 MB",
          }),
        });
        setSavedIds((prev) => new Set(prev).add(item.id));
      }
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Header */}
      <div className="max-w-3xl mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3">
          <Search className="w-3.5 h-3.5 text-[#00875A]" />
          <span>Global Search Engine • Flow 1</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Find Engineering Resources
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-500 leading-relaxed">
          Search across 100L through 500L course codes, textbook titles, past examinations, and tutorial videos across all 5 engineering departments.
        </p>

        {/* Global Search Bar */}
        <div className="mt-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Type course code or keyword (e.g. MEE 302, Fluid Mechanics, Truss, MNE 201)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Department */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
          >
            <option value="All">All 5 Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Level */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
          >
            <option value="All">All Levels</option>
            <option value="100">100L General</option>
            <option value="200">200L Foundation</option>
            <option value="300">300L Professional</option>
            <option value="400">400L Advanced</option>
            <option value="500">500L Final Year</option>
          </select>
        </div>

        {/* Medium Selector */}
        <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200/80">
          <button
            onClick={() => setSelectedMedium("All")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedMedium === "All"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Formats
          </button>
          <button
            onClick={() => setSelectedMedium("PDF")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedMedium === "PDF"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            PDF Documents
          </button>
          <button
            onClick={() => setSelectedMedium("YOUTUBE")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedMedium === "YOUTUBE"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            YouTube Videos
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Searching faculty repository...</p>
        </div>
      )}

      {/* Results Count */}
      {!loading && (
        <div className="mb-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          Found {results.length} Matching Engineering Materials
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No resources found</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Try searching for broader keywords like &quot;Thermodynamics&quot;, &quot;Civil&quot;, or &quot;MEE 201&quot;.
          </p>
          <button
            onClick={() => {
              setQuery("");
              setSelectedDept("All");
              setSelectedLevel("All");
              setSelectedMedium("All");
            }}
            className="mt-5 px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Search Result Cards Grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((item) => {
            const isVideo = item.medium === "YOUTUBE";
            const isSaved = savedIds.has(item.id);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                      {item.course.code}
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
                      <span>{item.type}</span>
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 group-hover:text-[#00875A] transition-colors">
                    {item.title}
                  </h3>

                  {/* Description / Highlight */}
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {item.highlight || item.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium border-t border-slate-100 pt-3">
                    <span>{item.department}</span>
                    <span>{item.level}</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
                  <Link
                    href={`/resources/${item.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00875A] hover:text-[#00734c] transition-colors"
                  >
                    <span>{isVideo ? "Watch Video" : "Read Online"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => handleBookmark(item)}
                    disabled={savingId === item.id}
                    title={isSaved ? "Saved in Vault" : "Save to Vault"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isSaved
                        ? "text-[#00875A] bg-emerald-50"
                        : "text-slate-400 hover:text-[#00875A] hover:bg-emerald-50"
                    }`}
                  >
                    <Bookmark
                      className={`w-4 h-4 ${isSaved ? "fill-[#00875A]" : ""}`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin" />
          </div>
        }
      >
        <SearchPageContent />
      </Suspense>
      <Footer />
    </div>
  );
}
