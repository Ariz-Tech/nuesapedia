"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Filter,
  Search,
  ExternalLink,
  Loader2,
  Users,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Eye,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";

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
  role: string;
  department: string;
  level: string;
  avatar: string;
}

interface SubmissionItem {
  id: string;
  userId: string;
  title: string;
  courseCode: string;
  department: string;
  level: string;
  semester: string;
  type: string;
  medium: "PDF" | "YOUTUBE";
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  cloudinaryPublicId?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
}

interface UserDirectoryItem {
  id: string;
  name: string;
  email: string;
  department: string;
  level: string;
  avatar: string;
  role: string;
  createdAt: string;
}

const PRESET_REJECTION_REASONS = [
  "Incomplete notes or missing key chapters.",
  "Low scan legibility or blurriness.",
  "Mismatched course syllabus / wrong academic level.",
  "Duplicate material already approved in the vault.",
  "Unrelated content or test file.",
];

export default function ModerationPortalPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Active top portal tab: "queue" | "users"
  const [activePortalTab, setActivePortalTab] = useState<"queue" | "users">("queue");

  // Review Queue state
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_REVIEW" | "APPROVED" | "REJECTED">("PENDING_REVIEW");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [mediumFilter, setMediumFilter] = useState<"ALL" | "PDF" | "YOUTUBE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Reject Dialog state
  const [rejectingItem, setRejectingItem] = useState<SubmissionItem | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // User Management state (Admin only)
  const [usersList, setUsersList] = useState<UserDirectoryItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setLoadingAuth(false));
  }, []);

  // Fetch submissions when authorized
  const fetchSubmissions = async () => {
    try {
      setQueueLoading(true);
      const res = await fetch(`/api/moderation?status=ALL`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to fetch moderation queue:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  // Fetch users when on users tab (Admin only)
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok && data.success) {
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users list:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && (currentUser.role === "MODERATOR" || currentUser.role === "ADMIN")) {
      fetchSubmissions();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activePortalTab === "users" && currentUser?.role === "ADMIN") {
      fetchUsers();
    }
  }, [activePortalTab, currentUser]);

  // Handle Approve Action
  const handleApprove = async (submissionId: string) => {
    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await fetch("/api/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          status: "APPROVED",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to approve resource.");
      }

      setSubmissions((prev) =>
        prev.map((item) => (item.id === submissionId ? data.submission : item))
      );
      setActionFeedback({
        type: "success",
        text: `Resource approved and published to faculty library!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error approving resource.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Reject Confirmation Action
  const handleConfirmReject = async () => {
    if (!rejectingItem) return;
    if (!rejectionReasonText.trim()) {
      setActionFeedback({
        type: "error",
        text: "Please provide a rejection reason so the student understands what to correct.",
      });
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionFeedback(null);
      const res = await fetch("/api/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: rejectingItem.id,
          status: "REJECTED",
          rejectionReason: rejectionReasonText.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reject resource.");
      }

      setSubmissions((prev) =>
        prev.map((item) => (item.id === rejectingItem.id ? data.submission : item))
      );
      setRejectingItem(null);
      setRejectionReasonText("");
      setActionFeedback({
        type: "success",
        text: `Resource marked as rejected. Contributor feedback recorded.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error rejecting resource.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Role Change (Admin only)
  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    try {
      setUpdatingUserId(targetUserId);
      setActionFeedback(null);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUserId,
          role: newRole,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update role.");
      }

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
      );
      setActionFeedback({
        type: "success",
        text: data.message || `Role updated successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating role.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Status filter
      if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
      // Department filter
      if (departmentFilter !== "ALL" && sub.department !== departmentFilter) return false;
      // Medium filter
      if (mediumFilter !== "ALL" && sub.medium !== mediumFilter) return false;
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCourse = sub.courseCode.toLowerCase().includes(q);
        const matchesTitle = sub.title.toLowerCase().includes(q);
        const matchesDept = sub.department.toLowerCase().includes(q);
        if (!matchesCourse && !matchesTitle && !matchesDept) return false;
      }
      return true;
    });
  }, [submissions, statusFilter, departmentFilter, mediumFilter, searchQuery]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return usersList;
    const q = userSearchQuery.toLowerCase();
    return usersList.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersList, userSearchQuery]);

  // Counts for tabs
  const pendingCount = submissions.filter((s) => s.status === "PENDING_REVIEW").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const rejectedCount = submissions.filter((s) => s.status === "REJECTED").length;

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Verifying faculty authorization...</p>
        </div>
        <Footer />
      </div>
    );
  }

  // CASE 1: Not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-6 shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
            Authentication Required
          </h1>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">
            Please sign in with your faculty or staff account to access the Academic Moderation & Quality Portal.
          </p>
          <Link
            href="/login?callbackUrl=/moderation"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-sm font-semibold transition-all shadow-sm"
          >
            <span>Log In to Access</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // CASE 2: Logged in, but NOT Moderator or Admin -> Branded 403 Card
  const isAuthorized = currentUser.role === "MODERATOR" || currentUser.role === "ADMIN";
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center">
          <div className="bg-white border border-rose-200 rounded-3xl p-8 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
            
            <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-6 shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider mb-4">
              <span>HTTP 403 — Forbidden</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
              Access Restricted
            </h1>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              You are currently signed in as <span className="font-semibold text-slate-900">{currentUser.name}</span> with role{" "}
              <span className="font-semibold text-rose-700 uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {currentUser.role}
              </span>. This portal is strictly restricted to Faculty Academic Moderators and System Administrators.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-500 space-y-1.5 mb-8">
              <div className="font-semibold text-slate-700">Need Moderator Access?</div>
              <div>
                Faculty members and department representatives can contact the engineering administrator to request review credentials.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/profile"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs inline-flex items-center justify-center gap-2"
              >
                <span>Return to Student Profile</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-all"
              >
                Go to Homepage
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // CASE 3: Authorized Staff (MODERATOR or ADMIN)
  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Header */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-[#0C3B2E] text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#00875A]">
                  Faculty Quality Assurance
                </span>
                <span
                  className={`text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    isAdmin
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {isAdmin ? "System Administrator" : "Academic Moderator"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Academic Moderation Portal
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Review submitted PDF materials and YouTube video tutorials to guarantee high academic standard across all 5 engineering departments.
              </p>
            </div>

            {/* Quick Status Pill Bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchSubmissions}
                disabled={queueLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer"
                title="Refresh queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${queueLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              <div className="h-6 w-px bg-slate-200" />

              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{pendingCount} Pending</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Feedback Toast */}
          {actionFeedback && (
            <div
              className={`mt-4 p-3.5 rounded-2xl border text-xs sm:text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in ${
                actionFeedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {actionFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Top Portal Navigation Tabs */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActivePortalTab("queue")}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activePortalTab === "queue"
                  ? "bg-[#0C3B2E] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Review Queue</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activePortalTab === "queue"
                    ? "bg-[#00875A] text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {submissions.length}
              </span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActivePortalTab("users")}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activePortalTab === "users"
                    ? "bg-[#0C3B2E] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>User Role Management</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-extrabold uppercase">
                  Admin
                </span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: REVIEW QUEUE */}
        {activePortalTab === "queue" && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Status Sub-Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("PENDING_REVIEW")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      statusFilter === "PENDING_REVIEW"
                        ? "bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>Pending Review</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-200/80 text-[10px]">
                      {pendingCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("APPROVED")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      statusFilter === "APPROVED"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>Approved</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-[10px]">
                      {approvedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("REJECTED")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      statusFilter === "REJECTED"
                        ? "bg-rose-100 text-rose-900 border border-rose-300 font-extrabold shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>Rejected</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-200/80 text-[10px]">
                      {rejectedCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                      statusFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({submissions.length})
                  </button>
                </div>

                {/* Search & Department Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search course or title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A]"
                    />
                  </div>

                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                  >
                    <option value="ALL">All Departments</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <select
                    value={mediumFilter}
                    onChange={(e) => setMediumFilter(e.target.value as "ALL" | "PDF" | "YOUTUBE")}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                  >
                    <option value="ALL">All Media</option>
                    <option value="PDF">PDF Documents</option>
                    <option value="YOUTUBE">YouTube Videos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submissions List */}
            {queueLoading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
                <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">Loading queue submissions...</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Queue is clear</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No submissions match the current status filter. Check other filters or wait for student uploads.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                              sub.medium === "YOUTUBE"
                                ? "bg-red-50 text-red-700 border border-red-200/80"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                            }`}
                          >
                            {sub.medium === "YOUTUBE" ? (
                              <YoutubeIcon className="w-3.5 h-3.5 text-red-600" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>{sub.medium === "YOUTUBE" ? "YouTube Video" : "PDF Document"}</span>
                          </span>

                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-extrabold uppercase">
                            {sub.courseCode}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                            sub.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : sub.status === "REJECTED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {sub.status === "APPROVED"
                            ? "Approved"
                            : sub.status === "REJECTED"
                            ? "Rejected"
                            : "Pending Review"}
                        </span>
                      </div>

                      {/* Title & Metadata */}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug mb-1.5">
                        {sub.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mb-3">
                        <span>{sub.department}</span>
                        <span>•</span>
                        <span>{sub.level}</span>
                        <span>•</span>
                        <span>{sub.semester}</span>
                        <span>•</span>
                        <span>{sub.type}</span>
                      </div>

                      {/* YouTube Thumbnail Preview if applicable */}
                      {sub.medium === "YOUTUBE" && sub.youtubeVideoId && (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mb-3 group">
                          <Image
                            src={`https://img.youtube.com/vi/${sub.youtubeVideoId}/hqdefault.jpg`}
                            alt="YouTube Thumbnail"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          <a
                            href={sub.youtubeUrl || `https://www.youtube.com/watch?v=${sub.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </a>
                        </div>
                      )}

                      {/* Description if present */}
                      {sub.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 line-clamp-2">
                          {sub.description}
                        </p>
                      )}

                      {/* Rejection notice if status is REJECTED */}
                      {sub.status === "REJECTED" && sub.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-3">
                          <div className="font-bold flex items-center gap-1 mb-0.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejection Feedback:</span>
                          </div>
                          <div>{sub.rejectionReason}</div>
                          {sub.reviewedBy && (
                            <div className="text-[10px] text-rose-600/80 mt-1">
                              Reviewed by: {sub.reviewedBy}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reviewer info if approved */}
                      {sub.status === "APPROVED" && sub.reviewedBy && (
                        <div className="text-[10px] text-slate-400 mb-3">
                          Approved by: {sub.reviewedBy}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      {/* Inspect File Link */}
                      <a
                        href={sub.fileUrl || sub.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:text-[#00734c] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Inspect {sub.medium === "PDF" ? "Document" : "Video"}</span>
                      </a>

                      {/* Direct Card Actions (Approve / Reject) */}
                      <div className="flex items-center gap-2">
                        {sub.status !== "REJECTED" && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingItem(sub);
                              setRejectionReasonText("");
                            }}
                            disabled={isProcessingAction}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        {sub.status !== "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => handleApprove(sub.id)}
                            disabled={isProcessingAction}
                            className="px-3 py-1.5 rounded-xl bg-[#00875A] hover:bg-[#00734c] text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USER ROLE MANAGEMENT (ADMIN ONLY) */}
        {activePortalTab === "users" && isAdmin && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Faculty Role & Privilege Administration
                  </h2>
                  <p className="text-xs text-slate-500">
                    Assign and regulate operational roles across all student accounts, faculty moderators, and system administrators.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, email, department..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00875A]/20"
                  />
                </div>
              </div>

              {/* Roles explanation card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6 text-xs">
                <div>
                  <span className="font-bold text-slate-800">STUDENT:</span>
                  <p className="text-slate-500 mt-0.5">
                    Can access study vaults, download verified files, and submit materials into review.
                  </p>
                </div>
                <div>
                  <span className="font-bold text-emerald-800">MODERATOR:</span>
                  <p className="text-slate-500 mt-0.5">
                    Has review queue access to inspect, approve, and reject academic uploads.
                  </p>
                </div>
                <div>
                  <span className="font-bold text-purple-800">ADMIN:</span>
                  <p className="text-slate-500 mt-0.5">
                    Full platform governance, role allocation, and institutional configuration.
                  </p>
                </div>
              </div>

              {/* Users Directory Table */}
              {usersLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-500">Loading user registry...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No registered users match your search query.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredUsers.map((userItem) => (
                    <div
                      key={userItem.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0">
                          <Image
                            src={userItem.avatar}
                            alt={userItem.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                              {userItem.name}
                            </h4>
                            {userItem.id === currentUser.id && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {userItem.email} • {userItem.department} ({userItem.level})
                          </div>
                        </div>
                      </div>

                      {/* Role Dropdown */}
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="text-[11px] font-semibold text-slate-500">
                          Assigned Role:
                        </label>
                        <select
                          value={userItem.role}
                          disabled={updatingUserId === userItem.id}
                          onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            userItem.role === "ADMIN"
                              ? "bg-purple-50 text-purple-900 border-purple-300"
                              : userItem.role === "MODERATOR"
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                              : "bg-slate-50 text-slate-800 border-slate-200"
                          }`}
                        >
                          <option value="STUDENT">STUDENT (General)</option>
                          <option value="MODERATOR">MODERATOR (Faculty Reviewer)</option>
                          <option value="ADMIN">ADMIN (Full Authority)</option>
                        </select>
                        {updatingUserId === userItem.id && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* REJECTION REASON MODAL */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  Moderator Action
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Reject Resource Submission
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Please specify the rejection rationale for{" "}
              <strong className="text-slate-900">{rejectingItem.title}</strong> (
              {rejectingItem.courseCode}). This will be displayed to the student so they can correct and resubmit.
            </p>

            {/* Quick preset selector */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Quick Select Common Reasons:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REJECTION_REASONS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setRejectionReasonText(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-left"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Specific Feedback to Contributor <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="e.g. Scanned pages are upside down and illegible from chapter 3 onward..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isProcessingAction || !rejectionReasonText.trim()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {isProcessingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
