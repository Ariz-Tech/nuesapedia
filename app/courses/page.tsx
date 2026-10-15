"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENTS } from "@/lib/departments";
import {
  BookOpen,
  Search,
  Layers,
  ArrowRight,
  Sparkles,
  Loader2,
  FileText,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";

interface CourseItem {
  code: string;
  title: string;
  units: number;
  department: string;
  level: string;
  semester: "First Semester" | "Second Semester";
  description: string;
  resourceCount: number;
}

const LEVELS = ["All Levels", "100L", "200L", "300L", "400L", "500L"];
const SEMESTERS = ["All Semesters", "First Semester", "Second Semester"];

export default function CoursesCatalogPage() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [selectedSemester, setSelectedSemester] = useState("All Semesters");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch("/api/courses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load approved courses");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data?.success && Array.isArray(data.courses)) {
            setCourses(data.courses);
          } else {
            setCourses([]);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Error fetching approved courses:", err);
          setError("Failed to load approved faculty courses from database.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (selectedDept !== "All Departments" && course.department !== selectedDept) {
        return false;
      }
      if (selectedLevel !== "All Levels" && course.level !== selectedLevel) {
        return false;
      }
      if (selectedSemester !== "All Semesters" && course.semester !== selectedSemester) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = course.code.toLowerCase().includes(q);
        const matchTitle = course.title.toLowerCase().includes(q);
        const matchDesc = course.description.toLowerCase().includes(q);
        const matchDept = course.department.toLowerCase().includes(q);
        if (!matchCode && !matchTitle && !matchDesc && !matchDept) {
          return false;
        }
      }
      return true;
    });
  }, [courses, selectedDept, selectedLevel, selectedSemester, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center shadow-xs">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00875A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Faculty Curriculum
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Engineering Courses Directory
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Official faculty courses with approved, peer-reviewed study materials in the database across Civil, Mechanical, Materials, Agric, and Mining departments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-[#00875A]" />
                <span>Submit Material</span>
              </Link>
              <Link
                href="/resources"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Browse All Resources</span>
              </Link>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search course code, title, or keyword..."
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
              <option value="All Departments">All 5 Departments</option>
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
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              {SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count Bar */}
        <div className="flex items-center justify-between mb-6 text-xs text-slate-500 font-medium">
          <span>
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00875A]" />
                Querying verified database courses...
              </span>
            ) : (
              <span>
                Showing <strong className="text-slate-800">{filteredCourses.length}</strong> verified courses in database
              </span>
            )}
          </span>
          {(selectedDept !== "All Departments" || selectedLevel !== "All Levels" || selectedSemester !== "All Semesters" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedDept("All Departments");
                setSelectedLevel("All Levels");
                setSelectedSemester("All Semesters");
                setSearchQuery("");
              }}
              className="text-[#00875A] font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs animate-pulse flex flex-col justify-between h-56"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-16 h-6 bg-slate-200 rounded-lg" />
                    <div className="w-20 h-5 bg-slate-100 rounded-lg" />
                  </div>
                  <div className="w-3/4 h-5 bg-slate-200 rounded mb-2" />
                  <div className="w-full h-3 bg-slate-100 rounded mb-1.5" />
                  <div className="w-2/3 h-3 bg-slate-100 rounded" />
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="w-28 h-4 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCourses.length === 0 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-10 text-center max-w-xl mx-auto shadow-xs my-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              No Approved Courses Found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              {searchQuery || selectedDept !== "All Departments" || selectedLevel !== "All Levels"
                ? "No verified courses matched your active filter criteria. Try clearing search filters to see all available faculty courses."
                : "There are currently no approved courses in the database. When materials are submitted and approved through moderation, they will automatically appear here."}
            </p>
            <div className="flex items-center justify-center gap-3">
              {(selectedDept !== "All Departments" || selectedLevel !== "All Levels" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept("All Departments");
                    setSelectedLevel("All Levels");
                    setSelectedSemester("All Semesters");
                    setSearchQuery("");
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-semibold transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Submit Course Note</span>
              </Link>
            </div>
          </div>
        )}

        {/* Database-backed Course Cards Grid */}
        {!loading && filteredCourses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course) => (
              <div
                key={course.code}
                className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-3xl p-6 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono text-xs font-extrabold tracking-wide">
                      {course.code}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800">
                        {course.level}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        {course.units} Units
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug mb-1.5">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 pt-2 border-t border-slate-50">
                    <span>
                      {course.department} • {course.semester}
                    </span>
                    <span className="text-[#00875A] font-semibold flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {course.resourceCount} {course.resourceCount === 1 ? "Material" : "Materials"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/resources?q=${encodeURIComponent(course.code)}`}
                    className="text-xs font-bold text-[#00875A] group-hover:text-[#00734c] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Explore Vault Materials</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
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
