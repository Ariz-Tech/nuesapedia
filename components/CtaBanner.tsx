import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";

export default function CtaBanner() {
  return (
    <section className="w-full bg-[#0A251D] py-16 md:py-20 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
          Ready to Study Smarter This Semester?
        </h2>

        {/* Subtitle */}
        <p className="mt-3 text-xs sm:text-sm md:text-base text-emerald-100/80 max-w-2xl mx-auto leading-relaxed">
          Read handouts in your browser, download PDFs to your offline vault for zero-internet study, or contribute verified past questions to help your coursemates.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#00875A] hover:bg-[#00734c] transition-all shadow-sm"
          >
            <span>Browse Course Materials</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold bg-white text-[#0A251D] hover:bg-slate-100 transition-all shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-[#00875A]" />
            <span>Contribute Material</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
