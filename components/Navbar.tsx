"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { BookOpen, Menu, X, User as UserIcon, ShieldCheck, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSavedResources } from "@/context/SavedResourcesContext";
import { COURSE_REGISTRY, type CourseMetadata } from "@/lib/courses";

const STATIC_COURSES: CourseMetadata[] = Object.values(COURSE_REGISTRY);

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { savedCount, offlineCount, savedIds, offlineIds } = useSavedResources();

  // Combined count of unique saved + downloaded items on the Saved shelf
  const shelfCount = useMemo(() => {
    const union = new Set<string>([...savedIds, ...offlineIds]);
    return union.size;
  }, [savedIds, offlineIds]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [dynamicCourses, setDynamicCourses] = useState<CourseMetadata[] | null>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  const isResourcesActive = pathname === "/resources" || pathname?.startsWith("/resources/");
  const isSavedActive = pathname === "/saved";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load dynamic DB courses on first search interaction so newly uploaded courses appear in autocomplete
  useEffect(() => {
    if (!searchFocused || dynamicCourses !== null) return;
    let active = true;
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.courses)) {
          setDynamicCourses(data.courses);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [searchFocused, dynamicCourses]);

  const allCourses = useMemo(() => {
    if (!dynamicCourses) return STATIC_COURSES;
    const merged = new Map<string, CourseMetadata>();
    for (const c of STATIC_COURSES) merged.set(c.code.toUpperCase(), c);
    for (const c of dynamicCourses) merged.set(c.code.toUpperCase(), c);
    return Array.from(merged.values());
  }, [dynamicCourses]);

  const matchingCourses = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return [];
    const compactQ = q.replace(/\s+/g, "");
    return allCourses.filter((c) => {
      const codeLower = c.code.toLowerCase();
      const compactCode = codeLower.replace(/\s+/g, "");
      const titleLower = c.title.toLowerCase();
      return (
        codeLower.includes(q) ||
        compactCode.includes(compactQ) ||
        titleLower.includes(q)
      );
    }).slice(0, 6);
  }, [navQuery, allCourses]);

  const submitSearch = (term: string) => {
    const trimmed = term.trim();
    setSearchFocused(false);
    setMobileMenuOpen(false);
    if (trimmed) {
      router.push(`/resources?search=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/resources");
    }
  };

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch(navQuery);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#0C3B2E] flex items-center justify-center text-white shadow-sm group-hover:bg-[#00875A] transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#0C3B2E] group-hover:text-[#00875A] transition-colors">
              The NUESA Library
            </span>
          </Link>

          {/* Desktop Navigation & Course Search */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6 flex-1 justify-center max-w-2xl">
            <nav className="flex items-center gap-1 shrink-0">
              <Link
                href="/resources"
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isResourcesActive
                    ? "bg-emerald-50 text-[#00875A]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Resources
              </Link>
              <Link
                href="/saved"
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isSavedActive
                    ? "bg-emerald-50 text-[#00875A]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>Saved</span>
                {shelfCount > 0 && (
                  <span
                    title={`${savedCount} bookmarked, ${offlineCount} downloaded offline`}
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${
                      isSavedActive
                        ? "bg-[#00875A] text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {shelfCount}
                  </span>
                )}
              </Link>
            </nav>

            {/* Navbar Search by Course Code or Course Title */}
            <div ref={desktopSearchRef} className="relative flex-1 max-w-xs lg:max-w-sm">
              <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={navQuery}
                  onFocus={() => setSearchFocused(true)}
                  onChange={(e) => {
                    setNavQuery(e.target.value);
                    setSearchFocused(true);
                  }}
                  placeholder="Search course code or title..."
                  aria-label="Search by course code or course title"
                  className="w-full pl-9 pr-8 py-2 rounded-full border border-slate-200 bg-slate-50/70 focus:bg-white text-xs lg:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00875A] focus:ring-2 focus:ring-[#00875A]/15 transition-all"
                />
                {navQuery && (
                  <button
                    type="button"
                    onClick={() => setNavQuery("")}
                    className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Live Course Suggestions Dropdown */}
              {searchFocused && navQuery.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden z-50">
                  {matchingCourses.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Matching Courses
                      </div>
                      {matchingCourses.map((course) => (
                        <button
                          key={course.code}
                          type="button"
                          onClick={() => {
                            setNavQuery(course.code);
                            submitSearch(course.code);
                          }}
                          className="w-full px-3.5 py-2 text-left hover:bg-emerald-50/60 flex items-start gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="px-2 py-0.5 rounded-md bg-[#0C3B2E] text-white font-mono text-[10px] font-bold shrink-0 mt-0.5">
                            {course.code}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {course.title}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {course.department} &bull; {course.level}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => submitSearch(navQuery)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-emerald-50 border-t border-slate-100 text-left flex items-center justify-between text-xs font-semibold text-[#00875A] transition-colors cursor-pointer"
                  >
                    <span className="truncate">
                      Search all materials for &ldquo;{navQuery.trim()}&rdquo;
                    </span>
                    <Search className="w-3.5 h-3.5 shrink-0 ml-2" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
              <Link
                href="/moderation"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/90 text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Moderation</span>
              </Link>
            )}

            {user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2.5 p-1.5 pr-4 rounded-full border border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/40 transition-all shadow-2xs group"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-500 bg-emerald-50 shrink-0">
                  <Image
                    src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Student"}
                    alt={user.name || "Student"}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-[#00875A] transition-colors line-clamp-1 max-w-[110px]">
                    {user.name ? user.name.split(" ")[0] : "Student"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">Profile</div>
                </div>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-medium text-white bg-[#00875A] hover:bg-[#00734c] px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 p-2 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          {/* Mobile Search Input */}
          <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search course code or title..."
              aria-label="Search by course code or course title"
              className="w-full pl-9 pr-16 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00875A]"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-[#00875A] text-white text-xs font-semibold"
            >
              Search
            </button>
          </form>

          {navQuery.trim() && matchingCourses.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 divide-y divide-slate-100 overflow-hidden">
              {matchingCourses.slice(0, 4).map((course) => (
                <button
                  key={course.code}
                  type="button"
                  onClick={() => {
                    setNavQuery(course.code);
                    submitSearch(course.code);
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 text-xs"
                >
                  <span className="px-1.5 py-0.5 rounded bg-[#0C3B2E] text-white font-mono text-[10px] font-bold shrink-0">
                    {course.code}
                  </span>
                  <span className="font-medium text-slate-800 truncate">{course.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1 pt-1">
            <Link
              href="/resources"
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-base font-semibold ${
                isResourcesActive
                  ? "bg-emerald-50 text-[#00875A]"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Resources
            </Link>
            <Link
              href="/saved"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between py-2.5 px-3 rounded-xl text-base font-semibold ${
                isSavedActive
                  ? "bg-emerald-50 text-[#00875A]"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              <span>Saved</span>
              {shelfCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0C3B2E] text-xs font-bold">
                  {shelfCount}
                </span>
              )}
            </Link>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
              <Link
                href="/moderation"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Faculty Moderation Portal</span>
              </Link>
            )}

            {user ? (
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-emerald-500 bg-emerald-50 text-emerald-800 text-sm font-semibold"
              >
                <UserIcon className="w-4 h-4" />
                <span>My Profile ({user.name ? user.name.split(" ")[0] : "Student"})</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-slate-700 py-2.5 rounded-full border border-slate-300"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-medium text-white bg-[#00875A] py-2.5 rounded-full"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
