"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getDepartmentBySlug, DEPARTMENT_DETAILS } from "@/lib/departments";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Download,
  GraduationCap,
  UploadCloud,
  CheckCircle2,
  Play,
  Layers,
  Search,
  ExternalLink,
} from "lucide-react";

const LEVELS = ["All Levels", "100L", "200L", "300L", "400L", "500L"];
const CATEGORIES = ["All Types", "Past Questions", "Lecture Notes", "Textbooks", "Video Tutorials"];

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface DepartmentResource {
  id: string;
  title: string;
  courseCode: string;
  level: string;
  type: string;
  fileSize: string;
  isVid?: boolean;
  fileUrl?: string;
}

export default function DepartmentDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const department = getDepartmentBySlug(resolvedParams.slug);

  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [selectedCategory, setSelectedCategory] = useState("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [approvedResources, setApprovedResources] = useState<DepartmentResource[]>([]);

  useEffect(() => {
    if (!department) return;
    fetch(`/api/resources?department=${encodeURIComponent(department.name)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.resources) {
          setApprovedResources(
            data.resources.map((r: {
              id: string;
              title: string;
              courseCode: string;
              level: string;
              type: string;
              fileSize?: string;
              medium: string;
              fileUrl?: string;
              youtubeUrl?: string;
            }) => ({
              id: r.id,
              title: r.title,
              courseCode: r.courseCode,
              level: r.level,
              type: r.type,
              fileSize: r.fileSize || "Cloudinary Document",
              isVid: r.medium === "YOUTUBE",
              fileUrl: r.fileUrl || r.youtubeUrl,
            }))
          );
        }
      })
      .catch(() => {});
  }, [department]);

  if (!department) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Department Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            The requested engineering department does not exist in the faculty directory.
          </p>
          <Link
            href="/departments"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00875A] text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Departments</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Only use verified approved departmental resources from database
  const allResources = approvedResources;

  const filteredResources = allResources.filter((res) => {
    const matchesLevel = selectedLevel === "All Levels" || res.level === selectedLevel;
    const matchesCategory =
      selectedCategory === "All Types" || res.type.toLowerCase().includes(selectedCategory.toLowerCase().replace("s", ""));
    const matchesQuery =
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesCategory && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Breadcrumb / Back button */}
        <div className="mb-6">
          <Link
            href="/departments"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All 5 Departments</span>
          </Link>
        </div>

        {/* Department Banner Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-[#00875A]">
                  {department.code}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Faculty of Engineering • FUOYE
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {department.name}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
                {department.description}
              </p>
            </div>

            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs shrink-0 self-start md:self-auto cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Contribute to {department.code}</span>
            </Link>
          </div>

          {/* Level Switcher Tabs */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedLevel === lvl
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#00875A] text-white font-semibold"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search course or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredResources.length === 0 ? (
            <div className="col-span-full text-center py-12 px-4 bg-white border border-dashed border-slate-200 rounded-3xl">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching materials found</p>
              <p className="text-xs text-slate-400 mt-1">
                Be the first to upload lecture notes or past questions for this course!
              </p>
              <Link
                href="/profile"
                className="inline-block mt-4 px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#00875A]"
              >
                Upload Resource
              </Link>
            </div>
          ) : (
            filteredResources.map((item) => (
              <div
                key={item.id}
                className="group bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono">
                      {item.courseCode}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                      {item.level}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{item.type}</span>
                    <span>•</span>
                    <span>{item.fileSize}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400">FUOYE Vault</span>
                  {item.fileUrl ? (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:underline cursor-pointer"
                    >
                      {item.isVid ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-[#00875A]" />
                          <span>Watch Tutorial</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>View Document</span>
                        </>
                      )}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alert(`Accessing "${item.title}" from FUOYE archives.`)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:underline cursor-pointer"
                    >
                      {item.isVid ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-[#00875A]" />
                          <span>Watch Video</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
