import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#FAFAFA] border-t border-slate-200/90 pt-12 pb-10 text-slate-600 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
          <div className="space-y-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0C3B2E] flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                The NUESA Library
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Digital faculty library for FUOYE Engineering course materials — read, watch, bookmark, and download in one place.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-6 text-sm font-semibold text-slate-700">
            <Link href="/resources" className="hover:text-[#00875A] transition-colors">
              Resources
            </Link>
            <Link href="/saved" className="hover:text-[#00875A] transition-colors">
              Saved
            </Link>
          </nav>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} The NUESA Library • Faculty of Engineering, Federal University Oye-Ekiti.</p>
          <p>Curated by the NUESA Executives</p>
        </div>
      </div>
    </footer>
  );
}
