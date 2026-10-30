export default function ValueProposition() {
  const features = [
    {
      title: "Instant Search & Semester Filter",
      description:
        "Find any handout, past question, textbook, or lab manual in seconds. Filter by department, level, semester, or course code — zero sign-up required.",
    },
    {
      title: "All 5 Faculty Departments Covered",
      description:
        "Dedicated course materials for Civil, Mechanical, Materials & Metallurgical, Agric & Bio-Resources, and Mining Engineering from 100L through 500L.",
    },
    {
      title: "Offline Study Vault (PWA)",
      description:
        "Every downloaded PDF is cached directly on your device so you can keep reading handouts and past questions in lecture halls or hostels without internet.",
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0C3B2E]">
            Built for How FUOYE Engineers Actually Study
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500">
            A fast, offline-ready faculty library organized around your exact courses and semesters.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="bg-[#F8FAFC] border border-slate-200/80 rounded-2xl p-6 sm:p-7 hover:border-slate-300 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between"
            >
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-[#0C3B2E]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
