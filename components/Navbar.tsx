"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BookOpen, Menu, X, User as UserIcon, ShieldCheck, Search } from "lucide-react";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  department: string;
  level: string;
  role?: string;
}

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Check if session exists
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#0C3B2E] flex items-center justify-center text-white shadow-sm group-hover:bg-[#00875A] transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-[#0C3B2E] transition-colors">
              NuesaPedia
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/resources"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Resources
            </Link>
            <Link
              href="/courses"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Courses
            </Link>
            <Link
              href="/departments"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Departments
            </Link>
            <Link
              href="/ai"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00875A] hover:text-[#00734c] transition-colors"
            >
              <span>AI Tutor</span>
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">New</span>
            </Link>
            <Link
              href="/saved"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Saved
            </Link>
            <Link
              href="/search"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Global Search"
            >
              <Search className="w-4 h-4" />
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
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
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-slate-900 group-hover:text-[#00875A] transition-colors line-clamp-1 max-w-[120px]">
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
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <Link
            href="/resources"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Resources Catalog
          </Link>
          <Link
            href="/courses"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Courses
          </Link>
          <Link
            href="/departments"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Departments
          </Link>
          <Link
            href="/ai"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between py-2 text-base font-semibold text-[#00875A]"
          >
            <span>AI Study Tutor & Exam Revision</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">New</span>
          </Link>
          <Link
            href="/saved"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Saved Vault
          </Link>
          <Link
            href="/videos"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Video Vault
          </Link>
          <Link
            href="/search"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            Global Search
          </Link>
          <Link
            href="/#faqs"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-slate-700 hover:text-slate-900"
          >
            FAQs
          </Link>
          <div className="pt-4 flex flex-col gap-2">
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
