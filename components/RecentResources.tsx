"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { FileText, ChevronRight, Play, BookOpen, AlertCircle } from "lucide-react";
import { getResourceBadgeStyle } from "@/lib/badge-styles";

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
      accent: "text-sky-200",
      subAccent: "text-sky-100/90",
    };
  }
  if (d.includes("mech")) {
    return {
      bg: "linear-gradient(135deg, #1e1b4b 0%, #1e3a8a 100%)",
      tag: "THERMAL & DYNAMICS",
      accent: "text-indigo-200",
      subAccent: "text-indigo-100/90",
    };
  }
  if (d.includes("material")) {
    return {
      bg: "linear-gradient(135deg, #292524 0%, #44403c 100%)",
      tag: "METALLURGY & SOLIDS",
      accent: "text-orange-200",
      subAccent: "text-stone-200",
    };
  }
  if (d.includes("agric") || d.includes("bio")) {
    return {
      bg: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
      tag: "HYDROLOGY & BIO",
      accent: "text-emerald-200",
      subAccent: "text-emerald-100/90",
    };
  }
  if (d.includes("mining")) {
    return {
      bg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)",
      tag: "MINERAL & GEOLOGY",
      accent: "text-amber-200",
      subAccent: "text-amber-100/90",
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A251D 0%, #0C3B2E 100%)",
    tag: "ENGINEERING FACULTY",
    accent: "text-emerald-200",
    subAccent: "text-emerald-100/90",
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

  const fetchLatest = useCallback(async (signal?: AbortSignal) => {
    const res = await fetch("/api/resources?limit=4", { signal });
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
    const controller = new AbortController();

    (async () => {
      try {
        const items = await fetchLatest(controller.signal);
        if (active) setResources(items);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (active) {
          setError("Unable to load latest resources. Please check your connection.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [hasInitial, fetchLatest]);

  return (
    <section className="py-16 md:py-20 bg-surface border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-forest">
              Recently Added Resources
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Latest peer-reviewed lecture notes, exam past questions, and video modules verified by faculty moderators.
            </p>
          </div>

          <Link
            href="/resources"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-emerald hover:text-brand-emerald-hover transition-colors shrink-0 group self-start sm:self-auto"
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
                className="bg-surface-subtle border border-slate-200/80 rounded-2xl h-72 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 p-8 text-center bg-rose-50/70 rounded-2xl border border-rose-200/80">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2.5" />
            <h3 className="text-base font-bold text-rose-900">
              Failed to Load Resources
            </h3>
            <p className="text-xs sm:text-sm text-rose-700 mt-1 max-w-md mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : resources.length === 0 ? (
          <div className="mt-8 p-12 text-center bg-surface-subtle rounded-2xl border border-dashed border-slate-300">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
            <h3 className="text-base font-bold text-brand-forest">
              No Approved Resources Yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Be the first student or faculty member to contribute verified study notes or exam solutions.
            </p>
            <Link
              href="/upload"
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-emerald text-white text-xs sm:text-sm font-semibold hover:bg-brand-emerald-hover transition-colors"
            >
              Upload First Material
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {resources.map((item) => {
              const cover = getDepartmentCover(item.department);
              const isVideo = item.medium === "YOUTUBE";
              const badge = getResourceBadgeStyle(item);

              return (
                <Link
                  key={item.id}
                  href={`/resources/${item.id}`}
                  className="group bg-surface border border-slate-200/90 rounded-2xl overflow-hidden hover:border-slate-300 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div
                      className="h-40 w-full relative overflow-hidden"
                      style={{
                        background:
                          isVideo && item.thumbnailUrl ? "#0f172a" : cover.bg,
                      }}
                    >
                      {isVideo && item.thumbnailUrl ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={item.thumbnailUrl}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 25vw"
                            className="object-cover opacity-85 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col justify-between p-4 text-white relative">
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-15"
                            style={{
                              backgroundImage:
                                "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
                              backgroundSize: "14px 14px",
                            }}
                          />
                          <div className="relative z-10">
                            <span
                              className={`text-[10px] tracking-widest uppercase font-mono font-semibold ${cover.accent}`}
                            >
                              {cover.tag}
                            </span>
                            <div className="text-base font-extrabold tracking-tight text-white font-mono mt-1">
                              {item.courseCode}
                            </div>
                          </div>
                          <div className="relative z-10 flex items-center justify-between text-[11px] font-mono border-t border-white/15 pt-2 text-white/80">
                            <span>{item.level}</span>
                            <span className="font-semibold text-white uppercase truncate ml-2">
                              {item.department.split(" ")[0]}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                        <span
                          className={`text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-brand-forest text-white">
                          {item.courseCode}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-brand-forest group-hover:text-brand-emerald transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  <div className="px-5 pb-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 truncate">
                      {isVideo ? (
                        <Play className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {isVideo
                          ? "YouTube Tutorial"
                          : item.fileSize || "PDF Document"}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold text-brand-emerald bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
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
