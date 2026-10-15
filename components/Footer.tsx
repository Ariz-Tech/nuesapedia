import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#FAFAFA] border-t border-slate-200/90 pt-16 pb-12 text-slate-600 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 lg:gap-12 pb-14 border-b border-slate-200">
          {/* Brand info - spans 2 columns on desktop */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#0C3B2E] flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                NuesaPedia
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm">
              A comprehensive digital database created to empower engineering students, researchers, and faculty with modern catalog search solutions.
            </p>
            <p className="text-xs font-medium text-slate-400">
              Curated by the NUESA Executives
            </p>
          </div>

          {/* Column 1: DEPARTMENTS */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              DEPARTMENTS
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-500">
              <li>
                <Link href="/departments/civil" className="hover:text-slate-900 transition-colors">
                  Civil Engineering
                </Link>
              </li>
              <li>
                <Link href="/departments/mechanical" className="hover:text-slate-900 transition-colors">
                  Mechanical Engineering
                </Link>
              </li>
              <li>
                <Link href="/departments/materials" className="hover:text-slate-900 transition-colors">
                  Materials & Metallurgical
                </Link>
              </li>
              <li>
                <Link href="/departments/agric" className="hover:text-slate-900 transition-colors">
                  Agric & Bio Resources
                </Link>
              </li>
              <li>
                <Link href="/departments/mining" className="hover:text-slate-900 transition-colors">
                  Mining Engineering
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: LITERATURE */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              LITERATURE
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-500">
              <li>
                <Link href="/literature/textbooks" className="hover:text-slate-900 transition-colors">
                  Digital Textbooks
                </Link>
              </li>
              <li>
                <Link href="/literature/ieee" className="hover:text-slate-900 transition-colors">
                  IEEE Journal Index
                </Link>
              </li>
              <li>
                <Link href="/literature/theses" className="hover:text-slate-900 transition-colors">
                  Master&apos;s Theses
                </Link>
              </li>
              <li>
                <Link href="/literature/patents" className="hover:text-slate-900 transition-colors">
                  Design Patents
                </Link>
              </li>
              <li>
                <Link href="/literature/standards" className="hover:text-slate-900 transition-colors">
                  Standard Specs
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: RESOURCES */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              RESOURCES
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-500">
              <li>
                <Link href="/portal" className="hover:text-slate-900 transition-colors">
                  Student Portal
                </Link>
              </li>
              <li>
                <Link href="/faculty" className="hover:text-slate-900 transition-colors">
                  Faculty Register
                </Link>
              </li>
              <li>
                <Link href="/interlibrary" className="hover:text-slate-900 transition-colors">
                  Interlibrary Loan
                </Link>
              </li>
              <li>
                <Link href="/cad-bank" className="hover:text-slate-900 transition-colors">
                  CAD Template Bank
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-slate-900 transition-colors">
                  Technical Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} NuesaPedia Digital Faculty Library. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-slate-600 transition-colors">
              Terms of Access
            </Link>
            <Link href="/privacy" className="hover:text-slate-600 transition-colors">
              Faculty Privacy Policy
            </Link>
            <Link href="/standards" className="hover:text-slate-600 transition-colors">
              IEEE Code Standards
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
