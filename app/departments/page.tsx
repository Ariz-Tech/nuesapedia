"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENT_DETAILS } from "@/lib/departments";
import { Building2, Search, ArrowRight, BookOpen, GraduationCap, Sparkles } from "lucide-react";

export default function DepartmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = DEPARTMENT_DETAILS.filter((dept) => {
    const q = searchQuery.toLowerCase();
    return (
      dept.name.toLowerCase().includes(q) ||
      dept.shortName.toLowerCase().includes(q) ||
      dept.code.toLowerCase().includes(q) ||
      dept.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Header */}
        <div className="max-w-3xl mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3">
            <Building2 className="w-3.5 h-3.5 text-[#00875A]" />
            <span>Faculty of Engineering • FUOYE</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Engineering Departments Directory
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-500 leading-relaxed">
            Browse through all 5 accredited engineering departments. Access specialized course outlines, past question vaults, and curated tutorial archives from 100L through 500L.
          </p>

          {/* Search Box */}
          <div className="mt-6 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search department by name or code (e.g. Mining, CVE, MEE)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] shadow-2xs"
            />
          </div>
        </div>

        {/* 5 Department Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((dept) => (
            <Link
              key={dept.id}
              href={`/departments/${dept.slug}`}
              className="group bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-[#00875A]/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-[#00875A] transition-colors">
                    {dept.code}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    100L - 500L
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug">
                  {dept.name}
                </h3>

                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  {dept.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#00875A] group-hover:translate-x-0.5 transition-transform">
                <span>Explore Department Vault</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>

        {/* Quick CTA info */}
        <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0C3B2E] to-[#0A251D] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-300">
                Peer Contribution
              </span>
            </div>
            <h3 className="text-lg font-bold">Have notes or past questions for your department?</h3>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
              Support fellow engineering peers by uploading your verified course materials to the NuesaPedia vault.
            </p>
          </div>

          <Link
            href="/profile"
            className="px-5 py-2.5 rounded-xl bg-white text-[#0C3B2E] hover:bg-emerald-50 text-xs font-bold transition-all shadow-xs shrink-0 text-center"
          >
            Contribute Material
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
