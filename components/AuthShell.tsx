import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import BrandMark from "@/components/ui/BrandMark";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-10 sm:py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Subtle top-left return link */}
      <div className="w-full max-w-md mx-auto mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-emerald transition-colors rounded-lg py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          FUOYE Engineering
        </span>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandMark size="lg" className="mb-4 justify-center" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-forest tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-7 sm:py-8 px-6 sm:px-8 shadow-[var(--shadow-card)] rounded-2xl border border-slate-200/90">
          {children}
          {footer && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
