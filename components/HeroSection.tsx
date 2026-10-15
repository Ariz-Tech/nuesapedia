"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import HeroBackgroundLines from "./HeroBackgroundLines";

export default function HeroSection() {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/resources?search=${encodeURIComponent(query.trim())}`;
    }
  };

  return (
    <section
      id="hero-section"
      className="relative pt-16 pb-20 md:pt-24 md:pb-28 bg-[#FAFAFA] overflow-hidden group cursor-default"
    >
      {/* Soft animated SVG background lines with responsive green horizontal and vertical hover lines */}
      <HeroBackgroundLines />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Main Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
          Everything You Need to <br />
          <span className="text-[#00875A]">Study Engineering.</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Access course materials, textbooks, past questions, videos, and study resources for{" "}
          <span className="font-medium text-slate-800">FUOYE engineering courses</span>, all in one place.
        </p>

        {/* Search Bar Container */}
        <div className="mt-10 max-w-3xl mx-auto">
          <form
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row items-center bg-white rounded-2xl sm:rounded-full p-2 border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100"
          >
            <div className="flex items-center flex-1 w-full px-3 py-2 sm:py-1">
              <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search by course title or code (e.g., "MEE 302" or "Fluid Mechanics")'
                className="w-full text-sm sm:text-base text-slate-800 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto mt-2 sm:mt-0 px-7 py-3 text-sm font-semibold text-white bg-[#00875A] hover:bg-[#00734c] rounded-xl sm:rounded-full transition-all shadow-sm hover:shadow shrink-0 cursor-pointer"
            >
              Search Library
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
