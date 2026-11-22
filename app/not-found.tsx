import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center mx-auto mb-5">
            <BookOpen className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wider uppercase mb-3">
            404 • Page Not Found
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0C3B2E] tracking-tight mb-3">
            We couldn&apos;t find that page
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed mb-8">
            The resource or link you followed may have been moved, withdrawn, or does not exist in The NUESA Library.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/resources"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-sm font-semibold transition-colors shadow-xs"
            >
              <Search className="w-4 h-4" />
              <span>Browse Resources</span>
            </Link>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
