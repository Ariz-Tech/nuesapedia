"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string;
  accentColor: string;
  imageBg: string;
  iconSvg: React.ReactNode;
}

export default function BrowseDepartments() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const departments: Department[] = [
    {
      id: "CVE",
      name: "Civil Engineering",
      slug: "civil",
      description: "Access textbooks, past questions and videos for Civil Engineering courses.",
      accentColor: "from-cyan-900 to-slate-950",
      imageBg: "radial-gradient(circle at 50% 50%, #164e63 0%, #082f49 100%)",
      iconSvg: (
        <svg viewBox="0 0 200 120" className="w-full h-full object-cover opacity-80" fill="none">
          {/* Bridge / Truss Structure */}
          <path d="M10 95h180" stroke="#cbd5e1" strokeWidth="3" />
          <path d="M20 95 L60 30 L100 95 L140 30 L180 95" stroke="#38bdf8" strokeWidth="2" />
          <path d="M60 30h80" stroke="#38bdf8" strokeWidth="2" />
          <line x1="60" y1="30" x2="60" y2="95" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="100" y1="30" x2="100" y2="95" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="140" y1="30" x2="140" y2="95" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      ),
    },
    {
      id: "MEE",
      name: "Mechanical Engineering",
      slug: "mechanical",
      description: "Access textbooks, past questions and videos for Mechanical Engineering courses.",
      accentColor: "from-slate-800 to-zinc-950",
      imageBg: "radial-gradient(circle at 50% 50%, #1e293b 0%, #090d16 100%)",
      iconSvg: (
        <svg viewBox="0 0 200 120" className="w-full h-full object-cover opacity-80" fill="none">
          <circle cx="100" cy="60" r="38" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="100" cy="60" r="24" stroke="#60a5fa" strokeWidth="2.5" />
          <circle cx="100" cy="60" r="12" fill="#0284c7" />
          {/* Gear teeth */}
          <path d="M100 20v8M100 92v8M60 60h8M132 60h8M72 32l6 6M122 82l6 6M72 88l6-6M122 38l6-6" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 100 Q 100 30 180 100" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.4" />
        </svg>
      ),
    },
    {
      id: "MME",
      name: "Materials & Metallurgical",
      slug: "materials",
      description: "Access textbooks, past questions and videos for Materials Engineering courses.",
      accentColor: "from-zinc-900 to-stone-950",
      imageBg: "radial-gradient(circle at 50% 50%, #292524 0%, #0c0a09 100%)",
      iconSvg: (
        <svg viewBox="0 0 200 120" className="w-full h-full object-cover opacity-80" fill="none">
          <circle cx="70" cy="50" r="14" stroke="#d6d3d1" strokeWidth="2" />
          <circle cx="130" cy="50" r="14" stroke="#d6d3d1" strokeWidth="2" />
          <circle cx="100" cy="85" r="14" stroke="#d6d3d1" strokeWidth="2" />
          <line x1="70" y1="50" x2="130" y2="50" stroke="#a8a29e" strokeWidth="2" />
          <line x1="70" y1="50" x2="100" y2="85" stroke="#a8a29e" strokeWidth="2" />
          <line x1="130" y1="50" x2="100" y2="85" stroke="#a8a29e" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: "ABE",
      name: "Agric & Bio Resources",
      slug: "agric",
      description: "Access textbooks, past questions and videos for Agricultural & Bio-Resources courses.",
      accentColor: "from-lime-950 to-slate-950",
      imageBg: "radial-gradient(circle at 50% 50%, #1a2e05 0%, #0a1403 100%)",
      iconSvg: (
        <svg viewBox="0 0 200 120" className="w-full h-full object-cover opacity-80" fill="none">
          <path d="M100 95 V40" stroke="#84cc16" strokeWidth="3" />
          <path d="M100 65 Q130 50 135 70 Q115 80 100 65" fill="#65a30d" stroke="#84cc16" strokeWidth="1.5" />
          <path d="M100 50 Q70 35 65 55 Q85 65 100 50" fill="#65a30d" stroke="#84cc16" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "MNE",
      name: "Mining Engineering",
      slug: "mining",
      description: "Access textbooks, past questions and videos for Mining and Mineral Exploration courses.",
      accentColor: "from-amber-950 to-stone-950",
      imageBg: "radial-gradient(circle at 50% 50%, #451a03 0%, #0c0a09 100%)",
      iconSvg: (
        <svg viewBox="0 0 200 120" className="w-full h-full object-cover opacity-80" fill="none">
          {/* Mining pickaxe and mineral strata */}
          <path d="M40 90 L160 30" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M140 20 Q165 25 170 45" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
          <path d="M30 100 L50 80" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
          {/* Crystal gem */}
          <polygon points="100,45 115,65 100,85 85,65" stroke="#f59e0b" strokeWidth="1.5" fill="#78350f" fillOpacity="0.5" />
          <line x1="85" y1="65" x2="115" y2="65" stroke="#fbbf24" strokeWidth="1" />
          <line x1="100" y1="45" x2="100" y2="85" stroke="#fbbf24" strokeWidth="1" />
        </svg>
      ),
    },
  ];

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-16 md:py-20 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Browse Library by Department
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl">
              Lately updated peer-reviewed publications, standard textbooks, and recent engineering acquisitions.
            </p>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={() => handleScroll("left")}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
              aria-label="Previous department"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleScroll("right")}
              className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95"
              aria-label="Next department"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div
          ref={scrollContainerRef}
          className="mt-8 flex gap-6 overflow-x-auto pb-4 pt-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="min-w-[270px] sm:min-w-[290px] max-w-[290px] bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between shrink-0 snap-start group"
            >
              <div>
                {/* Visual Thumbnail */}
                <div
                  className="h-36 w-full relative flex items-center justify-center overflow-hidden border-b border-slate-100"
                  style={{ background: dept.imageBg }}
                >
                  <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
                    {dept.iconSvg}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-[#0C3B2E] transition-colors line-clamp-1">
                    {dept.name}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-3">
                    {dept.description}
                  </p>
                </div>
              </div>

              {/* Action Link */}
              <div className="px-5 pb-5 pt-1">
                <Link
                  href={`/departments/${dept.slug}`}
                  className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-800 hover:text-[#00875A] transition-colors border-t border-slate-100 pt-3 group/link"
                >
                  <span>View Resources</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
