"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { extractApiError, validatePassword } from "@/lib/api-helpers";
import AuthShell from "@/components/AuthShell";

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 text-sm bg-surface border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-emerald/15 focus:border-brand-emerald text-slate-900 placeholder:text-slate-400 transition-all";

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
    <AuthShell
      title={token ? "Choose a New Password" : "Reset Your Password"}
      subtitle={
        token
          ? "Enter a strong new password to secure your NUESA Library account."
          : "Enter your registered email to receive a single-use 15-minute reset link."
      }
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-emerald transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-ui-fade"
        >
          {error}
        </div>
      )}

      {token ? (
        resetComplete ? (
          <div className="text-center py-4 space-y-3 animate-ui-fade">
            <CheckCircle2 className="w-11 h-11 text-brand-emerald mx-auto" />
            <h2 className="text-base font-bold text-brand-forest">
              Password Updated!
            </h2>
            <p className="text-xs text-slate-600">
              All previous sessions have been signed out. Redirecting you to sign in...
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-emerald hover:underline"
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
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
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
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-emerald hover:bg-brand-emerald-hover text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Save New Password</span>
                </>
              )}
            </button>
          </form>
        )
      ) : requestSent ? (
        <div className="space-y-4 text-center py-2 animate-ui-fade">
          <CheckCircle2 className="w-10 h-10 text-brand-emerald mx-auto" />
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
                className="text-xs text-brand-emerald font-semibold break-all hover:underline"
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
            className="text-xs font-semibold text-slate-600 hover:text-brand-forest cursor-pointer"
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
              placeholder="student@fuoye.edu.ng"
              className={INPUT_CLASS}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-emerald hover:bg-brand-emerald-hover text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Reset Link...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Send Reset Link</span>
              </>
            )}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-brand-emerald animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">
            Loading password reset...
          </p>
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
