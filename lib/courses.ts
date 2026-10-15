/**
 * Official Faculty of Engineering Course Registry (FUOYE)
 * Used to resolve official titles, credit units, and curriculum descriptions
 * for courses that have verified materials in the database.
 */

export interface CourseMetadata {
  code: string;
  title: string;
  units: number;
  department: string;
  level: string;
  semester: "First Semester" | "Second Semester";
  description: string;
}

export const COURSE_REGISTRY: Record<string, CourseMetadata> = {
  // 100L General Faculty Engineering
  "ENG 101": {
    code: "ENG 101",
    title: "Workshop Practice & Technology I",
    units: 2,
    department: "Civil Engineering",
    level: "100L",
    semester: "First Semester",
    description: "Hands-on machine safety, carpentry, fitting, sheet metal, and welding fundamentals.",
  },
  "ENG 102": {
    code: "ENG 102",
    title: "General Engineering Drawing I",
    units: 2,
    department: "Mechanical Engineering",
    level: "100L",
    semester: "First Semester",
    description: "Orthographic projections, isometric views, geometric construction, and dimensioning standards.",
  },
  "MTH 101": {
    code: "MTH 101",
    title: "Elementary Mathematics I (Calculus & Algebra)",
    units: 3,
    department: "Civil Engineering",
    level: "100L",
    semester: "First Semester",
    description: "Limits, continuity, differentiation, integration techniques, and polynomial theory.",
  },
  "PHY 101": {
    code: "PHY 101",
    title: "General Physics I (Mechanics & Properties of Matter)",
    units: 3,
    department: "Mining Engineering",
    level: "100L",
    semester: "First Semester",
    description: "Kinematics, dynamics, conservation laws, gravitation, elasticity, and fluids.",
  },

  // 200L Faculty
  "ENG 201": {
    code: "ENG 201",
    title: "Engineering Mathematics I",
    units: 3,
    department: "Civil Engineering",
    level: "200L",
    semester: "First Semester",
    description: "First and second-order differential equations, matrices, determinants, and Fourier series.",
  },
  "CVE 201": {
    code: "CVE 201",
    title: "Strength of Materials I",
    units: 3,
    department: "Civil Engineering",
    level: "200L",
    semester: "First Semester",
    description: "Axial loads, stress-strain relationships, torsion of circular shafts, and shear force/bending moment.",
  },
  "MEE 201": {
    code: "MEE 201",
    title: "Applied Mechanics & Vector Dynamics",
    units: 3,
    department: "Mechanical Engineering",
    level: "200L",
    semester: "First Semester",
    description: "Equilibrium of rigid bodies, 2D/3D force systems, friction, moments of inertia, and kinematics.",
  },
  "MME 201": {
    code: "MME 201",
    title: "Introduction to Materials Science",
    units: 2,
    department: "Materials and Metallurgical Engineering",
    level: "200L",
    semester: "First Semester",
    description: "Atomic bonding, crystal structures, Miller indices, imperfections, and phase diagrams.",
  },
  "MME 202": {
    code: "MME 202",
    title: "Physical Metallurgy & Phase Transformations",
    units: 3,
    department: "Materials and Metallurgical Engineering",
    level: "200L",
    semester: "First Semester",
    description: "Crystal structures, iron-carbon equilibrium diagrams, TTT cooling curves, and alloy properties.",
  },
  "ABE 201": {
    code: "ABE 201",
    title: "Introduction to Agricultural Engineering",
    units: 2,
    department: "Agric and Bio Resources Engineering",
    level: "200L",
    semester: "First Semester",
    description: "Scope of agricultural engineering, farm machinery, soil physics, and post-harvest technology.",
  },
  "MNE 201": {
    code: "MNE 201",
    title: "Introduction to Mining & Mineral Exploration",
    units: 2,
    department: "Mining Engineering",
    level: "200L",
    semester: "First Semester",
    description: "History of mining, mineral reconnaissance, rock sampling, quarry operations, and safety.",
  },

  // 300L Department Specific
  "CVE 301": {
    code: "CVE 301",
    title: "Structural Analysis & Matrix Force Methods",
    units: 3,
    department: "Civil Engineering",
    level: "300L",
    semester: "First Semester",
    description: "Indeterminate trusses, moment distribution method, slope deflection, and virtual work.",
  },
  "CVE 302": {
    code: "CVE 302",
    title: "Structural Steel & Timber Design",
    units: 3,
    department: "Civil Engineering",
    level: "300L",
    semester: "Second Semester",
    description: "Design of tension, compression, and flexural steel members according to Eurocode / BS standards.",
  },
  "MEE 301": {
    code: "MEE 301",
    title: "Thermodynamics II & Heat Transfer",
    units: 3,
    department: "Mechanical Engineering",
    level: "300L",
    semester: "First Semester",
    description: "Conduction, convection, radiation heat exchangers, gas power cycles, and refrigeration systems.",
  },
  "MME 301": {
    code: "MME 301",
    title: "Mechanical Metallurgy & Fracture Mechanics",
    units: 3,
    department: "Materials and Metallurgical Engineering",
    level: "300L",
    semester: "First Semester",
    description: "Elastic/plastic deformation, dislocation theory, fatigue, creep, and brittle fracture analysis.",
  },
  "ABE 301": {
    code: "ABE 301",
    title: "Fluid Mechanics & Agricultural Hydrology",
    units: 3,
    department: "Agric and Bio Resources Engineering",
    level: "300L",
    semester: "First Semester",
    description: "Bernoulli theorem, open channel hydraulics, soil-water conservation, and watershed flood estimation.",
  },
  "MNE 301": {
    code: "MNE 301",
    title: "Drilling, Blasting & Rock Fragmentation",
    units: 3,
    department: "Mining Engineering",
    level: "300L",
    semester: "First Semester",
    description: "Explosive chemistry, blast hole patterns, detonation physics, vibration control, and safety.",
  },

  // 400L & 500L
  "CVE 401": {
    code: "CVE 401",
    title: "Reinforced Concrete & Foundation Engineering",
    units: 3,
    department: "Civil Engineering",
    level: "400L",
    semester: "First Semester",
    description: "Limit state design of beams, slabs, columns, pad footings, and retaining walls.",
  },
  "MEE 401": {
    code: "MEE 401",
    title: "Machine Element Design & Failure Analysis",
    units: 3,
    department: "Mechanical Engineering",
    level: "400L",
    semester: "First Semester",
    description: "Design of shafts, gears, journal bearings, brakes, clutches, and finite element modeling.",
  },
  "MNE 501": {
    code: "MNE 501",
    title: "Mine Feasibility & Environmental Assessment",
    units: 3,
    department: "Mining Engineering",
    level: "500L",
    semester: "First Semester",
    description: "Economic valuation of ore deposits, discounted cash flows, mine reclamation, and EIA standards.",
  },
};

