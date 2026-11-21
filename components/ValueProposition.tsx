import { Building2, HardDriveDownload, Search } from "lucide-react";

export default function ValueProposition() {
  const features = [
    {
      icon: Search,
      title: "Instant Search & Semester Filter",
      description:
        "Find any lecture note, past question, or study slide in seconds. Filter by department, level, semester, or course code — zero sign-up required.",
    },
    {
      icon: Building2,
      title: "All 5 Departments Covered",
      description:
        "Dedicated course materials for Civil, Mechanical, Materials & Metallurgical, Agric & Bio-Resources, and Mining Engineering from 100L through 500L.",
    },
    {
      icon: HardDriveDownload,
      title: "Offline Study Vault (PWA)",
      description:
        "Every downloaded document is cached directly on your device so you can keep reading handouts, slides, and past questions in lecture halls or hostels without internet.",
    },
  ];

  return (
    <section className="py-14 md:py-20 bg-surface border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-forest">
            Built for How FUOYE Engineers Actually Study
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
            A fast, offline-ready faculty library organized around your exact courses and semesters.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-surface-subtle border border-slate-200/80 rounded-2xl p-6 sm:p-7 hover:border-slate-300 transition-all hover:shadow-[var(--shadow-card)] flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-brand-emerald flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-brand-forest">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
