"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEPARTMENTS } from "@/lib/departments";
import {
  Bot,
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  GraduationCap,
  FileText,
  AlertCircle,
  Layers,
  ChevronRight,
  Calculator,
  Award,
} from "lucide-react";

type AiTab = "chat" | "quiz" | "summary";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: { page: number; text: string }[];
  timestamp: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizReviewItem {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number;
  isCorrect: boolean;
  explanation: string;
}

interface QuizResult {
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  review: QuizReviewItem[];
}

interface SummaryData {
  overview: string;
  keyConcepts: string[];
  formulas: string[];
  examTips: string[];
}

const DEFAULT_COURSES = [
  { code: "CVE 301", name: "Structural Analysis & Matrix Force Methods", dept: "Civil Engineering" },
  { code: "MEE 201", name: "Applied Vector Mechanics & Statics", dept: "Mechanical Engineering" },
  { code: "MME 202", name: "Physical Metallurgy & Phase Transformations", dept: "Materials and Metallurgical" },
  { code: "ABE 301", name: "Fluid Mechanics & Agricultural Hydrology", dept: "Agric and Bio Resources" },
  { code: "MNE 201", name: "Introduction to Mining & Mineral Exploration", dept: "Mining Engineering" },
];

const PROMPT_SUGGESTIONS = [
  "Derive Bernoulli's Equation and list 4 key assumptions",
  "Explain Mohr's Circle for 2D principal stresses",
  "Compare Rankine Cycle efficiency with Carnot Cycle",
  "How to locate maximum bending moment from Shear Force diagram?",
  "Explain Hardness vs Toughness trade-off in steel metallurgy",
];

