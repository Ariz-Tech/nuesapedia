"use client";

import { useState, useRef, ChangeEvent, DragEvent, FormEvent, useMemo } from "react";
import Image from "next/image";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Video,
  Play,
  ExternalLink,
} from "lucide-react";
import type { DbSubmission } from "@/lib/db";

export type { DbSubmission };

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

import { DEPARTMENTS } from "@/lib/departments";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"];

const PDF_CATEGORIES = [
  "Lecture Note",
  "Past Question",
  "Textbook",
  "Lab Manual",
  "Formula Sheet / Summary",
];

const VIDEO_CATEGORIES = [
  "Video Tutorial",
  "Exam Walkthrough",
  "Lab Demonstration",
  "Lecture Series",
  "Concept Crash Course",
];

const SEMESTERS = ["First Semester", "Second Semester"];

/**
 * Extract YouTube 11-char video ID from any valid YouTube URL format
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

interface ResourceUploadPortalProps {
  userDepartment?: string;
  userLevel?: string;
  onSuccess?: (submission: DbSubmission) => void;
  onViewSubmissions?: () => void;
}

export default function ResourceUploadPortal({
  userDepartment,
  userLevel,
  onSuccess,
  onViewSubmissions,
}: ResourceUploadPortalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Medium: "PDF" | "YOUTUBE"
  const [medium, setMedium] = useState<"PDF" | "YOUTUBE">("PDF");

  // PDF-specific state
  const [file, setFile] = useState<File | null>(null);

  // YouTube-specific state
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Shared metadata
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState<string>(
    userDepartment && DEPARTMENTS.includes(userDepartment)
      ? userDepartment
      : DEPARTMENTS[0]
  );
  const [level, setLevel] = useState(
    userLevel && LEVELS.includes(userLevel) ? userLevel : "100L"
  );
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [type, setType] = useState(PDF_CATEGORIES[0]);
  const [description, setDescription] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successSubmission, setSuccessSubmission] = useState<DbSubmission | null>(null);

  // Auto-detect YouTube video ID
  const detectedVideoId = useMemo(() => {
    return extractYouTubeId(youtubeUrl);
  }, [youtubeUrl]);

  // When switching medium, adjust default category
  const handleMediumChange = (newMedium: "PDF" | "YOUTUBE") => {
    setMedium(newMedium);
    setErrorMessage("");
    if (newMedium === "YOUTUBE") {
      setType(VIDEO_CATEGORIES[0]);
    } else {
      setType(PDF_CATEGORIES[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMessage("");
    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setErrorMessage("Please select a valid PDF file (.pdf). Other formats are not accepted.");
      return;
    }

    const maxBytes = 30 * 1024 * 1024; // 30 MB
    if (selectedFile.size > maxBytes) {
      setErrorMessage("The selected PDF file exceeds the 30MB limit. Please compress it before uploading.");
      return;
    }

    setFile(selectedFile);

    // Auto-generate a title suggestion if not provided
    if (!title) {
      const cleanName = selectedFile.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ");
      setTitle(cleanName);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!courseCode.trim() || !title.trim()) {
      setErrorMessage("Please provide both Course Code and Resource Title.");
      return;
    }

    if (medium === "PDF" && !file) {
      setErrorMessage("Please select a PDF document to upload.");
      return;
    }

    if (medium === "YOUTUBE") {
      if (!youtubeUrl.trim()) {
        setErrorMessage("Please enter a YouTube video URL.");
        return;
      }
      if (!detectedVideoId) {
        setErrorMessage(
          "Invalid YouTube URL format. Please enter a valid YouTube video link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)"
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setUploadProgress(15);

      if (medium === "YOUTUBE") {
        setUploadProgress(60);
        const response = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            courseCode: courseCode.trim().toUpperCase(),
            department,
            level,
            semester,
            type,
            medium: "YOUTUBE",
            description: description.trim(),
            youtubeUrl: youtubeUrl.trim(),
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to submit YouTube tutorial.");
        }

        const submission = data.data?.submission || data.submission;
        setUploadProgress(100);
        setSuccessSubmission(submission);
        if (onSuccess) onSuccess(submission);
      } else {
        // FLOW 3: CLOUDFLARE R2 DIRECT UPLOAD PIPELINE
        // Step 1: Request pre-signed direct R2 upload URL
        setUploadProgress(20);
        const initResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            courseCode: courseCode.trim().toUpperCase(),
            department,
            level,
            semester,
            type,
            medium: "PDF",
            description: description.trim(),
            fileName: file!.name,
            fileSize: `${(file!.size / (1024 * 1024)).toFixed(1)} MB`,
            contentType: file!.type || "application/pdf",
          }),
        });

        const initData = await initResponse.json();
        if (!initResponse.ok || !initData.success) {
          throw new Error(initData.error || "Failed to initiate Cloudflare R2 upload.");
        }

        const { uploadId, uploadUrl } = initData.data;

        // Step 2: Stream file directly to Cloudflare R2 (Bypasses Next.js server memory)
        setUploadProgress(50);
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file!.type || "application/pdf",
          },
          body: file!,
        });

        if (!uploadResponse.ok) {
          throw new Error("Direct upload to Cloudflare R2 failed. Please try again.");
        }

        // Step 3: Complete upload confirmation and route to Moderation Queue
        setUploadProgress(85);
        const completeResponse = await fetch(`/api/uploads/${uploadId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId }),
        });

        const completeData = await completeResponse.json();
        if (!completeResponse.ok || !completeData.success) {
          throw new Error(completeData.error || "Failed to confirm upload completion.");
        }

        setUploadProgress(100);
        const finalSubmission = completeData.data?.submission || completeData.submission;
        setSuccessSubmission(finalSubmission);
        if (onSuccess) onSuccess(finalSubmission);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setUploadProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSuccessSubmission(null);
    setFile(null);
    setYoutubeUrl("");
    setCourseCode("");
    setTitle("");
    setDescription("");
    setErrorMessage("");
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Success view
  if (successSubmission) {
    const isVid = successSubmission.medium === "YOUTUBE";

    return (
      <div className="bg-white border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="text-center max-w-lg mx-auto py-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100/80 text-[#00875A] flex items-center justify-center mx-auto mb-4 animate-in zoom-in-75">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {isVid ? "Video Tutorial Submitted!" : "PDF Document Submitted!"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
            Your material <strong className="text-slate-800">{successSubmission.title}</strong> has been received and added to your submission records.
          </p>

          {/* YouTube Video Preview in Success */}
          {isVid && successSubmission.thumbnailUrl && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video relative max-w-sm mx-auto shadow-sm group">
              <Image
                src={successSubmission.thumbnailUrl}
                alt={successSubmission.title}
                fill
                unoptimized
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 fill-white ml-0.5" />
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Course Code:</span>
              <span className="font-semibold text-slate-900">{successSubmission.courseCode}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Resource Format:</span>
              <span className="font-semibold text-slate-900">
                {isVid ? "YouTube Video Tutorial" : "PDF Document"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Category:</span>
              <span className="font-semibold text-slate-900">{successSubmission.type}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Review Status:</span>
              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                Awaiting Moderation
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
            >
              Submit Another Resource
            </button>
            {onViewSubmissions && (
              <button
                type="button"
                onClick={onViewSubmissions}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <span>View My Submissions</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
              <UploadCloud className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Student Contribution Portal
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Submit verified engineering documents, past questions, or YouTube video tutorials to empower fellow FUOYE engineers.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Faculty Verified</span>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-rose-400 hover:text-rose-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MEDIUM SWITCHER: PDF vs YOUTUBE */}
      <div className="mt-6">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5">
          Select Material Format <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* PDF Option */}
          <button
            type="button"
            onClick={() => handleMediumChange("PDF")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              medium === "PDF"
                ? "border-[#00875A] bg-emerald-50/50 shadow-2xs ring-2 ring-[#00875A]/20"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                medium === "PDF"
                  ? "bg-[#00875A] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>PDF Document</span>
                {medium === "PDF" && (
                  <span className="text-[10px] font-semibold text-[#00875A] bg-emerald-100 px-1.5 py-0.2 rounded-md">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Upload past questions, lecture handouts, textbook chapters, or lab manuals (up to 30MB).
              </p>
            </div>
          </button>

          {/* YouTube Video Option */}
          <button
            type="button"
            onClick={() => handleMediumChange("YOUTUBE")}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              medium === "YOUTUBE"
                ? "border-red-500 bg-red-50/40 shadow-2xs ring-2 ring-red-500/20"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                medium === "YOUTUBE"
                  ? "bg-red-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <YoutubeIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>YouTube Video Tutorial</span>
                {medium === "YOUTUBE" && (
                  <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-md">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Submit curated YouTube video lectures, lab experiments, or solved engineering problem videos.
              </p>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* FORMAT-SPECIFIC INPUT */}
        {medium === "PDF" ? (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Attach PDF File <span className="text-rose-500">*</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInput}
              className="hidden"
              id="pdf-file-upload"
            />

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#00875A] bg-emerald-50/60 scale-[1.01]"
                    : "border-slate-300 hover:border-[#00875A] hover:bg-slate-50/70"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00875A] flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800">
                  Click to browse or drag and drop your PDF here
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Accepted format: <strong className="text-slate-600">.PDF only</strong> (Maximum file size: 30MB)
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for upload
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-white transition-colors cursor-pointer shrink-0"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* YOUTUBE INPUT & LIVE PREVIEW */
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              YouTube Video URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-red-600">
                <YoutubeIcon className="w-4 h-4" />
              </div>
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            {/* Live YouTube Preview Card */}
            {detectedVideoId ? (
              <div className="p-3.5 rounded-2xl border border-red-200 bg-red-50/30 flex flex-col sm:flex-row items-center gap-4 animate-in fade-in">
                <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0 shadow-xs group">
                  <Image
                    src={`https://img.youtube.com/vi/${detectedVideoId}/hqdefault.jpg`}
                    alt="YouTube Video Thumbnail"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mb-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valid YouTube Video Detected</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Video ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">{detectedVideoId}</code>
                  </div>
                  <a
                    href={`https://www.youtube.com/watch?v=${detectedVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline mt-1.5"
                  >
                    <span>Test Link on YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              youtubeUrl && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Enter a complete YouTube video link to generate thumbnail preview</span>
                </p>
              )
            )}
          </div>
        )}

        {/* Course Code & Title Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Course Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MEE 301"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm uppercase font-semibold text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {medium === "YOUTUBE" ? "Video / Lecture Title" : "Document Title"}{" "}
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                medium === "YOUTUBE"
                  ? "e.g. C++ OOP: Inheritance & Virtual Functions Tutorial"
                  : "e.g. Fluid Mechanics Lecture Notes & Formula Reference"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
            />
          </div>
        </div>

        {/* Department & Academic Level Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Department <span className="text-rose-500">*</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resource Category / Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Resource Category <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(medium === "PDF" ? PDF_CATEGORIES : VIDEO_CATEGORIES).map((cat) => {
              const selected = type === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setType(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    selected
                      ? medium === "YOUTUBE"
                        ? "bg-red-600 text-white shadow-2xs font-semibold"
                        : "bg-[#00875A] text-white shadow-2xs font-semibold"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {medium === "YOUTUBE" ? "Video Outline / Topics Covered" : "Document Summary or Lecturer Notes"}{" "}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder={
              medium === "YOUTUBE"
                ? "e.g. Explains practical coding examples, inheritance diagrams, and virtual destructors..."
                : "e.g. Covers modules 1 to 4 with worked examples on thermodynamics cycles..."
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] resize-none"
          />
        </div>

        {/* Progress Bar when uploading */}
        {isSubmitting && (
          <div className="space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00875A]" />
                {medium === "YOUTUBE"
                  ? "Verifying and registering YouTube tutorial..."
                  : "Uploading PDF to Faculty Vault..."}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  medium === "YOUTUBE" ? "bg-red-600" : "bg-[#00875A]"
                }`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Materials undergo faculty quality check before publishing</span>
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              (medium === "PDF" && !file) ||
              (medium === "YOUTUBE" && (!youtubeUrl || !detectedVideoId))
            }
            className={`px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              medium === "YOUTUBE"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#00875A] hover:bg-[#00734c]"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : medium === "YOUTUBE" ? (
              <>
                <YoutubeIcon className="w-4 h-4" />
                <span>Submit Video Tutorial</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Submit Document</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
