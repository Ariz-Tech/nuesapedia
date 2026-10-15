import { NextResponse } from "next/server";

export interface QuizQuestionInternal {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface StoredQuiz {
  id: string;
  courseCode: string;
  difficulty: string;
  questions: QuizQuestionInternal[];
  duration: number;
  createdAt: number;
}

// In-memory quiz storage for active quiz sessions
export const activeQuizzes = new Map<string, StoredQuiz>();

const COURSE_QUESTION_BANK: Record<string, QuizQuestionInternal[]> = {
  CVE: [
    {
      id: "cve_q1",
      question: "In structural analysis, a statically determinate beam with a span L loaded with a uniform distributed load w has a maximum bending moment of:",
      options: ["wL² / 4", "wL² / 8", "wL² / 12", "wL / 2"],
      correctAnswer: 1,
      explanation: "For a simply supported beam with uniformly distributed load w, the maximum bending moment occurs at midspan and is exactly wL² / 8.",
    },
    {
      id: "cve_q2",
      question: "Which test is used to measure the consistency and workability of fresh hydraulic cement concrete?",
      options: ["Vickers test", "Slump test", "Charpy impact test", "Tensile split cylinder test"],
      correctAnswer: 1,
      explanation: "The Slump test (BS EN 12350-2 / ASTM C143) measures the consistency and flowability of freshly mixed concrete.",
    },
    {
      id: "cve_q3",
      question: "In Mohr-Coulomb soil mechanics failure criterion, shear strength τ is defined by:",
      options: ["τ = c + σ tan(φ)", "τ = σ / c + φ", "τ = c · σ · cos(φ)", "τ = 2c + σ sin(φ)"],
      correctAnswer: 0,
      explanation: "The Mohr-Coulomb criterion defines shear strength as τ = c + σ tan(φ), where c is apparent cohesion, σ is effective normal stress, and φ is angle of internal friction.",
    },
    {
      id: "cve_q4",
      question: "What is the primary function of shear stirrups in a reinforced concrete beam?",
      options: ["To resist tensile bending stresses at the bottom fibers", "To prevent diagonal tension shear cracking near supports", "To increase chemical curing rate", "To reduce thermal expansion of aggregate"],
      correctAnswer: 1,
      explanation: "Shear stirrups carry diagonal tension forces caused by high shear stresses near the support reactions of beams.",
    },
    {
      id: "cve_q5",
      question: "In open channel flow, Froude Number (Fr) less than 1.0 indicates:",
      options: ["Supercritical flow (shooting flow)", "Subcritical flow (tranquil flow)", "Critical hydraulic jump", "Laminar creeping flow"],
      correctAnswer: 1,
      explanation: "When Fr < 1, the flow velocity is less than the wave celerity, representing subcritical (tranquil) gravitational flow.",
    },
  ],
  MEE: [
    {
      id: "mee_q1",
      question: "In thermodynamics, the Carnot cycle thermal efficiency between hot reservoir Th and cold reservoir Tc (in Kelvin) is:",
      options: ["1 - Tc/Th", "1 + Th/Tc", "Th / (Th - Tc)", "(Th + Tc) / 2"],
      correctAnswer: 0,
      explanation: "The Carnot efficiency represents the theoretical maximum efficiency for any heat engine operating between two temperature limits: η = 1 - (Tc / Th).",
    },
    {
      id: "mee_q2",
      question: "The dimensionless Reynolds number (Re) physically represents the ratio of:",
      options: ["Viscous forces to gravitational forces", "Inertial forces to viscous forces", "Pressure forces to surface tension", "Buoyancy forces to elastic forces"],
      correctAnswer: 1,
      explanation: "Reynolds number Re = ρvD / μ represents the ratio of dynamic inertial forces to internal viscous shear forces in a fluid.",
    },
    {
      id: "mee_q3",
      question: "Which of the following processes characterizes an ideal throttling process through an insulated porous plug or valve?",
      options: ["Isentropic (constant entropy)", "Isenthalpic (constant enthalpy)", "Isometric (constant volume)", "Isobaric (constant pressure)"],
      correctAnswer: 1,
      explanation: "An ideal steady adiabatic throttling expansion operates at constant enthalpy (h1 = h2), known as the Joule-Thomson expansion.",
    },
    {
      id: "mee_q4",
      question: "In mechanical vibration, resonance occurs when the external forcing frequency matches the system's:",
      options: ["Logarithmic decrement", "Damping coefficient", "Natural frequency", "Spring stiffness constant"],
      correctAnswer: 2,
      explanation: "Resonance occurs when the excitation frequency equals the natural frequency (ω = ωn), resulting in unbounded amplitude in undamped systems.",
    },
    {
      id: "mee_q5",
      question: "According to the Euler-Bernoulli beam theory, the relation between curvature κ, bending moment M, and flexural rigidity EI is:",
      options: ["M = EI / κ", "M = EI · κ", "κ = M · EI", "M = E / (I · κ)"],
      correctAnswer: 1,
      explanation: "From pure bending mechanics: M/I = E/R = E·κ, therefore Bending Moment M = EI·κ where EI is the flexural rigidity.",
    },
  ],
  GENERAL: [
    {
      id: "gen_q1",
      question: "What instrument measures electrical potential difference between two nodes in a circuit?",
      options: ["Ammeter", "Voltmeter", "Wattmeter", "Galvanometer"],
      correctAnswer: 1,
      explanation: "A voltmeter has high internal impedance and is connected in parallel across two nodes to measure electric potential difference (voltage).",
    },
    {
      id: "gen_q2",
      question: "In engineering calculus, the derivative of displacement with respect to time yields:",
      options: ["Acceleration", "Velocity", "Jerk", "Momentum"],
      correctAnswer: 1,
      explanation: "Velocity v(t) = ds/dt is the first time derivative of displacement s(t).",
    },
    {
      id: "gen_q3",
      question: "Hooke's Law in one-dimensional solid mechanics states that stress is directly proportional to strain up to the material's:",
      options: ["Ultimate tensile strength", "Proportional / elastic limit", "Fracture point", "Necked strain hardening limit"],
      correctAnswer: 1,
      explanation: "Hooke's law σ = E·ε applies strictly within the proportional elastic limit of the material before plastic deformation commences.",
    },
    {
      id: "gen_q4",
      question: "The SI unit of dynamic viscosity μ is:",
      options: ["Pascal-second (Pa·s)", "Newton per square meter (N/m²)", "Joule per kilogram (J/kg)", "Stokes (m²/s)"],
      correctAnswer: 0,
      explanation: "Dynamic viscosity has units of Pa·s (or N·s/m² or kg/(m·s)), whereas kinematic viscosity is measured in m²/s.",
    },
    {
      id: "gen_q5",
      question: "Which law states that the induced electromotive force in a closed circuit is equal to the negative rate of change of magnetic flux?",
      options: ["Ampère's circuital law", "Faraday-Lenz Law", "Gauss's law for magnetism", "Ohm's law"],
      correctAnswer: 1,
      explanation: "Faraday's law of induction states EMF = -dΦ/dt, where the negative sign represents Lenz's law of conservation of energy.",
    },
  ],
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { resourceId, courseCode = "ENG", numberOfQuestions = 5, difficulty = "MEDIUM" } = body;

    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const deptPrefix = (courseCode || "").slice(0, 3).toUpperCase();

    let questionPool = COURSE_QUESTION_BANK[deptPrefix] || COURSE_QUESTION_BANK.GENERAL;
    if (questionPool.length < 5) {
      questionPool = [...questionPool, ...COURSE_QUESTION_BANK.GENERAL];
    }

    const count = Math.min(Math.max(Number(numberOfQuestions) || 5, 3), 10);
    const selectedQuestions = questionPool.slice(0, count);

    // Save internally for verification on submit
    const storedQuiz: StoredQuiz = {
      id: quizId,
      courseCode: courseCode || "ENG",
      difficulty,
      questions: selectedQuestions,
      duration: count * 120, // 2 minutes per question
      createdAt: Date.now(),
    };
    activeQuizzes.set(quizId, storedQuiz);

    // Filter out correct answers before sending to client (per API spec Section 25)
    const clientQuestions = selectedQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({
      success: true,
      data: {
        quizId,
        questions: clientQuestions,
        duration: storedQuiz.duration,
      },
    });
  } catch (error) {
    console.error("AI Quiz generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "AI_ERROR", message: "Failed to generate quiz" } },
      { status: 500 }
    );
  }
}
