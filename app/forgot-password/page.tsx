"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { extractApiError, validatePassword } from "@/lib/api-helpers";

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  // Request-link state
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  // Consume-token state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setDevResetUrl(null);

    if (!email.trim()) {
      setError("Please enter your account email address.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          extractApiError(data, "Unable to send password reset email.")
        );
      }

      setRequestSent(true);
      setInfoMessage(data.message);
      if (typeof data.devResetUrl === "string") {
        setDevResetUrl(data.devResetUrl);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to request password reset."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      setError(pwCheck.message!);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          extractApiError(data, "Invalid or expired password reset link.")
        );
      }

      setResetComplete(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#0C3B2E] flex items-center justify-center text-white shadow-sm group-hover:bg-[#00875A] transition-colors">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            The NUESA Library
          </span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {token ? "Choose a New Password" : "Reset Your Password"}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-500">
          {token
            ? "Enter a strong new password to secure your NUESApedia account."
            : "Enter your registered email to receive a single-use 15-minute reset link."}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] rounded-2xl border border-slate-100 sm:px-8">
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
            >
              {error}
            </div>
          )}

          {token ? (
            resetComplete ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="w-11 h-11 text-[#00875A] mx-auto" />
                <h2 className="text-base font-bold text-slate-900">
                  Password Updated!
                </h2>
                <p className="text-xs text-slate-500">
                  All previous sessions have been signed out. Redirecting you to sign in...
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00875A] hover:underline"
                >
                  Go to Sign In
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleConfirmReset}>
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters (letters + numbers)"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00875A] hover:bg-[#00734D] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Save New Password
                    </>
                  )}
                </button>
              </form>
            )
          ) : requestSent ? (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2 className="w-10 h-10 text-[#00875A] mx-auto" />
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {infoMessage}
              </p>
              {devResetUrl && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-1">
                    Local Dev Mode Reset Link
                  </p>
                  <a
                    href={devResetUrl}
                    className="text-xs text-[#00875A] font-semibold break-all hover:underline"
                  >
                    {devResetUrl}
                  </a>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setRequestSent(false);
                  setDevResetUrl(null);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Try another email
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleRequestLink}>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Account Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@uniuyo.edu.ng"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00875A] hover:bg-[#00734D] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#00875A]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading password reset...</p>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
