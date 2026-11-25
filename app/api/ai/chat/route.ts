import { getSession } from "@/lib/auth";
import { canAccessSubmission, getResourceById } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import {
  type AiChatTurn,
  type AiStudyMode,
  MAX_AI_CONTEXT_CHARS,
  buildStudySystemPrompt,
  isAiConfigured,
  requestOpenRouterCompletion,
} from "@/lib/ai";

const VALID_MODES: ReadonlySet<AiStudyMode> = new Set([
  "chat",
  "summarize",
  "formulas",
  "quiz",
]);

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY_TURNS = 6;

/**
 * POST /api/ai/chat
 * Signed-in-only, per-user rate-limited AI Study Companion endpoint powered by OpenRouter.
 * Grounds answers in the active PDF resource metadata + lazily extracted page text.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return apiError(
        "UNAUTHORIZED",
        "Please sign in with your student account to use the AI Study Companion.",
        401
      );
    }

    const rate = await checkRateLimit(`ai:${session.userId}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      return apiError(
        "RATE_LIMITED",
        `You've reached the AI study limit (20 messages / 15 min). Please try again in ${rate.retryAfterSeconds}s.`,
        429,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    if (!isAiConfigured()) {
      return apiError(
        "AI_NOT_CONFIGURED",
        "AI Study Companion is not configured on this server yet.",
        503
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("VALIDATION_ERROR", "Invalid JSON request body.", 400);
    }

    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    if (!resourceId || resourceId.length > 80) {
      return apiError("VALIDATION_ERROR", "A valid resourceId is required.", 400);
    }

    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!rawMessage) {
      return apiError("VALIDATION_ERROR", "Please enter a question or prompt.", 400);
    }
    if (rawMessage.length > MAX_MESSAGE_CHARS) {
      return apiError(
        "VALIDATION_ERROR",
        `Questions must be ${MAX_MESSAGE_CHARS} characters or fewer.`,
        400
      );
    }

    const rawMode = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "chat";
    const mode: AiStudyMode = VALID_MODES.has(rawMode as AiStudyMode)
      ? (rawMode as AiStudyMode)
      : "chat";

    const resource = await getResourceById(resourceId);
    if (!resource || !canAccessSubmission(resource, session)) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }

    const currentPage =
      typeof body.currentPage === "number" &&
      Number.isFinite(body.currentPage) &&
      body.currentPage >= 1
        ? Math.round(body.currentPage)
        : undefined;

    const totalPages =
      typeof body.totalPages === "number" &&
      Number.isFinite(body.totalPages) &&
      body.totalPages >= 1
        ? Math.round(body.totalPages)
        : undefined;

    const documentContext =
      typeof body.documentContext === "string"
        ? body.documentContext.slice(0, MAX_AI_CONTEXT_CHARS)
        : undefined;

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const history: AiChatTurn[] = rawHistory
      .slice(-MAX_HISTORY_TURNS)
      .filter(
        (item: unknown): item is { role: string; content: string } =>
          Boolean(item) &&
          typeof item === "object" &&
          ((item as { role?: unknown }).role === "user" ||
            (item as { role?: unknown }).role === "assistant") &&
          typeof (item as { content?: unknown }).content === "string" &&
          (item as { content: string }).content.trim().length > 0
      )
      .map((item: { role: string; content: string }) => ({
        role: item.role as "user" | "assistant",
        content: item.content.trim().slice(0, MAX_MESSAGE_CHARS),
      }));

    const wantsStream = body.stream !== false;

    const systemPrompt = buildStudySystemPrompt({
      title: resource.title,
      courseCode: resource.courseCode,
      department: resource.department,
      level: resource.level,
      type: resource.type,
      currentPage,
      totalPages,
      documentContext,
      mode,
    });

    const result = await requestOpenRouterCompletion({
      systemPrompt,
      history,
      userMessage: rawMessage,
      stream: wantsStream,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }

    if ("stream" in result) {
      return new Response(result.stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-store, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    return apiSuccess({
      reply: result.reply,
      model: result.model,
    });
  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    return apiError("INTERNAL_ERROR", "Failed to process AI study request.", 500);
  }
}
