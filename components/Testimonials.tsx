import { Quote } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    {
      id: 1,
      quote:
        "Preparing for Structural Analysis and Soil Mechanics became much more organized once our class started pulling past questions and lecture handouts from one central place.",
      name: "Oluwaseun Adeleke",
      department: "Civil Engineering • 400L",
      initials: "OA",
    },
    {
      id: 2,
      quote:
        "Having Physical Metallurgy phase-diagram notes and lab manuals saved offline on my phone meant I could revise right before labs even when mobile network dropped.",
      name: "Fatima Ibrahim",
      department: "Materials & Metallurgical • 300L",
      initials: "FI",
    },
    {
      id: 3,
      quote:
        "Filtering straight to Mechanical Engineering 300L Second Semester courses and sharing direct handout links to our class WhatsApp group saves everyone hours.",
      name: "Chinedu Eze",
      department: "Mechanical Engineering • 300L",
      initials: "CE",
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-forest">
            Built Around Student Feedback
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
            How undergraduates across the Faculty of Engineering use The NUESA Library during semesters and exams.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <figure
              key={item.id}
              className="bg-surface border border-slate-200/90 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 shadow-[var(--shadow-card)] transition-all"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-brand-emerald flex items-center justify-center mb-4">
                  <Quote className="w-4 h-4" />
                </div>

                <blockquote className="text-sm text-slate-600 leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              </div>

              <figcaption className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-emerald-200/80 bg-emerald-50/70 flex items-center justify-center text-xs font-bold text-brand-forest shrink-0">
                  {item.initials}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {item.department}
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
