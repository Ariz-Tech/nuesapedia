"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Dices, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getAvatarPresets, getRandomAvatar } from "@/lib/avatars";
import { DEPARTMENTS } from "@/lib/departments";
import {
  extractApiError,
  getSafeRedirectPath,
  validatePassword,
} from "@/lib/api-helpers";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"];
const DEFAULT_AVATAR = getAvatarPresets()[0];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refresh: refreshAuth } = useAuth();

  const redirectTarget = getSafeRedirectPath(
    searchParams.get("callbackUrl") || searchParams.get("redirect"),
    "/profile"
  );

  // Deterministic initial avatar prevents SSR hydration mismatches
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [level, setLevel] = useState("100L");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTarget);
    }
  }, [authLoading, user, redirectTarget, router]);

  const handleRollAvatar = () => {
    setAvatar(getRandomAvatar());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      setError(pwCheck.message!);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          department,
          level,
          password,
          avatar,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(extractApiError(data, "Signup failed. Please try again."));
      }

      await refreshAuth();
      router.push(redirectTarget);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred during signup.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
        <p className="text-xs text-slate-400">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 group mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#0C3B2E] flex items-center justify-center text-white shadow-sm group-hover:bg-[#00875A] transition-colors">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            The NUESA Library
          </span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Student Account
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Save engineering materials, sync reading progress, and contribute notes
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] rounded-2xl border border-slate-100 sm:px-8">
          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
            >
              {error}
            </div>
          )}

          {/* Avatar Picker */}
          <div className="flex items-center justify-between p-3.5 mb-5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-slate-200 shrink-0">
                <Image
                  src={avatar}
                  alt="Selected student avatar"
                  width={48}
                  height={48}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Student Avatar
                </p>
                <p className="text-[11px] text-slate-500">
                  Roll to customize your profile badge
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRollAvatar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#00875A] text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-[#00875A]" />
              Roll
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Amina Okafor"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@uniuyo.edu.ng"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="signup-department"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Department
                </label>
                <select
                  id="signup-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="signup-level"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Level
                </label>
                <select
                  id="signup-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A]/20 focus:border-[#00875A] text-slate-900"
                >
                  {LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                htmlFor="signup-confirm-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
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
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                href={
                  redirectTarget !== "/profile"
                    ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
                    : "/login"
                }
                className="font-semibold text-[#00875A] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-[#00875A] animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading signup...</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
