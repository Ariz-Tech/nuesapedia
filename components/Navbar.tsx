"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { Menu, X, User as UserIcon, ShieldCheck, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSavedResources } from "@/context/SavedResourcesContext";
import { type CourseMetadata } from "@/lib/courses";
import BrandMark from "@/components/ui/BrandMark";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { savedCount, offlineCount, shelfCount } = useSavedResources();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navQuery, setNavQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [dynamicCourses, setDynamicCourses] = useState<CourseMetadata[]>([]);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  const isResourcesActive = pathname === "/resources" || pathname?.startsWith("/resources/");
  const isSavedActive = pathname === "/saved";
  const isModerationActive = pathname === "/moderation";
  const isProfileActive = pathname === "/profile";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchFocused(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Fetch only courses from uploaded materials
  useEffect(() => {
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
  }, []);

  const matchingCourses = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q || !dynamicCourses.length) return [];
    const compactQ = q.replace(/\s+/g, "");
    return dynamicCourses
      .filter((c) => {
        const codeLower = c.code.toLowerCase();
        const compactCode = codeLower.replace(/\s+/g, "");
        const titleLower = c.title.toLowerCase();
        return (
          codeLower.includes(q) ||
          compactCode.includes(compactQ) ||
          titleLower.includes(q)
        );
      })
      .slice(0, 6);
  }, [navQuery, dynamicCourses]);

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
    <header className="sticky top-0 z-50 w-full bg-surface/95 backdrop-blur-md border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 md:h-[72px]">
          {/* Logo */}
          <BrandMark size="md" />

          {/* Desktop Navigation & Course Search */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6 flex-1 justify-center max-w-2xl">
            <nav aria-label="Primary navigation" className="flex items-center gap-1 shrink-0">
              <Link
                href="/resources"
                aria-current={isResourcesActive ? "page" : undefined}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isResourcesActive
                    ? "bg-emerald-50 text-brand-emerald"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                Resources
              </Link>
              <Link
                href="/saved"
                aria-current={isSavedActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isSavedActive
                    ? "bg-emerald-50 text-brand-emerald"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <span>Saved</span>
                {shelfCount > 0 && (
                  <span
                    title={`${savedCount} bookmarked, ${offlineCount} downloaded offline`}
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${
                      isSavedActive
                        ? "bg-brand-emerald text-white"
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
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
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
                  className="w-full pl-9 pr-8 py-2 rounded-full border border-slate-200 bg-surface-subtle focus:bg-surface text-xs lg:text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/15 transition-all"
                />
                {navQuery && (
                  <button
                    type="button"
                    onClick={() => setNavQuery("")}
                    className="absolute right-2.5 p-1 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              {/* Live Course Suggestions Dropdown */}
              {searchFocused && navQuery.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-surface rounded-2xl border border-slate-200 shadow-lg overflow-hidden z-50 animate-ui-fade">
                  {matchingCourses.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                          className="w-full px-3.5 py-2 text-left hover:bg-emerald-50/70 flex items-start gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="px-2 py-0.5 rounded-md bg-brand-forest text-white font-mono text-[11px] font-bold shrink-0 mt-0.5">
                            {course.code}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {course.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
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
                    className="w-full px-3.5 py-2.5 bg-surface-subtle hover:bg-emerald-50 border-t border-slate-100 text-left flex items-center justify-between text-xs font-semibold text-brand-emerald transition-colors cursor-pointer"
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
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
              <Link
                href="/moderation"
                aria-current={isModerationActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-bold transition-colors ${
                  isModerationActive
                    ? "bg-brand-forest text-white border-brand-forest"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200/90 hover:bg-emerald-100"
                }`}
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 ${
                    isModerationActive ? "text-emerald-300" : "text-brand-emerald"
                  }`}
                />
                <span>Moderation</span>
              </Link>
            )}

            {user ? (
              <Link
                href="/profile"
                aria-current={isProfileActive ? "page" : undefined}
                className={`flex items-center gap-2.5 p-1 pr-3.5 rounded-full border transition-all shadow-2xs group ${
                  isProfileActive
                    ? "border-brand-emerald bg-emerald-50/60"
                    : "border-slate-200 hover:border-emerald-300 bg-surface hover:bg-emerald-50/40"
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-emerald bg-emerald-50 shrink-0">
                  <Image
                    src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Student"}
                    alt={user.name || "Student"}
                    width={32}
                    height={32}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-brand-emerald transition-colors line-clamp-1 max-w-[110px]">
                    {user.name ? user.name.split(" ")[0] : "Student"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium leading-tight">
                    Profile
                  </div>
                </div>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-slate-700 hover:text-brand-forest px-3.5 py-2 rounded-full hover:bg-slate-100/70 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-semibold text-white bg-brand-emerald hover:bg-brand-emerald-hover px-5 py-2.5 rounded-full transition-colors shadow-xs"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="text-slate-700 hover:text-brand-forest hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu dropdown */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          className="md:hidden border-b border-slate-200 bg-surface px-4 pt-3 pb-6 space-y-3 animate-ui-fade"
        >
          {/* Mobile Search Input */}
          <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search course code or title..."
              aria-label="Search by course code or course title"
              className="w-full pl-9 pr-20 py-2.5 rounded-xl border border-slate-200 bg-surface-subtle focus:bg-surface text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-2 focus:ring-brand-emerald/15"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-brand-emerald hover:bg-brand-emerald-hover text-white text-xs font-semibold cursor-pointer"
            >
              Search
            </button>
          </form>

          {navQuery.trim() && matchingCourses.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-surface-subtle divide-y divide-slate-100 overflow-hidden">
              {matchingCourses.slice(0, 4).map((course) => (
                <button
                  key={course.code}
                  type="button"
                  onClick={() => {
                    setNavQuery(course.code);
                    submitSearch(course.code);
                  }}
                  className="w-full px-3 py-2.5 text-left flex items-center gap-2 text-xs hover:bg-emerald-50/70 cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded bg-brand-forest text-white font-mono text-[11px] font-bold shrink-0">
                    {course.code}
                  </span>
                  <span className="font-medium text-slate-800 truncate">{course.title}</span>
                </button>
              ))}
            </div>
          )}

          <nav aria-label="Mobile navigation" className="space-y-1 pt-1">
            <Link
              href="/resources"
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2.5 px-3 rounded-xl text-base font-semibold transition-colors ${
                isResourcesActive
                  ? "bg-emerald-50 text-brand-emerald"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Resources
            </Link>
            <Link
              href="/saved"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between py-2.5 px-3 rounded-xl text-base font-semibold transition-colors ${
                isSavedActive
                  ? "bg-emerald-50 text-brand-emerald"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>Saved</span>
              {shelfCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-brand-forest text-xs font-bold">
                  {shelfCount}
                </span>
              )}
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user && (user.role === "MODERATOR" || user.role === "ADMIN") && (
              <Link
                href="/moderation"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold"
              >
                <ShieldCheck className="w-4 h-4 text-brand-emerald" />
                <span>Faculty Moderation Portal</span>
              </Link>
            )}

            {user ? (
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-brand-emerald bg-emerald-50 text-brand-forest text-sm font-semibold"
              >
                <UserIcon className="w-4 h-4 text-brand-emerald" />
                <span>My Profile ({user.name ? user.name.split(" ")[0] : "Student"})</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-semibold text-slate-700 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-sm font-semibold text-white bg-brand-emerald hover:bg-brand-emerald-hover py-2.5 rounded-xl"
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
