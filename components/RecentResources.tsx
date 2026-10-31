"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText, ChevronRight, Play, BookOpen, AlertCircle } from "lucide-react";

export interface RecentResourceItem {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  fileSize?: string;
  youtubeUrl?: string;
  thumbnailUrl?: string;
}

function getDepartmentCover(dept: string) {
  const d = (dept || "").toLowerCase();
  if (d.includes("civil")) {
    return {
      bg: "linear-gradient(135deg, #082f49 0%, #0369a1 100%)",
      tag: "STRUCTURAL & CIVIL",
      accent: "text-sky-300",
      subAccent: "text-sky-200",
    };
  }
  if (d.includes("mech")) {
    return {
      bg: "linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 100%)",
      tag: "THERMAL & DYNAMICS",
      accent: "text-indigo-300",
      subAccent: "text-indigo-200",
    };
  }
  if (d.includes("material")) {
    return {
      bg: "linear-gradient(135deg, #292524 0%, #44403c 100%)",
      tag: "METALLURGY & SOLIDS",
      accent: "text-orange-300",
      subAccent: "text-stone-300",
    };
  }
  if (d.includes("agric") || d.includes("bio")) {
    return {
      bg: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
      tag: "HYDROLOGY & BIO",
      accent: "text-emerald-300",
      subAccent: "text-emerald-200",
    };
  }
  if (d.includes("mining")) {
    return {
      bg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      tag: "MINERAL & GEOLOGY",
      accent: "text-amber-300",
      subAccent: "text-amber-200",
    };
  }
  return {
    bg: "linear-gradient(135deg, #0f172a 0%, #334155 100%)",
    tag: "ENGINEERING FACULTY",
    accent: "text-slate-300",
    subAccent: "text-slate-200",
  };
}

export default function RecentResources({
  initialResources,
}: {
  initialResources?: RecentResourceItem[];
}) {
  const hasInitial = Array.isArray(initialResources);
  const [resources, setResources] = useState<RecentResourceItem[]>(
    initialResources ?? []
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    const res = await fetch("/api/resources?limit=4");
    if (!res.ok) throw new Error("Could not load recent resources");
    const data = await res.json();
    return data?.success && Array.isArray(data.resources)
      ? (data.resources.slice(0, 4) as RecentResourceItem[])
      : [];
  }, []);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchLatest();
      setResources(items);
    } catch {
      setError("Unable to load latest resources. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasInitial) return;
    let active = true;

    (async () => {
      try {
        const items = await fetchLatest();
        if (active) setResources(items);
      } catch {
        if (active) {
          setError("Unable to load latest resources. Please check your connection.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [hasInitial, fetchLatest]);

  return (
    <section className="py-16 md:py-20 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Recently Added Resources
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl">
              Latest peer-reviewed lecture notes, exam past questions, and video modules verified by faculty moderators.
            </p>
          </div>

          <Link
            href="/resources"
            className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-[#00875A] transition-colors shrink-0 group"
          >
            <span>View All Vault Materials</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl h-64 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 p-8 text-center bg-rose-50/60 rounded-3xl border border-rose-200/80">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h3 className="text-base font-bold text-rose-900">
              Failed to Load Resources
            </h3>
            <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : resources.length === 0 ? (
          <div className="mt-8 p-12 text-center bg-slate-50 rounded-3xl border border-slate-200/80">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-800">
              No Approved Resources Yet
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Be the first student or faculty member to contribute verified study notes or exam solutions.
            </p>
            <Link
              href="/upload"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00875A] text-white text-xs font-semibold hover:bg-[#00734c] transition-colors"
            >
              Upload First Material
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map((item) => {
              const cover = getDepartmentCover(item.department);
              const isVideo = item.medium === "YOUTUBE";

              return (
                <Link
                  key={item.id}
                  href={`/resources/${item.id}`}
                  className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] flex flex-col justify-between"
                >
                  <div>
                    <div
                      className="h-44 w-full rounded-t-2xl relative transition-transform duration-300 group-hover:scale-[1.01] overflow-hidden"
                      style={{
                        background:
                          isVideo && item.thumbnailUrl ? "#000" : cover.bg,
                      }}
                    >
                      {isVideo && item.thumbnailUrl ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={item.thumbnailUrl}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 25vw"
                            className="object-cover opacity-85 group-hover:opacity-95 transition-opacity"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </span>
                          </div>
                          <div className="absolute bottom-2.5 left-3 right-3 text-white">
                            <span className="text-[10px] font-mono tracking-wider uppercase text-red-300 font-semibold">
                              Video Tutorial
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col justify-between p-4 text-white relative">
                          <div className="absolute top-2 right-2 opacity-15">
                            <svg
                              width="70"
                              height="70"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1"
                            >
                              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                              <path d="M6 6h10" />
                              <path d="M6 10h10" />
                            </svg>
                          </div>
                          <div>
                            <span
                              className={`text-[10px] tracking-widest uppercase font-mono font-medium ${cover.accent}`}
                            >
                              {cover.tag}
                            </span>
                            <h4 className="text-sm font-bold tracking-tight text-white mt-0.5 leading-snug line-clamp-2">
                              {item.courseCode}
                            </h4>
                            <span
                              className={`text-[11px] font-medium line-clamp-2 ${cover.subAccent}`}
                            >
                              {item.title}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-mono border-t border-white/10 pt-2 text-slate-300">
                            <span>{item.level}</span>
                            <span className="font-semibold text-white uppercase">
                              {item.type}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.department}
                        </span>
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#00875A]">
                          {item.courseCode}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0C3B2E] transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="px-4 sm:px-5 pb-4 pt-1 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      {isVideo ? (
                        <Play className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isVideo
                          ? "YouTube Tutorial"
                          : item.fileSize || "PDF Document"}
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Verified
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
