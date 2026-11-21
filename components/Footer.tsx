import Link from "next/link";
import BrandMark from "@/components/ui/BrandMark";

export default function Footer() {
  return (
    <footer className="w-full bg-canvas border-t border-slate-200/90 pt-12 pb-10 text-slate-600 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-200/90">
          <div className="space-y-2.5">
            <BrandMark size="sm" />
            <p className="text-xs sm:text-sm text-slate-600 max-w-md leading-relaxed">
              Digital faculty library for FUOYE Engineering course materials — read, watch, bookmark, and download in one place.
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-700"
          >
            <Link href="/resources" className="hover:text-brand-emerald transition-colors">
              Resources
            </Link>
            <Link href="/saved" className="hover:text-brand-emerald transition-colors">
              Saved Vault
            </Link>
            <Link href="/upload" className="hover:text-brand-emerald transition-colors">
              Contribute
            </Link>
            <Link href="/profile" className="hover:text-brand-emerald transition-colors">
              Student Portal
            </Link>
          </nav>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} The NUESA Library &bull; Faculty of Engineering, Federal University Oye-Ekiti.
          </p>
          <p className="font-medium">Curated by the NUESA Executives</p>
        </div>
      </div>
    </footer>
  );
}
