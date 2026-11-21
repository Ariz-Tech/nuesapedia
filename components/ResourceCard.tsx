"use client";

import Image from "next/image";
import {
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Eye,
  HardDriveDownload,
  Loader2,
  Play,
  Share2,
  Trash2,
} from "lucide-react";
import type { CourseMaterialItem } from "@/lib/saved-client";
import { getResourceBadgeStyle } from "@/lib/badge-styles";
import { resolveCourseMetadata } from "@/lib/courses";

interface ResourceCardProps {
  item: CourseMaterialItem;
  isBookmarked: boolean;
  isCachedOffline: boolean;
  isDownloading: boolean;
  isTogglingBookmark?: boolean;
  isCopied?: boolean;
  isOfflineMode?: boolean;
  onOpen: (item: CourseMaterialItem) => void;
  onToggleBookmark: (item: CourseMaterialItem) => void;
  onDownload: (item: CourseMaterialItem) => void;
  onShare: (item: CourseMaterialItem) => void;
  /** Optional remove action (used on the Saved & Offline shelf) */
  onRemove?: (item: CourseMaterialItem) => void;
  isRemoving?: boolean;
  removeTitle?: string;
}

export default function ResourceCard({
  item,
  isBookmarked,
  isCachedOffline,
  isDownloading,
  isTogglingBookmark = false,
  isCopied = false,
  isOfflineMode = false,
  onOpen,
  onToggleBookmark,
  onDownload,
  onShare,
  onRemove,
  isRemoving = false,
  removeTitle = "Remove from Saved",
}: ResourceCardProps) {
  const isVideo = item.medium === "YOUTUBE";
  const badge = getResourceBadgeStyle(item);
  const courseMeta = resolveCourseMetadata(item.courseCode, {
    department: item.department,
    level: item.level,
    semester: item.semester,
  });
  const canDownloadPdf = !isVideo && (Boolean(item.fileUrl) || isCachedOffline);

  return (
    <article className="bg-surface border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 sm:p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Top Row: Resource Type Pill + Course Code + Offline/Session + Bookmark */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${badge.className}`}
            >
              {badge.label}
            </span>

            <span className="px-2 py-0.5 rounded-md bg-brand-forest text-white text-[11px] font-bold uppercase font-mono">
              {item.courseCode}
            </span>

            {item.sessionYear && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold">
                {item.sessionYear}
              </span>
            )}

            {isCachedOffline && (
              <span
                title="Stored in browser IndexedDB for offline viewing"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-brand-emerald border border-emerald-200 text-[11px] font-bold"
              >
                <HardDriveDownload className="w-3 h-3" />
                <span>Offline</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleBookmark(item)}
            disabled={isTogglingBookmark}
            aria-label={isBookmarked ? "Remove from Saved" : "Save resource"}
            title={isBookmarked ? "Remove from Saved" : "Bookmark to Saved"}
            className="p-1.5 -mr-1.5 -mt-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isTogglingBookmark ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            ) : isBookmarked ? (
              <Bookmark className="h-5 w-5 fill-slate-900 text-slate-900" />
            ) : (
              <Bookmark
                className="h-5 w-5 text-slate-500 hover:text-slate-900"
                strokeWidth={1.8}
              />
            )}
          </button>
        </div>

        {/* Clickable YouTube Thumbnail */}
        {isVideo && item.youtubeVideoId && !isOfflineMode && (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3.5 group/thumb block cursor-pointer text-left"
            aria-label={`Watch ${item.title}`}
          >
            <Image
              src={
                item.thumbnailUrl ||
                `https://img.youtube.com/vi/${item.youtubeVideoId}/hqdefault.jpg`
              }
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            />
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover/thumb:bg-black/40 transition-colors">
              <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md group-hover/thumb:scale-105 transition-transform">
                <Play className="w-4 h-4 fill-white ml-0.5" />
              </div>
            </div>
          </button>
        )}

        {/* Course Name Subtitle */}
        <div className="text-xs font-semibold text-brand-emerald mb-1 line-clamp-1">
          {courseMeta.title}
        </div>

        {/* Material Title (opens Reader / Video Player) */}
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="text-left block w-full cursor-pointer rounded-md"
        >
          <h3 className="text-base sm:text-lg font-bold text-brand-forest group-hover:text-brand-emerald transition-colors leading-snug mb-1.5 line-clamp-2">
            {item.title}
          </h3>
        </button>

        {item.description && (
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-3 leading-relaxed">
            {item.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap font-medium">
          <span className="truncate max-w-[180px]">{item.department}</span>
          {item.level && (
            <>
              <span aria-hidden="true">&bull;</span>
              <span className="shrink-0">{item.level}</span>
            </>
          )}
          <span aria-hidden="true">&bull;</span>
          <span className="shrink-0">
            {item.fileSize || (isVideo ? "Video Stream" : "Free Access")}
          </span>
        </div>
      </div>

      {/* Action Bar: Read/Watch, Share, Optional Remove, Download */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen(item)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            isVideo
              ? "bg-[#DBEAFE]/70 hover:bg-[#DBEAFE] text-[#2563EB]"
              : "bg-emerald-50 hover:bg-emerald-100 text-brand-emerald"
          }`}
        >
          {isVideo ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Watch</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>{isCachedOffline ? "Read Offline" : "Read"}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShare(item)}
            title="Share or copy direct link"
            aria-label={isCopied ? "Link copied" : `Share ${item.title}`}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-brand-emerald hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-pointer"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-brand-emerald" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
          </button>

          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={isRemoving}
              title={removeTitle}
              aria-label={removeTitle}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isRemoving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Remove</span>
            </button>
          )}

          {canDownloadPdf ? (
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => onDownload(item)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${
                isCachedOffline
                  ? "bg-emerald-50 border border-emerald-200 text-brand-forest hover:bg-emerald-100"
                  : "bg-brand-forest hover:bg-brand-forest-dark text-white"
              }`}
              title={
                isCachedOffline
                  ? "Available offline — click to save another copy"
                  : "Download & save for offline reading"
              }
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isCachedOffline ? (
                <HardDriveDownload className="w-3.5 h-3.5 text-brand-emerald" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className={onRemove ? "hidden sm:inline" : ""}>
                {isCachedOffline ? "Saved Copy" : "Download"}
              </span>
            </button>
          ) : (
            item.youtubeUrl &&
            !isOfflineMode && (
              <a
                href={item.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                title="Open on YouTube"
                aria-label={`Open ${item.title} on YouTube`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )
          )}
        </div>
      </div>
    </article>
  );
}

export function ResourceCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-surface border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between animate-pulse"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-24 rounded-full bg-slate-200/80" />
            <div className="h-5 w-16 rounded-md bg-slate-200/80" />
          </div>
          <div className="h-6 w-6 rounded-lg bg-slate-100" />
        </div>
        <div className="h-3.5 w-36 rounded bg-slate-200/70 mb-2" />
        <div className="h-5 w-full rounded bg-slate-200/90 mb-1.5" />
        <div className="h-5 w-4/5 rounded bg-slate-200/90 mb-3" />
        <div className="h-3.5 w-full rounded bg-slate-100 mb-1.5" />
        <div className="h-3.5 w-2/3 rounded bg-slate-100 mb-4" />
        <div className="h-3 w-48 rounded bg-slate-100" />
      </div>
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <div className="h-8 w-20 rounded-xl bg-slate-100" />
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 rounded-xl bg-slate-100" />
          <div className="h-8 w-24 rounded-xl bg-slate-200/80" />
        </div>
      </div>
    </div>
  );
}
