export default function ValueProposition() {
  const features = [
    {
      title: "Instant Search & Filter",
      description:
        "Find any course material, past question, or textbook in seconds. Filter by department, level, or course code - no more digging through folders.",
    },
    {
      title: "All 5 Departments Covered",
      description:
        "From Civil to Mechanical Engineering - every department's resources, organized and accessible to students at 100L through 500L.",
    },
    {
      title: "500+ Solved Past Questions",
      description:
        "Fully worked-through solutions to past exam questions - understand the reasoning, not just the answer, so you're ready for anything.",
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            How NuesaPedia helps your grades?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500">
            Streamlined study vault built specifically for FUOYE engineering students across all levels.
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
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
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
