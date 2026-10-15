export const DEPARTMENTS: string[] = [
  "Civil Engineering",
  "Mechanical Engineering",
  "Materials and Metallurgical Engineering",
  "Agric and Bio Resources Engineering",
  "Mining Engineering",
];

export type DepartmentName = string;

export interface DepartmentInfo {
  id: string;
  name: DepartmentName;
  shortName: string;
  code: string;
  slug: string;
  description: string;
  accentColor: string;
  imageBg: string;
}

export const DEPARTMENT_DETAILS: DepartmentInfo[] = [
  {
    id: "CVE",
    name: "Civil Engineering",
    shortName: "Civil",
    code: "CVE",
    slug: "civil",
    description: "Access textbooks, past questions and videos for Civil Engineering courses.",
    accentColor: "from-cyan-900 to-slate-950",
    imageBg: "radial-gradient(circle at 50% 50%, #164e63 0%, #082f49 100%)",
  },
  {
    id: "MEE",
    name: "Mechanical Engineering",
    shortName: "Mechanical",
    code: "MEE",
    slug: "mechanical",
    description: "Access textbooks, past questions and videos for Mechanical Engineering courses.",
    accentColor: "from-slate-800 to-zinc-950",
    imageBg: "radial-gradient(circle at 50% 50%, #1e293b 0%, #090d16 100%)",
  },
  {
    id: "MME",
    name: "Materials and Metallurgical Engineering",
    shortName: "Materials & Metallurgical",
    code: "MME",
    slug: "materials",
    description: "Access textbooks, past questions and videos for Materials Engineering courses.",
    accentColor: "from-zinc-900 to-stone-950",
    imageBg: "radial-gradient(circle at 50% 50%, #292524 0%, #0c0a09 100%)",
  },
  {
    id: "ABE",
    name: "Agric and Bio Resources Engineering",
    shortName: "Agric & Bio Resources",
    code: "ABE",
    slug: "agric",
    description: "Access textbooks, past questions and videos for Agricultural & Bio-Resources courses.",
    accentColor: "from-lime-950 to-slate-950",
    imageBg: "radial-gradient(circle at 50% 50%, #1a2e05 0%, #0a1403 100%)",
  },
  {
    id: "MNE",
    name: "Mining Engineering",
    shortName: "Mining",
    code: "MNE",
    slug: "mining",
    description: "Access textbooks, past questions and videos for Mining Engineering and Mineral Exploration.",
    accentColor: "from-amber-950 to-stone-950",
    imageBg: "radial-gradient(circle at 50% 50%, #451a03 0%, #0c0a09 100%)",
  },
];

export function getDepartmentBySlug(slug: string): DepartmentInfo | undefined {
  return DEPARTMENT_DETAILS.find((d) => d.slug.toLowerCase() === slug.toLowerCase());
}
