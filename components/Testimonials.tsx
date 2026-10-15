export default function Testimonials() {
  const testimonials = [
    {
      id: 1,
      quote:
        "Our curriculum changes fast, especially in Computer Science. The New Arrivals section has allowed us to access the latest textbooks on deep learning without costly wait times.",
      name: "Student Name",
      department: "Department",
      initials: "SN",
    },
    {
      id: 2,
      quote:
        "The department curated shelves are perfectly aligned with our exam matrices. Having access to specific course manuals on my phone allowed me to prepare dynamically on the go.",
      name: "Student Name",
      department: "Department",
      initials: "SN",
    },
    {
      id: 3,
      quote:
        "Our curriculum changes fast, especially in Computer Science. The New Arrivals section has allowed us to access the latest textbooks on deep learning without costly wait times.",
      name: "Student Name",
      department: "Department",
      initials: "SN",
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            What Our Engineering Students Say
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500">
            Real outcomes from undergraduates and researchers relying on EngiLib for their daily academic workflows.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
            >
              <div>
                {/* Emerald quote icon badge */}
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center font-serif text-2xl font-bold mb-4">
                  “
                </div>

                {/* Quote text */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>

              {/* Student info */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                  {item.initials}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {item.department}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
