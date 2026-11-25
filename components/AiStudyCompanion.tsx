"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Sparkles,
  X,
  ArrowUp,
  Square,
  WifiOff,
  Lock,
  Loader2,
  RotateCcw,
  FileText,
  Calculator,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { extractApiError } from "@/lib/api-helpers";
import {
  type AiStudyMode,
  type PdfPageText,
  selectRelevantDocumentContext,
} from "@/lib/ai-context";

interface AiStudyCompanionProps {
  resourceId: string;
  resourceTitle: string;
  courseCode: string;
  currentPage: number;
  totalPages?: number;
  isOffline: boolean;
  getPdfTextExtractor: () => (() => Promise<PdfPageText[]>) | null;
  onJumpToPage?: (page: number) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS: Array<{
  label: string;
  prompt: string;
  mode: AiStudyMode;
  icon: "summary" | "formulas" | "quiz";
}> = [
  {
    label: "Summarize this PDF",
    prompt: "Summarize this PDF",
    mode: "summarize",
    icon: "summary",
  },
  {
    label: "Key formulas",
    prompt: "List the key formulas, laws, and definitions from this document",
    mode: "formulas",
    icon: "formulas",
  },
  {
    label: "Practice quiz",
    prompt: "Generate a 5-question practice quiz from this material",
    mode: "quiz",
    icon: "quiz",
  },
];

function renderInlineFormatting(
  line: string,
  onJumpToPage?: (page: number) => void
): ReactNode[] {
  // Split by [Page N], **bold**, and `code` tokens safely without innerHTML
  const tokenRegex = /(\[Page\s+\d+\]|\*\*[^*]+\*\*|`[^`]+`)/gi;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    const pageMatch = part.match(/^\[Page\s+(\d+)\]$/i);
    if (pageMatch) {
      const pageNum = parseInt(pageMatch[1], 10);
      if (onJumpToPage && Number.isFinite(pageNum) && pageNum >= 1) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onJumpToPage(pageNum)}
            title={`Jump to page ${pageNum}`}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-[#00875A] border border-emerald-200/80 text-[11px] font-bold align-baseline transition-colors cursor-pointer"
          >
            p.{pageNum}
          </button>
        );
      }
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-emerald-50 text-[#00875A] text-[11px] font-bold"
        >
          p.{pageNum}
        </span>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

function FormattedAiMessage({
  content,
  onJumpToPage,
}: {
  content: string;
  onJumpToPage?: (page: number) => void;
}) {
  const lines = content.split(/\r?\n/);

  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-600 break-words">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        // Markdown heading (# / ## / ###)
        const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
        if (headingMatch) {
          return (
            <div key={idx} className="font-bold text-slate-900 pt-1">
              {renderInlineFormatting(headingMatch[1], onJumpToPage)}
            </div>
          );
        }

        // Bullet item (- or *)
        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
              <div className="flex-1">
                {renderInlineFormatting(bulletMatch[1], onJumpToPage)}
              </div>
            </div>
          );
        }

        return <p key={idx}>{renderInlineFormatting(line, onJumpToPage)}</p>;
      })}
    </div>
  );
}

export default function AiStudyCompanion({
  resourceId,
  resourceTitle,
  courseCode,
  currentPage,
  totalPages,
  isOffline,
  getPdfTextExtractor,
  onJumpToPage,
}: AiStudyCompanionProps) {
  const { user, loading: authLoading } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [extractingText, setExtractingText] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scannedNotice, setScannedNotice] = useState(false);

  const cachedPagesRef = useRef<PdfPageText[] | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abort any in-flight stream on unmount (parent keys this component by resourceId)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Escape key closes the popover cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (!isOpen || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming, extractingText, isOpen]);

  // Focus input when opened for signed-in users
  useEffect(() => {
    if (isOpen && user && !isOffline) {
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen, user, isOffline]);

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStreaming(false);
    setExtractingText(false);
  }, []);

  const sendPrompt = useCallback(
    async (promptText: string, mode: AiStudyMode = "chat") => {
      const trimmed = promptText.trim();
      if (!trimmed || streaming || extractingText || !user || isOffline) return;

      setErrorMsg(null);
      setInput("");

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `a_${Date.now() + 1}`;

      const priorHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        // 1. Lazily extract text from the loaded PDF on first question (cached thereafter)
        let pages = cachedPagesRef.current;
        if (pages === null) {
          const extractor = getPdfTextExtractor();
          if (extractor) {
            setExtractingText(true);
            try {
              pages = await extractor();
              cachedPagesRef.current = pages;
            } catch {
              pages = [];
            } finally {
              setExtractingText(false);
            }
          } else {
            pages = [];
          }
        }

        const selection = selectRelevantDocumentContext(
          pages,
          trimmed,
          mode,
          currentPage
        );
        if (selection.isScannedOrEmpty && pages.length > 0) {
          setScannedNotice(true);
        }

        // 2. Call authenticated OpenRouter streaming endpoint
        setStreaming(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            resourceId,
            message: trimmed,
            mode,
            currentPage,
            totalPages: selection.totalPages || totalPages,
            documentContext: selection.text || undefined,
            history: priorHistory,
            stream: true,
          }),
        });

        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const msg = extractApiError(
            errData,
            res.status === 401
              ? "Please sign in to use the AI Study Companion."
              : "Could not get an AI response right now."
          );
          setErrorMsg(msg);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        if (contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split(/\r?\n\r?\n/);
            buffer = chunks.pop() ?? "";

            for (const chunk of chunks) {
              const dataLine = chunk
                .split(/\r?\n/)
                .find((l) => l.startsWith("data:"));
              if (!dataLine) continue;
              const jsonStr = dataLine.slice(5).trim();
              if (!jsonStr) continue;

              try {
                const payload = JSON.parse(jsonStr) as {
                  delta?: string;
                  done?: boolean;
                  error?: string;
                };
                if (payload.error) {
                  setErrorMsg(payload.error);
                  break;
                }
                if (payload.delta) {
                  accumulated += payload.delta;
                  const snapshot = accumulated;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: snapshot } : m
                    )
                  );
                }
              } catch {
                // Ignore malformed SSE fragments
              }
            }
          }

          if (!accumulated.trim()) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
        } else {
          // Non-streaming JSON fallback
          const data = await res.json().catch(() => ({}));
          const reply = typeof data?.reply === "string" ? data.reply : "";
          if (reply) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: reply } : m
              )
            );
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") {
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantId || m.content.trim().length > 0)
          );
        } else {
          setErrorMsg("Network error while reaching the AI Study Companion.");
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        abortControllerRef.current = null;
        setStreaming(false);
        setExtractingText(false);
      }
    },
    [
      streaming,
      extractingText,
      user,
      isOffline,
      messages,
      getPdfTextExtractor,
      currentPage,
      resourceId,
      totalPages,
    ]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendPrompt(input, "chat");
  };

  const userInitial = (user?.name?.trim()?.[0] || "S").toUpperCase();

  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40">
      {!isOpen ? (
        /* Collapsed State — Small Vibrant Green Circular Sparkles Button */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Study Companion"
          title={`Ask AI about ${courseCode}`}
          className="w-14 h-14 rounded-full bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_12px_30px_-6px_rgba(16,185,129,0.65)] hover:shadow-[0_14px_34px_-4px_rgba(5,150,105,0.75)] flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-6 h-6" strokeWidth={1.9} />
        </button>
      ) : (
        /* Expanded Floating White Study Card (matches reference design) */
        <section
          aria-label="AI Study Companion"
          className="w-[calc(100vw-2.5rem)] sm:w-[376px] max-h-[min(560px,calc(100vh-4.5rem))] rounded-[28px] bg-white border border-slate-200/80 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.22)] flex flex-col overflow-hidden animate-ui-scale"
        >
          {/* Scrollable Message Thread / Empty / Auth Gate Body */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-[210px] overflow-y-auto px-5 pt-5 pb-3 space-y-5"
          >
            {authLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[#10B981] mb-2" />
                <span className="text-xs font-medium">Loading study companion…</span>
              </div>
            ) : !user ? (
              /* Signed-in gate */
              <div className="py-4 text-center space-y-3">
                <div className="w-11 h-11 rounded-full bg-[#10B981]/15 text-[#059669] flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#0C3B2E]">
                    AI Study Companion
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                    Sign in with your student account to summarize{" "}
                    <span className="font-semibold text-slate-700">{courseCode}</span>,
                    extract formulas, generate quizzes, and ask page-grounded questions.
                  </p>
                </div>
                <Link
                  href={`/login?next=${encodeURIComponent(`/resources/${resourceId}`)}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign in to study with AI</span>
                </Link>
              </div>
            ) : isOffline ? (
              /* Offline notice */
              <div className="py-6 text-center space-y-2.5">
                <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <WifiOff className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#0C3B2E]">
                  You&apos;re currently offline
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                  AI Study Companion requires an internet connection. Your downloaded PDF remains fully readable offline.
                </p>
              </div>
            ) : messages.length === 0 ? (
              /* Signed-in Empty State with Quick-Action Chips */
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="text-[13px] font-bold text-slate-900">Ai</div>
                    <p className="text-[13px] leading-relaxed text-slate-600">
                      Ask anything about{" "}
                      <span className="font-semibold text-slate-800">{courseCode}</span>{" "}
                      ({resourceTitle.length > 48 ? `${resourceTitle.slice(0, 48)}…` : resourceTitle}
                      ) — currently on <span className="font-semibold text-slate-700">Page {currentPage}</span>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pl-10">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.mode}
                      type="button"
                      onClick={() => void sendPrompt(action.prompt, action.mode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-[#059669] border border-transparent hover:border-emerald-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {action.icon === "summary" && <FileText className="w-3 h-3" />}
                      {action.icon === "formulas" && <Calculator className="w-3 h-3" />}
                      {action.icon === "quiz" && <HelpCircle className="w-3 h-3" />}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Conversation Messages (Mockup Layout: Avatar + You, Green Sparkles + Ai) */
              <>
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={msg.id} className="flex items-start gap-3">
                      {isUser ? (
                        user.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover bg-slate-100 border border-slate-200 shrink-0 mt-0.5"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0C3B2E] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {userInitial}
                          </div>
                        )
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[13px] font-bold text-slate-900">
                          {isUser ? "You" : "Ai"}
                        </div>

                        {isUser ? (
                          <p className="text-[13.5px] leading-relaxed text-slate-600 break-words">
                            {msg.content}
                          </p>
                        ) : msg.content ? (
                          <FormattedAiMessage
                            content={msg.content}
                            onJumpToPage={onJumpToPage}
                          />
                        ) : (
                          <div className="inline-flex items-center gap-1.5 py-1 text-xs text-slate-400 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#10B981]" />
                            <span>
                              {extractingText
                                ? "Reading PDF pages…"
                                : "Thinking…"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {scannedNotice && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-800 leading-relaxed">
                This PDF looks like a scanned image without selectable text. I can still answer general{" "}
                <strong>{courseCode}</strong> questions you type here.
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium"
              >
                {errorMsg}
              </div>
            )}
          </div>

          {/* Bottom Composer + Corner Close Button */}
          <div className="px-4 pb-4 pt-2 space-y-3 bg-white shrink-0">
            {user && !isOffline && (
              <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100 focus-within:bg-slate-100/90 focus-within:ring-2 focus-within:ring-[#10B981]/30 pl-4 pr-1.5 py-1.5 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={extractingText}
                    placeholder="Ask a question"
                    aria-label="Ask a question about this PDF"
                    maxLength={1500}
                    className="flex-1 bg-transparent text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0 py-1"
                  />

                  {streaming ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      aria-label="Stop response"
                      title="Stop generating"
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-white" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() || extractingText}
                      aria-label="Send question"
                      className="w-8 h-8 rounded-full bg-[#10B981] hover:bg-[#059669] disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" strokeWidth={2.3} />
                    </button>
                  )}
                </div>
              </form>
            )}

            <div className="flex items-center justify-between">
              <div>
                {messages.length > 0 && !streaming && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setErrorMsg(null);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>New chat</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close AI Study Companion"
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
