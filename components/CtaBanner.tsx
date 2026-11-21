import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";

export default function CtaBanner() {
  return (
    <section className="relative w-full bg-brand-forest-dark py-16 md:py-20 text-white overflow-hidden">
      {/* Subtle blueprint dot grid echoing the hero engineering aesthetic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(rgba(16, 185, 129, 0.35) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Ready to Study Smarter This Semester?
        </h2>

        <p className="mt-3.5 text-sm md:text-base text-emerald-100/85 max-w-2xl mx-auto leading-relaxed">
          Read handouts in your browser, download PDFs to your offline vault for zero-internet study, or contribute verified past questions to help your coursemates.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/resources"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-brand-emerald hover:bg-brand-emerald-hover transition-colors shadow-sm"
          >
            <span>Browse Course Materials</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/upload"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-white text-brand-forest-dark hover:bg-slate-100 transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-brand-emerald" />
            <span>Contribute Material</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
