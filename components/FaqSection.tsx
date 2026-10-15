"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export default function FaqSection() {
  // First item open by default as shown in mockup
  const [openId, setOpenId] = useState<string | null>("faq-1");

  const faqs: FaqItem[] = [
    {
      id: "faq-1",
      question: "What courses are available on NuesaPedia?",
      answer:
        "NuesaPedia covers core and elective courses across Civil, Mechanical, Materials and Metallurgical, Agric and Bio Resources, and Mining Engineering. You can browse by department, search by course code, or explore the latest arrivals for the most recently added materials.",
    },
    {
      id: "faq-2",
      question: "How do I download past questions and study materials?",
      answer:
        "Simply navigate to any course or search for the specific past question code. Click on the resource card and hit the 'Download' button to immediately save the PDF to your device. No sign-up or fee is required.",
    },
    {
      id: "faq-3",
      question: "Is the platform free for FUOYE engineering students?",
      answer:
        "Yes! NuesaPedia is 100% free for all engineering students. It is an open academic library curated by the Engineering Faculty Board to support students throughout their academic journey.",
    },
    {
      id: "faq-4",
      question: "Can I access video lectures and tutorials on the platform?",
      answer:
        "Yes, our Video Vault curates high-yield video tutorials and recorded lecture walkthroughs linked directly to each course syllabus.",
    },
    {
      id: "faq-5",
      question: "How do I request a missing course or textbook?",
      answer:
        "If a specific textbook or past question isn't available yet, you can submit a request through the student portal or upload approved copies to help your coursemates.",
    },
    {
      id: "faq-6",
      question: "Can I use NuesaPedia on my phone or tablet?",
      answer:
        "Absolutely. NuesaPedia is built as a responsive Progressive Web App (PWA). You can install it on Android, iOS, or desktop and even read downloaded materials offline.",
    },
  ];

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faqs" className="py-16 md:py-24 bg-white border-t border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500">
            Find answers to common questions about using NuesaPedia for your engineering studies.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className="border border-slate-200/90 rounded-xl overflow-hidden transition-all bg-white hover:border-slate-300"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full py-4 px-5 sm:px-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-slate-900">
                    {faq.question}
                  </span>
                  <span className="shrink-0 text-emerald-600">
                    {isOpen ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4 text-emerald-600" />
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100/70">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
