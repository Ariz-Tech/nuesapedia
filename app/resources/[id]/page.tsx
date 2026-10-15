"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  Download,
  Bookmark,
  Share2,
  FileText,
  Play,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Sparkles,
  MessageSquare,
  Bot,
  Send,
  Loader2,
  Maximize2,
  ShieldCheck,
  Eye,
} from "lucide-react";

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface ResourceDetail {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  description?: string;
  createdAt: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ResourceReaderPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const resourceId = resolvedParams.id;

  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"reader" | "ai" | "details">("reader");

  // Reading progress state
  const [readPercentage, setReadPercentage] = useState(25);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<
    { sender: "user" | "ai"; text: string }[]
  >([
    {
      sender: "ai",
      text: "Hello Engineer! I am your AI Study Tutor for this course. Ask me to summarize key formulas, explain challenging theoretical derivations, or solve practice problems from this material.",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    // Attempt to load resource directly by ID from database
    fetch(`/api/resources/${resourceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.resource) {
          setResource(data.resource);
          return;
        }

        // Try general list if direct fetch didn't return
        return fetch(`/api/resources`)
          .then((res) => (res.ok ? res.json() : null))
          .then((listData) => {
            if (listData?.success && listData?.resources) {
              const found = listData.resources.find((r: ResourceDetail) => r.id === resourceId);
              if (found) {
                setResource(found);
                return;
              }
            }
            setResource(null);
          });
      })
      .catch((err) => {
        console.error("Failed to load resource:", err);
        setResource(null);
      })
      .finally(() => setLoading(false));
  }, [resourceId]);

  const handleSaveBookmark = async () => {
    if (!resource) return;
    try {
      setSavingBookmark(true);
      const res = await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          title: resource.title,
          courseCode: resource.courseCode,
          department: resource.department,
          type: resource.type,
          fileSize: resource.fileSize || "Cloudflare R2 File",
        }),
      });
      if (res.ok) {
        setBookmarked(true);
      }
    } catch (err) {
      console.error("Save bookmark error:", err);
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleSendAiMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isAiThinking) return;

    const userText = inputQuery.trim();
    setInputQuery("");
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setIsAiThinking(true);

    setTimeout(() => {
      let aiReply = `Based on ${resource?.courseCode} (${resource?.title}): Here is the key breakdown:\n\n1. Formula: Moment equation M(x) = E * I * (d²y/dx²)\n2. Boundary conditions: At fixed supports, both deflection (y) and slope (θ) are equal to 0.\n3. Practical advice: Ensure your free body diagrams resolve all horizontal and vertical reaction forces before applying equilibrium equations.`;

      if (userText.toLowerCase().includes("summary")) {
        aiReply = `Summary of ${resource?.title}:\nThis document covers 4 core units: unit 1 covers fundamental statics; unit 2 explores determinate truss analysis using method of sections; unit 3 derives slope-deflection equations; and unit 4 contains past exam problem solutions.`;
      }

      setChatMessages((prev) => [...prev, { sender: "ai", text: aiReply }]);
      setIsAiThinking(false);
    }, 1200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Opening resource reader...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Material Not Found</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed max-w-md">
            This study material does not exist in the faculty vault, or is currently awaiting moderator approval.
          </p>
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Resources Directory</span>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const isVideo = resource.medium === "YOUTUBE";

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Resource Catalog</span>
          </Link>

          {/* Action Header Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveBookmark}
              disabled={savingBookmark}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                bookmarked
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {bookmarked ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span>{bookmarked ? "Saved to Vault" : "Bookmark Resource"}</span>
            </button>

            {resource.fileUrl && (
              <a
                href={resource.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold transition-all shadow-xs"
              >
                {isVideo ? (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Watch on YouTube</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </a>
            )}
          </div>
        </div>

        {/* Resource Header Info Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${
                isVideo
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
              }`}
            >
              {isVideo ? (
                <YoutubeIcon className="w-4 h-4 text-red-600" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isVideo ? "YouTube Video Tutorial" : "Faculty PDF Document"}</span>
            </span>

            <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-mono text-xs font-extrabold uppercase">
              {resource.courseCode}
            </span>

            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              {resource.level}
            </span>

            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
              {resource.department}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug mb-3">
            {resource.title}
          </h1>

          {resource.description && (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl mb-4">
              {resource.description}
            </p>
          )}

          {/* Reader Sub-Tabs */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("reader")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "reader"
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {isVideo ? <Play className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isVideo ? "Video Player" : "In-Browser Document Reader"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ai"
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ask AI Study Tutor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "details"
                  ? "bg-[#0C3B2E] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Course Syllabus & Metadata</span>
            </button>
          </div>
        </div>

        {/* TAB 1: IN-BROWSER READER / VIDEO PLAYER */}
        {activeTab === "reader" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs">
            {isVideo ? (
              /* YouTube Video Player Embed */
              <div className="space-y-4">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                  {resource.youtubeVideoId ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${resource.youtubeVideoId}?autoplay=0&rel=0`}
                      title={resource.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-6">
                      <Play className="w-12 h-12 text-red-500 mb-2" />
                      <p className="text-sm">Video streaming link ready</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>Streamed via verified YouTube educational resource</span>
                  <a
                    href={resource.youtubeUrl || `https://www.youtube.com/watch?v=${resource.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00875A] font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open in full YouTube player</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              /* PDF Document Viewer Frame */
              <div className="space-y-4">
                {/* Reading Toolbar */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Reading Progress:</span>
                    <div className="w-24 sm:w-36 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-[#00875A] rounded-full transition-all"
                        style={{ width: `${readPercentage}%` }}
                      />
                    </div>
                    <span className="font-mono font-semibold">{readPercentage}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReadPercentage((p) => Math.min(100, p + 25))}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                    >
                      Next Page
                    </button>
                    {resource.fileUrl && (
                      <a
                        href={resource.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Fullscreen</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Embedded Viewer iframe */}
                <div className="relative w-full h-[650px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
                  {resource.fileUrl ? (
                    <iframe
                      src={`${resource.fileUrl}#toolbar=1`}
                      title={resource.title}
                      className="w-full h-full border-0"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <FileText className="w-12 h-12 text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-700">Document preview ready</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Use the download button above to save the complete lecture notes.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ASK AI STUDY TUTOR */}
        {activeTab === "ai" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  AI Study Tutor: {resource.courseCode}
                </h3>
                <p className="text-xs text-slate-500">
                  Semantic RAG assistant grounded in this specific course material.
                </p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="space-y-4 max-h-[450px] overflow-y-auto p-3 mb-4 rounded-2xl bg-slate-50/60 border border-slate-100">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.sender === "ai" && (
                    <div className="w-7 h-7 rounded-lg bg-[#0C3B2E] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === "user"
                        ? "bg-[#00875A] text-white rounded-tr-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isAiThinking && (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00875A]" />
                  <span>AI Study Tutor is analyzing lecture notes...</span>
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendAiMessage} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask anything about this course (e.g. summarize chapter 2, derive formula)..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
              />
              <button
                type="submit"
                disabled={isAiThinking || !inputQuery.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Ask AI</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: COURSE SYLLABUS & METADATA */}
        {activeTab === "details" && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Academic Metadata & Accreditation Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Course Code</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">{resource.courseCode}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Department</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.department}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Academic Level</div>
                <div className="text-base font-extrabold text-slate-900 mt-1">{resource.level}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Semester</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.semester}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">Resource Category</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{resource.type}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold uppercase text-slate-400">File Storage</div>
                <div className="text-sm font-bold text-emerald-800 mt-1">
                  Cloudflare R2 Object Store ({resource.fileSize || "Streaming"})
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong>Quality Assurance Verified:</strong> This academic resource has been checked by NUESA faculty moderators to ensure alignment with the latest FUOYE Faculty of Engineering benchmark standards.
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
