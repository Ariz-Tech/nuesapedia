"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { extractApiError, getSafeRedirectPath } from "@/lib/api-helpers";
import AuthShell from "@/components/AuthShell";

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 text-sm bg-surface border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-emerald/15 focus:border-brand-emerald text-slate-900 placeholder:text-slate-400 transition-all";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, setUser: setAuthUser } = useAuth();

  const redirectTarget = getSafeRedirectPath(
    searchParams.get("callbackUrl") || searchParams.get("redirect"),
    "/profile"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTarget);
    }
  }, [authLoading, user, redirectTarget, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          extractApiError(data, "Login failed. Check your credentials.")
        );
      }

      if (data.user) {
        setAuthUser(data.user);
      }
      router.push(redirectTarget);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred during login.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-brand-emerald animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Verifying session...</p>
      </div>
    );
  }

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to sync bookmarks, contribute study materials, and manage your library profile."
      footer={
        <p className="text-xs text-slate-600">
          Don&apos;t have an account yet?{" "}
          <Link
            href={
              redirectTarget !== "/profile"
                ? `/signup?redirect=${encodeURIComponent(redirectTarget)}`
                : "/signup"
            }
            className="font-semibold text-brand-emerald hover:underline"
          >
            Create free account
          </Link>
        </p>
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

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            University or Personal Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@fuoye.edu.ng"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand-emerald hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-emerald hover:bg-brand-emerald-hover text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-brand-emerald animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading sign in...</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
