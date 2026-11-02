"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { DbSubmission } from "@/lib/db/types";
import YoutubeIcon from "@/components/icons/YoutubeIcon";
import { useAuth } from "@/context/AuthContext";
import { useSavedResources } from "@/context/SavedResourcesContext";
import { DEPARTMENTS, isKnownDepartment } from "@/lib/departments";
import { getRandomAvatar } from "@/lib/avatars";
import { formatBytes } from "@/lib/offline-vault";
import { extractApiError, validatePassword } from "@/lib/api-helpers";
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
  UploadCloud,
  FileCheck2,
  Clock,
  Eye,
  PlusCircle,
  Play,
  Check,
  X,
  Settings,
  Lock,
  HardDriveDownload,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const ResourceUploadPortal = dynamic(() => import("@/components/ResourceUploadPortal"), {
  loading: () => (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center">
      <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-2" />
      <p className="text-xs text-slate-400">Loading contribution studio...</p>
    </div>
  ),
});



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

type TabType = "upload" | "submissions" | "settings";
const LEVELS = ["100L", "200L", "300L", "400L", "500L"];

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, loading: authLoading, refresh: refreshAuth, logout: authLogout } = useAuth();
  const { savedCount, offlineCount, offlineTotalBytes } = useSavedResources();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<DbSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [loading, setLoading] = useState(true);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [confirmingSubId, setConfirmingSubId] = useState<string | null>(null);

  // Account settings state
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState<string>(DEPARTMENTS[0]);
  const [editLevel, setEditLevel] = useState<string>("100L");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    if (!authUser) {
      router.push("/login?redirect=/profile");
      return;
    }

    const u: UserProfile = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      department: authUser.department,
      level: authUser.level,
      avatar: authUser.avatar,
      role: authUser.role || "STUDENT",
      createdAt: authUser.createdAt,
    };
    setUser(u);
    setEditName(u.name || "");
    setEditDept(isKnownDepartment(u.department) ? u.department : DEPARTMENTS[0]);
    setEditLevel(LEVELS.includes(u.level) ? u.level : "100L");

    async function loadUploads() {
      try {
        const subRes = await fetch("/api/uploads", { cache: "no-store" });
        if (subRes.ok) {
          const subData = await subRes.json().catch(() => null);
          if (active && subData?.success) {
            setSubmissions(subData.submissions || []);
          }
        }
      } catch (err) {
        console.error("Failed to load user uploads:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUploads();
    return () => {
      active = false;
    };
  }, [authUser, authLoading, router]);

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
        await refreshAuth();
      }
    } catch (err) {
      console.error("Failed to update avatar:", err);
    } finally {
      setUpdatingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!editName.trim()) {
      setProfileMsg({ type: "err", text: "Name cannot be empty." });
      return;
    }

    try {
      setSavingProfile(true);
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          department: editDept,
          level: editLevel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(extractApiError(data, "Failed to update profile."));
      }

      setUser(data.user);
      await refreshAuth();
      setProfileMsg({ type: "ok", text: "Academic profile updated." });
    } catch (err: unknown) {
      setProfileMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!currentPassword) {
      setPasswordMsg({
        type: "err",
        text: "Please enter your current password.",
      });
      return;
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      setPasswordMsg({
        type: "err",
        text: pwCheck.message!,
      });
      return;
    }

    try {
      setSavingPassword(true);
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(extractApiError(data, "Could not update password."));
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg({ type: "ok", text: "Password updated successfully." });
    } catch (err: unknown) {
      setPasswordMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Password update failed.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
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
      setConfirmingSubId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await authLogout();
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
          <p className="text-sm text-slate-500">Loading student account...</p>
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
                    <span>Faculty of Engineering &bull; FUOYE</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
              <Link
                href="/saved"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs"
              >
                <Bookmark className="w-4 h-4 text-[#00875A]" />
                <span>Saved &amp; Offline ({savedCount + offlineCount})</span>
              </Link>

              {(user.role === "MODERATOR" || user.role === "ADMIN") && (
                <Link
                  href="/moderation"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0C3B2E] hover:bg-[#0A251D] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
                >
                  <span>Moderation Portal</span>
                </Link>
              )}

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
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-fit">
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
                <span>Contribute Material</span>
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

              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === "settings"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Settings className="w-4 h-4 text-[#00875A]" />
                <span>Account &amp; Security</span>
              </button>
            </div>

            {/* TAB 1: UPLOAD PORTAL */}
            {activeTab === "upload" && (
              <ResourceUploadPortal
                userDepartment={user.department}
                userLevel={user.level}
                onSuccess={(newSub) => {
                  setSubmissions((prev) => [newSub, ...prev]);
                }}
                onViewSubmissions={() => setActiveTab("submissions")}
              />
            )}

            {/* TAB 2: MY CONTRIBUTIONS */}
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
                        Track verification status and moderator feedback on your uploaded materials
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

                <div className="mt-6 space-y-3">
                  {submissions.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <UploadCloud className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-700">No submissions uploaded yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Share lecture handouts, past questions, or YouTube tutorials to help fellow FUOYE engineering students.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className="inline-block mt-4 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#00875A] hover:bg-[#00734c] transition-all cursor-pointer"
                      >
                        Submit Your First Material
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
                          className="group p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all flex flex-col gap-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              {isYouTube && sub.thumbnailUrl ? (
                                <div className="w-16 h-11 sm:w-20 sm:h-12 rounded-xl bg-slate-900 overflow-hidden relative shrink-0 shadow-2xs">
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
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00875A] flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}

                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#0C3B2E] text-white font-mono">
                                    {sub.courseCode}
                                  </span>
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                    {sub.department}
                                  </span>
                                  {sub.sessionYear && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70">
                                      {sub.sessionYear}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                                    {sub.type}
                                  </span>
                                </div>

                                <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                                  {sub.title}
                                </h3>

                                <div className="mt-1 flex items-center gap-2.5 text-[11px] text-slate-400 flex-wrap">
                                  <span>{isYouTube ? "YouTube Video" : sub.fileSize}</span>
                                  <span>&bull;</span>
                                  <span>{sub.semester}</span>
                                  <span>&bull;</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {new Date(sub.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending Review</span>
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                  <FileCheck2 className="w-3 h-3" />
                                  <span>Live in Library</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200/80">
                                  <span>Needs Revision</span>
                                </span>
                              )}

                              {isApproved && (
                                <Link
                                  href={`/resources?open=${encodeURIComponent(sub.id)}`}
                                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-[#00875A] hover:border-emerald-300 transition-colors"
                                  title="Open in Library"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                              )}

                              {!isYouTube && sub.fileUrl && sub.fileUrl !== "#" && (
                                <a
                                  href={`/api/resources/${encodeURIComponent(sub.id)}/download`}
                                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                                  title="Download File"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              )}

                              {!isApproved &&
                                (confirmingSubId === sub.id ? (
                                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-rose-50 border border-rose-200">
                                    <span className="text-[11px] font-semibold text-rose-700 px-1">Withdraw?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubmission(sub.id)}
                                      disabled={deletingSubId === sub.id}
                                      className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      {deletingSubId === sub.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="w-3 h-3" />
                                          <span>Yes</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingSubId(null)}
                                      className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingSubId(sub.id)}
                                    className="p-2 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                                    title="Withdraw pending or rejected submission"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ))}
                            </div>
                          </div>

                          {isRejected && sub.rejectionReason && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                              <span className="font-bold">Moderator Note: </span>
                              {sub.rejectionReason}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ACCOUNT & SECURITY */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                {/* Academic Profile Update */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#00875A] flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Academic Profile Details
                      </h2>
                      <p className="text-xs text-slate-400">
                        Keep your department and academic level up to date each session
                      </p>
                    </div>
                  </div>

                  {profileMsg && (
                    <div
                      className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        profileMsg.type === "ok"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50 border-rose-200 text-rose-700"
                      }`}
                    >
                      {profileMsg.type === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{profileMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Department
                        </label>
                        <select
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                        >
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Academic Level
                        </label>
                        <select
                          value={editLevel}
                          onChange={(e) => setEditLevel(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                        >
                          {LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {lvl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-2"
                    >
                      {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Save Profile Changes</span>
                    </button>
                  </form>
                </div>

                {/* Change Password */}
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0C3B2E] flex items-center justify-center">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Change Password
                      </h2>
                      <p className="text-xs text-slate-400">
                        Update your NUESA Library login password
                      </p>
                    </div>
                  </div>

                  {passwordMsg && (
                    <div
                      className={`mb-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        passwordMsg.type === "ok"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-rose-50 border-rose-200 text-rose-700"
                      }`}
                    >
                      {passwordMsg.type === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passwordMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Current Password
                        </label>
                        <input
                          type="password"
                          required
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          New Password (min. 8 chars, letter + number)
                        </label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="px-5 py-2.5 rounded-xl bg-[#0C3B2E] hover:bg-[#0A251D] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-2"
                    >
                      {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Update Password</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Vault Summary & Department Details */}
          <div className="space-y-6">
            {/* Live Saved & Offline Vault Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                Study Shelf &amp; Offline Vault
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-[#0C3B2E]">{savedCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Bookmarked</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-[#00875A]">{offlineCount}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Offline PDFs</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center">
                  <div className="text-xl font-extrabold text-slate-800">{submissions.length}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Contributed</div>
                </div>
              </div>

              {offlineCount > 0 && (
                <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-[11px] font-medium text-emerald-900 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <HardDriveDownload className="w-3.5 h-3.5 text-[#00875A]" />
                    <span>Offline Storage Used</span>
                  </span>
                  <span className="font-bold">{formatBytes(offlineTotalBytes)}</span>
                </div>
              )}

              <Link
                href="/saved"
                className="w-full py-2.5 px-4 rounded-xl bg-[#0C3B2E] hover:bg-[#0A251D] text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Open Saved &amp; Offline Materials</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
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
