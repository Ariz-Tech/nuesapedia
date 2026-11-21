"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import HeroBackgroundLines from "./HeroBackgroundLines";

export default function HeroSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/resources?search=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/resources");
    }
  };

  return (
    <section
      id="hero-section"
      className="relative pt-16 pb-20 md:pt-24 md:pb-28 bg-canvas overflow-hidden group cursor-default"
    >
      {/* Architectural blueprint grid with subtle interactive cursor lines */}
      <HeroBackgroundLines />

      {/* Radial surface soft-fade behind typography so interactive grid lines never impair legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_55%_at_50%_46%,rgba(250,250,250,0.88)_0%,rgba(250,250,250,0.45)_60%,rgba(250,250,250,0)_100%)]"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Main Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-brand-forest leading-[1.12]">
          Everything You Need to <br />
          <span className="text-brand-emerald">Study Engineering.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Access course materials, lecture notes, past questions, videos, and study resources for{" "}
          <span className="font-semibold text-slate-800">FUOYE engineering courses</span>, all in one place.
        </p>

        {/* Search Bar Container */}
        <div className="mt-10 max-w-3xl mx-auto">
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row items-center bg-surface rounded-2xl sm:rounded-full p-2 border border-slate-200/90 shadow-[var(--shadow-card)] hover:border-slate-300 transition-all focus-within:border-brand-emerald focus-within:ring-2 focus-within:ring-brand-emerald/15"
          >
            <div className="flex items-center flex-1 w-full px-3.5 py-2 sm:py-1">
              <Search className="w-5 h-5 text-slate-500 shrink-0 mr-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search course materials by title or course code"
                placeholder='Search by course title or code (e.g., "MEE 302" or "Fluid Mechanics")'
                className="w-full text-sm sm:text-base text-slate-900 placeholder:text-slate-500 bg-transparent border-none outline-none focus:ring-0 focus-visible:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto mt-2 sm:mt-0 px-7 py-3 text-sm font-semibold text-white bg-brand-emerald hover:bg-brand-emerald-hover rounded-xl sm:rounded-full transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              Search Library
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
