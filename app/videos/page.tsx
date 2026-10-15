"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENTS } from "@/lib/departments";
import {
  Play,
  Search,
  Filter,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  Eye,
} from "lucide-react";

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface VideoItem {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
  description: string;
  duration?: string;
}

const VIDEO_CATEGORIES = [
  "All Categories",
  "Exam Walkthrough",
  "Concept Crash Course",
  "Lab Demonstration",
  "Lecture Series",
  "Video Tutorial",
];
const LEVELS = ["All Levels", "100L", "200L", "300L", "400L", "500L"];

export default function VideoVaultPage() {
  const [liveVideos, setLiveVideos] = useState<VideoItem[]>([]);
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/resources?medium=YOUTUBE")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.resources) {
          const vids: VideoItem[] = data.resources
            .filter((r: { medium: string; youtubeVideoId?: string }) => r.medium === "YOUTUBE" && r.youtubeVideoId)
            .map((r: {
              id: string;
              title: string;
              courseCode: string;
              department: string;
              level: string;
              type: string;
              youtubeUrl?: string;
              youtubeVideoId: string;
              thumbnailUrl?: string;
              description?: string;
            }) => ({
              id: r.id,
              title: r.title,
              courseCode: r.courseCode,
              department: r.department,
              level: r.level,
              type: r.type,
              youtubeUrl: r.youtubeUrl || `https://www.youtube.com/watch?v=${r.youtubeVideoId}`,
              youtubeVideoId: r.youtubeVideoId,
              thumbnailUrl: r.thumbnailUrl || `https://img.youtube.com/vi/${r.youtubeVideoId}/hqdefault.jpg`,
              description: r.description || "",
              duration: "Tutorial",
            }));
          setLiveVideos(vids);
        }
      })
      .catch((err) => console.error("Error loading video vault:", err));
  }, []);

  const allVideos = liveVideos;

  const filteredVideos = useMemo(() => {
    return allVideos.filter((v) => {
      if (selectedDept !== "All Departments" && v.department !== selectedDept) return false;
      if (selectedLevel !== "All Levels" && v.level !== selectedLevel) return false;
      if (selectedCategory !== "All Categories" && !v.type.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = v.title.toLowerCase().includes(q);
        const mCode = v.courseCode.toLowerCase().includes(q);
        const mDesc = v.description.toLowerCase().includes(q);
        if (!mTitle && !mCode && !mDesc) return false;
      }
      return true;
    });
  }, [allVideos, selectedDept, selectedLevel, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
                  <Play className="w-4 h-4 fill-white" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                  Visual Learning Vault
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Engineering Video Vault
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Master complex formulas, watch laboratory demonstrations, and ace exam walkthroughs recorded for Faculty of Engineering students.
              </p>
            </div>

            <div>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
              >
                <YoutubeIcon className="w-4 h-4 text-white" />
                <span>Submit Video Tutorial</span>
              </Link>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tutorials, courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              {LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              {VIDEO_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-3xl overflow-hidden shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Thumbnail Image */}
                <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover:bg-black/35 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-bold">
                      {video.duration}
                    </div>
                  )}
                </div>

                {/* Content Details */}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs font-extrabold uppercase">
                      {video.courseCode}
                    </span>
                    <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                      {video.type}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-700 transition-colors leading-snug line-clamp-2 mb-2">
                    {video.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {video.description}
                  </p>

                  <div className="text-[11px] text-slate-400 font-medium">
                    {video.department} • {video.level}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-5 pt-0 flex items-center justify-between gap-3">
                <Link
                  href={`/resources/${video.id}`}
                  className="text-xs font-bold text-slate-900 hover:text-red-600 inline-flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Video Player</span>
                </Link>

                <a
                  href={video.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors"
                  title="Watch on YouTube"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