/**
 * Resolves standard metadata for a course code.
 * If not present in the registry, provides clean defaults based on submission data.
 */
export function resolveCourseMetadata(
  code: string,
  fallback?: {
    title?: string;
    department?: string;
    level?: string;
    semester?: string;
    description?: string;
  }
): CourseMetadata {
  const normalized = code.trim().toUpperCase();
  const known = COURSE_REGISTRY[normalized];

  if (known) {
    return {
      ...known,
      department: fallback?.department || known.department,
      level: fallback?.level || known.level,
      semester: (fallback?.semester as "First Semester" | "Second Semester") || known.semester,
      description: fallback?.description || known.description,
    };
  }

  // Derive level from code number if possible (e.g. "CVE 301" -> "300L")
  const numMatch = normalized.match(/\d{3}/);
  const derivedLevel = numMatch ? `${numMatch[0][0]}00L` : fallback?.level || "100L";

  return {
    code: normalized,
    title: fallback?.title || `${normalized} Course Materials`,
    units: 3,
    department: fallback?.department || "General Engineering",
    level: derivedLevel,
    semester: (fallback?.semester as "First Semester" | "Second Semester") || "First Semester",
    description:
      fallback?.description ||
      `Official faculty course curriculum materials, past questions, and lecture notes for ${normalized}.`,
  };
}
