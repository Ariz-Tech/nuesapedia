"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PdfUploadPortal, { DbSubmission } from "@/components/PdfUploadPortal";
import {
  Bookmark,
  Building2,
  Dices,
  Download,
  FileText,
  GraduationCap,
  LogOut,
  Mail,
  Trash2,
  UserCheck,
  Loader2,
  ExternalLink,
  UploadCloud,
  FileCheck2,
  Clock,
  Eye,
  PlusCircle,
  Play,
} from "lucide-react";
import { getRandomAvatar } from "@/lib/avatars";

function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  level: string;
  avatar: string;
  role: string;
  createdAt?: string;
}

interface SavedResource {
  id: string;
  resourceId: string;
  title: string;
  courseCode: string;
  department: string;
  type: string;
  fileSize: string;
  createdAt: string;
}

type TabType = "vault" | "upload" | "submissions";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [savedResources, setSavedResources] = useState<SavedResource[]>([]);
  const [submissions, setSubmissions] = useState<DbSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("vault");
  const [loading, setLoading] = useState(true);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchSubmissions();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      const data = await res.json();

      if (!res.ok || !data.success) {
        // If not logged in, redirect to login
        router.push("/login");
        return;
      }

      setUser(data.user);
      setSavedResources(data.savedResources || []);
    } catch (err) {
      console.error("Failed to load profile:", err);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch("/api/uploads");
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  };

  const handleRollAvatar = async () => {
    if (!user) return;
    try {
      setUpdatingAvatar(true);
      const newAvatar = getRandomAvatar(user.name || "Student");

      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: newAvatar }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, avatar: newAvatar } : null));
      }
    } catch (err) {
      console.error("Failed to update avatar:", err);
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleRemoveSaved = async (resourceId: string) => {
    try {
      setRemovingId(resourceId);
      const res = await fetch(`/api/saved?resourceId=${encodeURIComponent(resourceId)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSavedResources((prev) => prev.filter((r) => r.resourceId !== resourceId));
      }
    } catch (err) {
      console.error("Failed to remove saved resource:", err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("Are you sure you want to withdraw this document submission?")) {
      return;
    }

    try {
      setDeletingSubId(submissionId);
      const res = await fetch(`/api/uploads?id=${encodeURIComponent(submissionId)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      }
    } catch (err) {
      console.error("Failed to delete submission:", err);
    } finally {
      setDeletingSubId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-sm text-slate-500">Loading student profile vault...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        {/* Profile Header Banner */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Avatar & User Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="relative group shrink-0">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 bg-emerald-50 shadow-sm">
                  <Image
                    src={user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=Student"}
                    alt={user.name || "Student"}
                    width={96}
                    height={96}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRollAvatar}
                  disabled={updatingAvatar}
                  title="Roll a new random avatar"
                  className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-white border border-slate-300 text-slate-700 hover:text-emerald-700 hover:border-emerald-500 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Dices className={`w-4 h-4 text-[#00875A] ${updatingAvatar ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {user.name || "Student"}
                  </h1>
                  <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-emerald-100/70 text-[#00875A]">
                    {user.role}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-slate-500">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{user.email}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-slate-100 text-slate-700">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{user.department}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-slate-100 text-slate-700">
                    <GraduationCap className="w-3 h-3 text-slate-400" />
                    <span>{user.level}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800">
                    <UserCheck className="w-3 h-3 text-emerald-600" />
                    <span>Faculty of Engineering • FUOYE</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Contribute Material</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column with Tabs (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setActiveTab("vault")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "vault"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Bookmark className="w-4 h-4 text-[#00875A]" />
                <span>Saved Vault</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {savedResources.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "upload"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UploadCloud className="w-4 h-4 text-[#00875A]" />
                <span>Submit Material (PDF / Video)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("submissions")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "submissions"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileCheck2 className="w-4 h-4 text-[#00875A]" />
                <span>My Contributions</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {submissions.length}
                </span>
              </button>
            </div>

            {/* TAB 1: SAVED RESOURCES */}
            {activeTab === "vault" && (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Saved Resources & Reading Vault
                      </h2>
                      <p className="text-xs text-slate-400">
                        {savedResources.length} saved course document{savedResources.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/courses"
                    className="text-xs font-semibold text-[#00875A] hover:underline"
                  >
                    Browse More
                  </Link>
                </div>

                {/* Resource Cards */}
                <div className="mt-6 space-y-3">
                  {savedResources.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No saved resources yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Explore the digital library to bookmark textbooks, past questions, and lecture slides for instant access.
                      </p>
                      <Link
                        href="/courses"
                        className="inline-block mt-4 px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#00875A] hover:bg-[#00734c] transition-all"
                      >
                        Explore Library
                      </Link>
                    </div>
                  ) : (
                    savedResources.map((item) => (
                      <div
                        key={item.id}
                        className="group p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {item.courseCode}
                              </span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                                {item.department}
                              </span>
                            </div>
                            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug">
                              {item.title}
                            </h3>
                            <div className="mt-1 text-[11px] text-slate-400">
                              Size: {item.fileSize} • Type: {item.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <Link
                            href={`/resources/${item.resourceId}`}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                            title="Read or View Resource"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleRemoveSaved(item.resourceId)}
                            disabled={removingId === item.resourceId}
                            className="p-2 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Remove Bookmark"
                          >
                            {removingId === item.resourceId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: UPLOAD PDF PORTAL */}
            {activeTab === "upload" && (
              <PdfUploadPortal
                userDepartment={user.department}
                userLevel={user.level}
                onSuccess={(newSub) => {
                  setSubmissions((prev) => [newSub, ...prev]);
                }}
                onViewSubmissions={() => setActiveTab("submissions")}
              />
            )}

            {/* TAB 3: MY CONTRIBUTIONS */}
            {activeTab === "submissions" && (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        My Uploaded Contributions
                      </h2>
                      <p className="text-xs text-slate-400">
                        Track verification and live status of your contributed study materials
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:underline cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Upload New</span>
                  </button>
                </div>

                {/* Submissions List */}
                <div className="mt-6 space-y-3">
                  {submissions.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <UploadCloud className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No submissions uploaded yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Share your lecture notes, past questions, or formula cheat sheets to earn contributor badges and help fellow engineering peers!
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className="inline-block mt-4 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#00875A] hover:bg-[#00734c] transition-all cursor-pointer"
                      >
                        Submit Your First PDF
                      </button>
                    </div>
                  ) : (
                    submissions.map((sub) => {
                      const isPending = sub.status === "PENDING_REVIEW";
                      const isApproved = sub.status === "APPROVED";
                      const isRejected = sub.status === "REJECTED";
                      const isYouTube = sub.medium === "YOUTUBE" || !!sub.youtubeUrl;

                      return (
                        <div
                          key={sub.id}
                          className="group p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            {/* Media Icon or YouTube Thumbnail */}
                            {isYouTube && sub.thumbnailUrl ? (
                              <div className="w-16 h-11 sm:w-20 sm:h-12 rounded-xl bg-slate-900 overflow-hidden relative shrink-0 shadow-2xs group-hover:scale-102 transition-transform">
                                <Image
                                  src={sub.thumbnailUrl}
                                  alt={sub.title}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                                <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                                  <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
                                    <Play className="w-3 h-3 fill-white ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : isYouTube ? (
                              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                <YoutubeIcon className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                  {sub.courseCode}
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  {sub.department}
                                </span>
                                {isYouTube ? (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50 text-red-700 flex items-center gap-1">
                                    <YoutubeIcon className="w-3 h-3" />
                                    <span>{sub.type || "Video Tutorial"}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                                    {sub.type}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[#0C3B2E] transition-colors leading-snug">
                                {sub.title}
                              </h3>

                              <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                                {isYouTube ? (
                                  <span className="text-red-600 font-medium">YouTube Video Tutorial</span>
                                ) : (
                                  <span>Size: {sub.fileSize}</span>
                                )}
                                <span>•</span>
                                <span className="truncate max-w-[180px]">
                                  {sub.fileName}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {new Date(sub.createdAt).toLocaleDateString()}
                                </span>
                              </div>

                              {sub.description && (
                                <p className="mt-1.5 text-xs text-slate-500 line-clamp-1 italic">
                                  &quot;{sub.description}&quot;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0 flex-wrap">
                            {/* Status Badge */}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                                <Clock className="w-3 h-3" />
                                <span>Awaiting Moderation</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                <FileCheck2 className="w-3 h-3" />
                                <span>Approved & Live</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80">
                                <span>Reviewer Notes</span>
                              </span>
                            )}

                            {/* View / Download Actions */}
                            {isYouTube ? (
                              <a
                                href={sub.youtubeUrl || sub.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                title="Watch Tutorial on YouTube"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Watch</span>
                              </a>
                            ) : sub.fileUrl && sub.fileUrl !== "#" ? (
                              <>
                                <a
                                  href={sub.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                                  title="Preview Document"
                                >
                                  <Eye className="w-4 h-4" />
                                </a>
                                <a
                                  href={sub.fileUrl}
                                  download={sub.fileName}
                                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                                  title="Download PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </>
                            ) : null}

                            {/* Delete submission */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(sub.id)}
                              disabled={deletingSubId === sub.id}
                              className="p-2 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                              title="Withdraw submission"
                            >
                              {deletingSubId === sub.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Academic Details & Stats */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Academic Vault Metrics
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-[#0C3B2E]">
                    {savedResources.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Saved</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-[#00875A]">
                    {submissions.length}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Uploaded</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-slate-800">
                    {user.level}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Level</div>
                </div>
              </div>
            </div>

            {/* Student Upload Quick Action */}
            <div className="bg-gradient-to-br from-[#0C3B2E] to-[#00875A] text-white rounded-3xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <UploadCloud className="w-5 h-5 text-emerald-300" />
                <h4 className="text-sm font-bold tracking-tight">
                  Contribute Engineering Materials
                </h4>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed mb-4">
                Have verified past questions, exam solutions, or lecturer slides? Upload them to help all FUOYE engineering colleagues.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className="w-full py-2.5 px-4 rounded-xl bg-white text-[#0C3B2E] hover:bg-emerald-50 text-xs font-bold transition-all shadow-xs cursor-pointer text-center"
              >
                Open PDF Upload Portal
              </button>
            </div>

            {/* Department Info Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Departmental Information
              </h3>
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 block text-[11px]">Primary Department</span>
                  <span className="font-semibold text-slate-800">{user.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Faculty</span>
                  <span className="font-semibold text-slate-800">
                    Faculty of Engineering (NUESA)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Institution</span>
                  <span className="font-semibold text-slate-800">
                    Federal University Oye-Ekiti (FUOYE)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Academic Session</span>
                  <span className="font-semibold text-slate-800">2025 / 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
