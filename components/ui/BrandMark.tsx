import Link from "next/link";
import { BookOpen } from "lucide-react";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    box: "w-7 h-7 rounded-lg",
    icon: "w-3.5 h-3.5",
    text: "text-lg",
  },
  md: {
    box: "w-8 h-8 rounded-lg",
    icon: "w-4 h-4",
    text: "text-xl",
  },
  lg: {
    box: "w-10 h-10 rounded-xl",
    icon: "w-5 h-5",
    text: "text-2xl",
  },
} as const;

export default function BrandMark({
  size = "md",
  href = "/",
  className = "",
}: BrandMarkProps) {
  const s = SIZE_STYLES[size];

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 group shrink-0 rounded-lg ${className}`}
    >
      <div
        className={`${s.box} bg-brand-forest flex items-center justify-center text-white shadow-xs group-hover:bg-brand-emerald transition-colors`}
      >
        <BookOpen className={s.icon} />
      </div>
      <span
        className={`${s.text} font-bold tracking-tight text-brand-forest group-hover:text-brand-emerald transition-colors`}
      >
        The NUESA Library
      </span>
    </Link>
  );
}
