export type AiStudyMode = "chat" | "summarize" | "formulas" | "quiz";

export interface PdfPageText {
  page: number;
  text: string;
}

export interface SelectedDocumentContext {
  text: string;
  includedPages: number[];
  totalPages: number;
  isScannedOrEmpty: boolean;
  truncated: boolean;
}

export const MAX_AI_CONTEXT_CHARS = 32_000;
const MIN_TEXT_CHARS_FOR_NON_SCANNED = 40;

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "what", "when", "where",
  "which", "who", "how", "why", "are", "was", "were", "have", "has", "had",
  "can", "could", "would", "should", "about", "into", "your", "their", "there",
  "please", "explain", "tell", "give", "show", "pdf", "page", "notes", "slide",
  "slides", "document", "summarize", "summary", "quiz", "formula", "formulas",
]);

function normalizePageText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function extractQueryTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    )
  ).slice(0, 16);
}

/**
 * Selects a bounded, page-labeled context window from extracted PDF pages.
 * - Small/medium PDFs fit in full (`<= maxChars`).
 * - Large textbooks prioritize `currentPage ± 2` plus keyword-ranked pages (for Q&A)
 *   or evenly distributed representative pages (for summarize/formulas/quiz).
 */
export function selectRelevantDocumentContext(
  pages: PdfPageText[],
  query: string,
  mode: AiStudyMode = "chat",
  currentPage: number = 1,
  maxChars: number = MAX_AI_CONTEXT_CHARS
): SelectedDocumentContext {
  const cleaned = pages
    .map((p) => ({ page: p.page, text: normalizePageText(p.text) }))
    .filter((p) => p.text.length > 0)
    .sort((a, b) => a.page - b.page);

  const totalPages = pages.length;
  const totalChars = cleaned.reduce((sum, p) => sum + p.text.length, 0);

  if (totalChars < MIN_TEXT_CHARS_FOR_NON_SCANNED) {
    return {
      text: "",
      includedPages: [],
      totalPages,
      isScannedOrEmpty: true,
      truncated: false,
    };
  }

  const formatPage = (p: PdfPageText) => `[Page ${p.page}]\n${p.text}`;
  const fullFormatted = cleaned.map(formatPage).join("\n\n");

  if (fullFormatted.length <= maxChars) {
    return {
      text: fullFormatted,
      includedPages: cleaned.map((p) => p.page),
      totalPages,
      isScannedOrEmpty: false,
      truncated: false,
    };
  }

  // Prioritize pages for large documents
  const selectedMap = new Map<number, PdfPageText>();
  const byPage = new Map<number, PdfPageText>(cleaned.map((p) => [p.page, p]));

  const tryAddPage = (pageObj: PdfPageText | undefined, currentLen: { value: number }): boolean => {
    if (!pageObj || selectedMap.has(pageObj.page)) return false;
    const block = formatPage(pageObj);
    const overhead = selectedMap.size > 0 ? 2 : 0;
    if (currentLen.value + overhead + block.length > maxChars) {
      // Allow partial slice only if nothing has been added yet
      if (selectedMap.size === 0) {
        const allowed = Math.max(200, maxChars - 32);
        selectedMap.set(pageObj.page, {
          page: pageObj.page,
          text: `${pageObj.text.slice(0, allowed)}...`,
        });
        currentLen.value = maxChars;
        return true;
      }
      return false;
    }
    selectedMap.set(pageObj.page, pageObj);
    currentLen.value += overhead + block.length;
    return true;
  };

  const budget = { value: 0 };

  // 1. Always include the exact page the student is currently looking at
  const safeCurrent = Math.max(1, Math.round(currentPage));
  tryAddPage(byPage.get(safeCurrent), budget);

  if (mode === "chat") {
    // 2a. Explicit "page N" references in the user's prompt
    const explicitPageMatches = Array.from(query.matchAll(/\bpage\s*(\d{1,4})\b/gi)).map((m) =>
      parseInt(m[1], 10)
    );
    for (const pNum of explicitPageMatches) {
      tryAddPage(byPage.get(pNum), budget);
    }

    // 2b. Top keyword-matched pages BEFORE surrounding context so Q&A never starves relevant pages
    const terms = extractQueryTerms(query);
    if (terms.length > 0) {
      const scored = cleaned
        .filter((p) => !selectedMap.has(p.page))
        .map((p) => {
          const lower = p.text.toLowerCase();
          let score = 0;
          for (const term of terms) {
            if (lower.includes(term)) {
              score += 2;
              const hits = lower.split(term).length - 1;
              score += Math.min(3, hits - 1);
            }
          }
          return { page: p, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || a.page.page - b.page.page);

      for (const item of scored) {
        if (budget.value >= maxChars - 300) break;
        tryAddPage(item.page, budget);
      }
    }
  }

  // 3. Add surrounding reading window (±1, ±2) and page 1 (title/syllabus/TOC)
  for (const offset of [1, -1, 2, -2]) {
    tryAddPage(byPage.get(safeCurrent + offset), budget);
  }
  tryAddPage(cleaned[0], budget);

  // 3. Fill remaining budget with evenly sampled pages across the document
  if (budget.value < maxChars - 400) {
    const remaining = cleaned.filter((p) => !selectedMap.has(p.page));
    const stride = Math.max(1, Math.floor(remaining.length / 18));
    for (let i = 0; i < remaining.length; i += stride) {
      if (budget.value >= maxChars - 300) break;
      tryAddPage(remaining[i], budget);
    }
  }

  const ordered = Array.from(selectedMap.values()).sort((a, b) => a.page - b.page);
  const text = ordered.map(formatPage).join("\n\n").slice(0, maxChars);

  return {
    text,
    includedPages: ordered.map((p) => p.page),
    totalPages,
    isScannedOrEmpty: false,
    truncated: ordered.length < cleaned.length,
  };
}
