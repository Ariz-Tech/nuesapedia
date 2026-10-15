import Link from "next/link";

export default function CtaBanner() {
  return (
    <section className="w-full bg-[#0A251D] py-16 md:py-20 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Title */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
          What Our Engineering Students Say
        </h2>

        {/* Subtitle */}
        <p className="mt-3 text-xs sm:text-sm md:text-base text-emerald-100/80 max-w-2xl mx-auto leading-relaxed">
          Real outcomes from undergraduates and researchers relying on EngiLib for their daily academic workflows.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-white text-[#0A251D] hover:bg-slate-100 transition-all shadow-sm"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#00875A] hover:bg-[#00734c] transition-all shadow-sm"
          >
            Sign up
          </Link>
        </div>
      </div>
    </section>
  );
}
