import type { CourseMaterialItem } from "@/lib/saved-client";

export interface ResourceBadgeStyle {
  label: string;
  className: string;
}

/**
 * Maps any resource type / medium to the 6 canonical badge tokens defined in docs/DESIGN_SYSTEM.md §2.3:
 *  - PDF HANDOUT / Lecture Note:   bg-[#FFE4E6]/60 text-[#E11D48]
 *  - REFERENCE BOOK / Textbook:    bg-[#F3E8FF]    text-[#9333EA]
 *  - PAST QUESTIONS:               bg-[#FEF3C7]    text-[#D97706]
 *  - VIDEO TUTORIAL / YouTube:     bg-[#DBEAFE]    text-[#2563EB]
 *  - LAB MANUAL:                   bg-[#DCFCE7]    text-[#16A34A]
 *  - GENERAL COURSE (Fallback):    bg-[#CCFBF1]    text-[#0D9488]
 */
export function getResourceBadgeStyle(
  item: Pick<CourseMaterialItem, "type" | "medium">
): ResourceBadgeStyle {
  const rawType = (item.type || "").trim().toLowerCase();

  if (item.medium === "YOUTUBE" || rawType.includes("video") || rawType.includes("youtube")) {
    return {
      label: "VIDEO TUTORIAL",
      className: "bg-[#DBEAFE] text-[#2563EB]",
    };
  }

  if (rawType.includes("textbook") || rawType.includes("reference") || rawType.includes("book")) {
    return {
      label: "REFERENCE BOOK",
      className: "bg-[#F3E8FF] text-[#9333EA]",
    };
  }

  if (rawType.includes("past") || rawType.includes("pq") || rawType.includes("exam")) {
    return {
      label: "PAST QUESTIONS",
      className: "bg-[#FEF3C7] text-[#D97706]",
    };
  }

  if (rawType.includes("lab") || rawType.includes("manual") || rawType.includes("practical")) {
    return {
      label: "LAB MANUAL",
      className: "bg-[#DCFCE7] text-[#16A34A]",
    };
  }

  if (
    rawType.includes("lecture") ||
    rawType.includes("handout") ||
    rawType.includes("note") ||
    rawType === "pdf"
  ) {
    return {
      label: "PDF HANDOUT",
      className: "bg-[#FFE4E6]/60 text-[#E11D48]",
    };
  }

  return {
    label: (item.type || "GENERAL COURSE").toUpperCase(),
    className: "bg-[#CCFBF1] text-[#0D9488]",
  };
}

