import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getApprovedResourcesPaginated, toPublicResource } from "@/lib/db";
import { DEPARTMENTS, getDepartmentBySlug } from "@/lib/departments";
import type { CourseMaterialItem } from "@/lib/saved-client";
import ResourcesCatalogClient from "./ResourcesCatalogClient";

// Revalidate default /resources shell every 60s when accessed without query params
export const revalidate = 60;

const SEMESTERS = ["All Semesters", "First Semester", "Second Semester"];
const CATEGORIES = [
  "All Categories",
  "Lecture Note",
  "Past Question",
  "Video Tutorial",
];

function normalizeCategoryParam(raw?: string): string {
  if (!raw) return "All Categories";
  const lower = raw.trim().toLowerCase();
  if (
    lower.includes("lecture") ||
    lower.includes("handout") ||
    lower.includes("note") ||
    lower.includes("slide")
  ) {
    return "Lecture Note";
  }
  if (lower.includes("past")) return "Past Question";
  if (lower.includes("video")) return "Video Tutorial";
  const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
  return exact || "All Categories";
}

function firstParam(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

interface ResourcesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourcesCatalogPage({
  searchParams,
}: ResourcesPageProps) {
  const sp = await searchParams;

  const rawDept = firstParam(sp.dept) || firstParam(sp.department);
  let resolvedDept = "All Departments";
  if (rawDept) {
    const bySlug = getDepartmentBySlug(rawDept);
    const byName = DEPARTMENTS.find(
      (d) => d.toLowerCase() === rawDept.toLowerCase()
    );
    resolvedDept = bySlug?.name || byName || rawDept;
  }

  const rawSem = firstParam(sp.semester);
  const resolvedSem =
    rawSem && SEMESTERS.includes(rawSem) ? rawSem : "All Semesters";

  const rawCourse = firstParam(sp.course);
  const resolvedCourse = rawCourse ? rawCourse.toUpperCase() : "All Courses";

  const rawMedium = firstParam(sp.medium);
  const resolvedMedium: "ALL" | "PDF" | "YOUTUBE" | "OFFLINE" =
    rawMedium === "PDF" || rawMedium === "YOUTUBE" || rawMedium === "OFFLINE"
      ? rawMedium
      : "ALL";

  const resolvedCategory = normalizeCategoryParam(firstParam(sp.category));
  const resolvedQuery = firstParam(sp.search) ?? firstParam(sp.q) ?? "";

  let initialResources: CourseMaterialItem[] | undefined = undefined;
  let initialTotal = 0;
  let initialTotalPages = 1;

  if (resolvedMedium !== "OFFLINE") {
    try {
      const result = await getApprovedResourcesPaginated({
        department: resolvedDept !== "All Departments" ? resolvedDept : undefined,
        semester: resolvedSem !== "All Semesters" ? resolvedSem : undefined,
        courseCode: resolvedCourse !== "All Courses" ? resolvedCourse : undefined,
        type: resolvedCategory !== "All Categories" ? resolvedCategory : undefined,
        medium: resolvedMedium !== "ALL" ? resolvedMedium : undefined,
        query: resolvedQuery.trim() || undefined,
        sortBy: "newest",
        page: 1,
        limit: 24,
      });

      initialResources = result.resources.map((r) => {
        const pub = toPublicResource(r);
        return {
          ...pub,
          resourceId: pub.id,
        };
      });
      initialTotal = result.total;
      initialTotalPages = result.totalPages;
    } catch {
      initialResources = undefined;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
          <Navbar />
          <div
            role="status"
            aria-live="polite"
            className="flex-1 flex flex-col items-center justify-center p-12"
          >
            <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">
              Loading course materials...
            </p>
          </div>
          <Footer />
        </div>
      }
    >
      <ResourcesCatalogClient
        initialResources={initialResources}
        initialTotal={initialTotal}
        initialTotalPages={initialTotalPages}
        initialFilters={{
          dept: resolvedDept,
          semester: resolvedSem,
          course: resolvedCourse,
          medium: resolvedMedium,
          category: resolvedCategory,
          query: resolvedQuery,
        }}
      />
    </Suspense>
  );
}