export default function AiStudyTutorPage() {
  const [coursesList, setCoursesList] = useState(DEFAULT_COURSES);
  const [activeTab, setActiveTab] = useState<AiTab>("chat");
  const [selectedCourse, setSelectedCourse] = useState(DEFAULT_COURSES[0].code);

  useEffect(() => {
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.courses) && data.courses.length > 0) {
          const list = data.courses.map((c: { code: string; title: string; department: string }) => ({
            code: c.code,
            name: c.title,
            dept: c.department,
          }));
          setCoursesList(list);
          setSelectedCourse(list[0].code);
        }
      })
      .catch(() => {});
  }, []);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_intro",
      sender: "ai",
      text: "Hello Engineer! I am your NuesaPedia Faculty AI Tutor. Ask me any question regarding formulas, derivations, past question problems, or syllabus concepts across Civil, Mechanical, Materials, Agric, and Mining Engineering.",
      sources: [
        { page: 1, text: "Faculty of Engineering Curriculum Standard & Syllabus Guide." },
      ],
      timestamp: "Just now",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quiz State
  const [quizDifficulty, setQuizDifficulty] = useState("MEDIUM");
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [quizTimeRemaining, setQuizTimeRemaining] = useState<number>(600);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Summary State
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // Quiz Countdown Timer
  useEffect(() => {
    if (!activeQuizId || quizResult || quizTimeRemaining <= 0) return;

    const timer = setInterval(() => {
      setQuizTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeQuizId, quizResult, quizTimeRemaining]);

  // Handle Chat Submit
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          courseCode: selectedCourse,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai_${Date.now()}`,
            sender: "ai",
            text: data.data.answer,
            sources: data.data.sources,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: "ai",
            text: "Sorry, I could not complete the derivation right now. Please try again or rephrase your engineering query.",
            timestamp: "Error",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "ai",
          text: "Connection error. Please check your network and try again.",
          timestamp: "Error",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Generate Quiz
  const handleStartQuiz = async () => {
    try {
      setQuizLoading(true);
      setQuizResult(null);
      setUserAnswers({});

      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: selectedCourse,
          difficulty: quizDifficulty,
          numberOfQuestions: quizQuestionCount,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActiveQuizId(data.data.quizId);
        setQuizQuestions(data.data.questions);
        setQuizTimeRemaining(data.data.duration || 600);
      }
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setQuizLoading(false);
    }
  };

  // Select Option in Quiz
  const handleSelectOption = (questionId: string, optionIdx: number) => {
    if (quizResult) return; // Locked once evaluated
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuizId || quizSubmitting) return;

    try {
      setQuizSubmitting(true);
      const res = await fetch(`/api/ai/quiz/${activeQuizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: userAnswers,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setQuizResult(data.data);
      }
    } catch (err) {
      console.error("Failed to submit quiz:", err);
    } finally {
      setQuizSubmitting(false);
    }
  };

  // Fetch Summary
  const handleGenerateSummary = async () => {
    try {
      setSummaryLoading(true);
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode: selectedCourse,
          title: coursesList.find((c) => c.code === selectedCourse)?.name || selectedCourse,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSummaryData(data.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Format Time (mm:ss)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#00875A]" />
              <span>AI Academic Study Partner • Flow 2</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              AI Engineering Tutor & Exam Revision
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-2xl leading-relaxed">
              Step-by-step formula derivations, syllabus concept explanations, timed multiple-choice exam practice, and high-yield study summaries.
            </p>
          </div>

          {/* Course Scope Picker */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              Active Course:
            </span>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
            >
              {coursesList.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl max-w-md mb-8 border border-slate-200/70">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "chat"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Bot className="w-4 h-4 text-[#00875A]" />
            <span>Formula & Q&A</span>
          </button>
          <button
            onClick={() => setActiveTab("quiz")}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "quiz"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Exam Quiz Mode</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("summary");
              if (!summaryData) handleGenerateSummary();
            }}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "summary"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Syllabus Summary</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: FORMULA & Q&A CHAT */}
        {/* ============================================================ */}
        {activeTab === "chat" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Chat Box */}
            <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col h-[650px] overflow-hidden">
              {/* Chat Stream Header */}
              <div className="p-4 px-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Engineering Assistant Session
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Scoped to {selectedCourse} • Citing Faculty Curriculum
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setMessages([
                      {
                        id: "msg_reset",
                        sender: "ai",
                        text: "Session cleared. What engineering topic would you like to explore next?",
                        timestamp: "Just now",
                      },
                    ])
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                  title="Clear Conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-[#00875A] text-white rounded-br-xs shadow-xs"
                          : "bg-slate-50 text-slate-800 border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                      {/* Sources / Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5">
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                            Document Citations & Page References:
                          </span>
                          {msg.sources.map((src, i) => (
                            <div
                              key={i}
                              className="text-[11px] text-slate-600 bg-white/80 px-2 py-1 rounded-md border border-slate-200/50 flex items-center gap-1.5"
                            >
                              <span className="font-bold text-[#00875A]">Page {src.page}:</span>
                              <span>{src.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 max-w-xs text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 text-[#00875A] animate-spin" />
                    <span>Analyzing formula & deriving solution...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input Form */}
              <div className="p-4 border-t border-slate-100 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder={`Ask any question about ${selectedCourse} (e.g. derive equation, worked examples)...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={chatLoading}
                    className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !inputText.trim()}
                    className="p-3 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white disabled:opacity-40 transition-all shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar Suggestions */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-[#00875A]" />
                  <span>Quick Derivation Prompts</span>
                </h3>
                <div className="space-y-2">
                  {PROMPT_SUGGESTIONS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 text-[11px] sm:text-xs text-slate-700 transition-all leading-snug flex items-start justify-between gap-1 group"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#00875A] shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-linear-to-br from-emerald-900 to-slate-950 p-5 rounded-3xl text-white shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 mb-3">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm">Exam Revision Advice</h4>
                <p className="mt-1 text-xs text-emerald-200/80 leading-relaxed">
                  Lecturers in the faculty award partial step marks for identifying correct boundary conditions and sketching valid diagrams.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: EXAM QUIZ MODE */}
        {/* ============================================================ */}
        {activeTab === "quiz" && (
          <div className="max-w-4xl mx-auto">
            {/* Quiz Setup Card (When no active quiz or quiz finished) */}
            {!activeQuizId && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs">
                <div className="max-w-xl mx-auto text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center mx-auto mb-4">
                    <Award className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Faculty Multiple Choice Exam Practice
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Test your mastery against past question style problems. Answers are evaluated with comprehensive mathematical explanations.
                  </p>

                  {/* Settings */}
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Difficulty Level
                      </label>
                      <select
                        value={quizDifficulty}
                        onChange={(e) => setQuizDifficulty(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                      >
                        <option value="EASY">Standard / Conceptual (Easy)</option>
                        <option value="MEDIUM">Typical Past Exam (Medium)</option>
                        <option value="HARD">Rigorous Problem Solving (Hard)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Number of Questions
                      </label>
                      <select
                        value={quizQuestionCount}
                        onChange={(e) => setQuizQuestionCount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                      >
                        <option value={5}>5 Questions (10 mins)</option>
                        <option value={10}>10 Questions (20 mins)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={handleStartQuiz}
                      disabled={quizLoading}
                      className="px-8 py-3.5 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {quizLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating Exam Paper...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Start Timed Practice Quiz</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Quiz Session */}
            {activeQuizId && !quizResult && (
              <div className="space-y-6">
                {/* Active Session Header */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                      {selectedCourse}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-700">
                      {quizQuestions.length} Examination Questions
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono text-xs sm:text-sm font-bold">
                    <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>{formatTimer(quizTimeRemaining)}</span>
                  </div>
                </div>

                {/* Question Cards */}
                <div className="space-y-5">
                  {quizQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-50 text-[#00875A] font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          {q.question}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = userAnswers[q.id] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectOption(q.id, optIdx)}
                              className={`text-left p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                                isSelected
                                  ? "border-[#00875A] bg-emerald-50 text-emerald-950 shadow-2xs ring-1 ring-[#00875A]"
                                  : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                              }`}
                            >
                              <span>
                                <span className="font-bold mr-2 text-slate-400">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                {opt}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? "border-[#00875A] bg-[#00875A]"
                                    : "border-slate-300"
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submit Quiz Bar */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Answered {Object.keys(userAnswers).length} of {quizQuestions.length} questions
                  </div>

                  <button
                    onClick={handleSubmitQuiz}
                    disabled={quizSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white font-bold text-xs sm:text-sm transition-all shadow-xs inline-flex items-center gap-2"
                  >
                    {quizSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Grading Exam...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Submit & Review Answers</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Quiz Results Review View */}
            {quizResult && (
              <div className="space-y-6">
                {/* Score Banner */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs text-center">
                  <div
                    className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-black mb-4 ${
                      quizResult.score >= 70
                        ? "bg-emerald-100 text-emerald-800"
                        : quizResult.score >= 50
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {quizResult.score}%
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {quizResult.score >= 70
                      ? "Outstanding Engineering Mastery!"
                      : quizResult.score >= 50
                      ? "Good Effort — Pass Grade"
                      : "Needs Review & Further Practice"}
                  </h2>

                  <p className="mt-1 text-xs sm:text-sm text-slate-500">
                    You answered {quizResult.correct} out of {quizResult.total} questions correctly.
                  </p>

                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setActiveQuizId(null);
                        setQuizResult(null);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-bold shadow-2xs"
                    >
                      Take Another Quiz
                    </button>
                  </div>
                </div>

                {/* Question-by-Question Explanations */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 text-base">
                    Detailed Explanations & Marking Breakdown:
                  </h3>

                  {quizResult.review.map((item, idx) => (
                    <div
                      key={item.questionId}
                      className={`p-5 rounded-2xl border bg-white ${
                        item.isCorrect ? "border-emerald-200" : "border-red-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-400">Q{idx + 1}.</span>
                          <h4 className="font-bold text-sm text-slate-900">{item.question}</h4>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.isCorrect
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{item.isCorrect ? "Correct" : "Incorrect"}</span>
                        </span>
                      </div>

                      {/* Options Review */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        {item.options.map((opt, optIdx) => {
                          const isCorrectAns = optIdx === item.correctAnswer;
                          const isUserSelected = optIdx === item.selectedAnswer;

                          let badgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                          if (isCorrectAns) {
                            badgeClass = "bg-emerald-50 text-emerald-900 border-emerald-300 font-bold";
                          } else if (isUserSelected && !item.isCorrect) {
                            badgeClass = "bg-red-50 text-red-900 border-red-300 line-through";
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${badgeClass}`}
                            >
                              <span>
                                <span className="font-bold mr-1.5">{String.fromCharCode(65 + optIdx)}.</span>
                                {opt}
                              </span>
                              {isCorrectAns && (
                                <span className="text-[10px] font-bold text-emerald-700 uppercase">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation box */}
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 leading-relaxed">
                        <span className="font-bold text-[#00875A] mr-1.5">Engineering Explanation:</span>
                        {item.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SYLLABUS SUMMARY */}
        {/* ============================================================ */}
        {activeTab === "summary" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {summaryLoading && (
              <div className="py-24 text-center">
                <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Synthesizing course syllabus summary...</p>
              </div>
            )}

            {!summaryLoading && summaryData && (
              <>
                {/* Overview Card */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold mb-3">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Syllabus Executive Summary</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {selectedCourse} Curriculum Compendium
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {summaryData.overview}
                  </p>
                </div>

                {/* Key Concepts Grid */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#00875A]" />
                    <span>Core Conceptual Takeaways</span>
                  </h3>
                  <div className="space-y-2.5">
                    {summaryData.keyConcepts.map((concept, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs sm:text-sm text-slate-700 flex items-start gap-3"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{concept}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Core Formulas */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    <span>Essential Mathematical Formulas & Equations</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {summaryData.formulas.map((formula, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs sm:text-sm flex items-center justify-center text-center shadow-inner"
                      >
                        {formula}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exam Tips */}
                <div className="bg-amber-50/60 p-6 sm:p-8 rounded-3xl border border-amber-200 shadow-2xs">
                  <h3 className="font-bold text-amber-950 text-base mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>High-Yield Examination Tips & Pitfalls</span>
                  </h3>
                  <div className="space-y-2.5">
                    {summaryData.examTips.map((tip, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-white/90 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-start gap-3"
                      >
                        <ChevronRight className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
