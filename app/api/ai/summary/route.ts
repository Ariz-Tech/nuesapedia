import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { resourceId, courseCode, title } = body;

    const summaryData = {
      overview: `Comprehensive academic compendium for ${courseCode || "Engineering Core"}: "${title || "Curriculum Resource"}". This syllabus unit covers mathematical models, physical governing principles, and standard industry design procedures required for undergraduate engineering examinations.`,
      keyConcepts: [
        "Conservation Laws: Mass continuity, Newton-Euler equilibrium, and thermodynamic energy balance.",
        "Constitutive Material Behavior: Stress-strain relations, elastic limit, plastic yield, and Poisson's effect.",
        "System Governing Equations: Ordinary and partial differential representations of dynamic engineering phenomena.",
        "Failure Criteria: Mohr-Coulomb, Tresca maximum shear, and Von Mises distortion energy yield limits.",
      ],
      formulas: [
        "\\sigma = \\frac{P}{A} \\pm \\frac{My}{I} \\quad \\text{(Combined Axial and Bending Stress)}",
        "\\tau = \\frac{Tr}{J} \\quad \\text{(Torsional Shear Stress in Circular Shafts)}",
        "\\Delta = \\frac{PL^3}{3EI} \\quad \\text{(Cantilever Tip Deflection under Point Load)}",
        "Re = \\frac{\\rho v D}{\\mu} \\quad \\text{(Reynolds Number for Flow Regime Classification)}",
      ],
      examTips: [
        "Always state assumptions before beginning derivations (e.g., small deformations, linear elastic isotropic material, steady flow).",
        "Draw clear, well-proportioned Free Body Diagrams with labeled axes and reaction coordinate systems.",
        "Check units explicitly at each calculation stage (convert mm to m when using Pascals and Newtons).",
        "Review past question marking schemes: step marks are awarded for equilibrium equations even if the final numerical arithmetic is incorrect.",
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        resourceId: resourceId || "res_demo",
        summary: summaryData,
      },
    });
  } catch (error) {
    console.error("AI Summary error:", error);
    return NextResponse.json(
      { success: false, error: { code: "AI_ERROR", message: "Failed to generate summary" } },
      { status: 500 }
    );
  }
}
