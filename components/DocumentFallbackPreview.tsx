"use client";

import { Download, ExternalLink, FileText, Presentation } from "lucide-react";
import { getFileFormatDisplay } from "@/lib/file-utils";

interface DocumentFallbackPreviewProps {
  title: string;
  fileName?: string;
  fileUrl: string;
  onDownload: () => void;
  compact?: boolean;
}

export default function DocumentFallbackPreview({
  title,
  fileName,
  fileUrl,
  onDownload,
  compact = false,
}: DocumentFallbackPreviewProps) {
  const formatInfo = getFileFormatDisplay(fileName);

  const iconTone = formatInfo.isPresentation
    ? "bg-amber-100 text-amber-700"
    : formatInfo.isWord
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-brand-emerald";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-surface-subtle">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xs ${iconTone}`}
      >
        {formatInfo.isPresentation ? (
          <Presentation className="w-8 h-8" />
        ) : (
          <FileText className="w-8 h-8" />
        )}
      </div>

      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {formatInfo.label} &bull; {formatInfo.extension}
      </span>

      <h4
        className={`${
          compact ? "text-lg" : "text-lg sm:text-xl"
        } font-bold text-brand-forest max-w-md mb-2 leading-snug`}
      >
        {title}
      </h4>

      <p className="text-xs sm:text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
        {fileName || "This file"} is published in native {formatInfo.label} format. Download it directly to your device or open it in your document reader.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-emerald hover:bg-brand-emerald-hover text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download {formatInfo.isPresentation ? "Slides" : "Document"}</span>
        </button>

        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-surface hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold transition-colors"
        >
          <span>Open File</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
