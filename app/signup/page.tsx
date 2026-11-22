"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Dices, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getAvatarPresets, getRandomAvatar } from "@/lib/avatars";
import { DEPARTMENTS } from "@/lib/departments";
import {
  extractApiError,
  getSafeRedirectPath,
  validatePassword,
} from "@/lib/api-helpers";
import AuthShell from "@/components/AuthShell";

const LEVELS = ["100L", "200L", "300L", "400L", "500L"];
const DEFAULT_AVATAR = getAvatarPresets()[0];

const INPUT_CLASS =
  "w-full px-3.5 py-2.5 text-sm bg-surface border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-emerald/15 focus:border-brand-emerald text-slate-900 placeholder:text-slate-400 transition-all";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, setUser: setAuthUser } = useAuth();

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

      if (data.user) {
        setAuthUser(data.user);
      }
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
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-brand-emerald animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Verifying session...</p>
      </div>
    );
  }

  return (
    <AuthShell
      title="Create Student Account"
      subtitle="Save engineering materials, sync reading progress, and contribute notes to The NUESA Library."
      footer={
        <p className="text-xs text-slate-600">
          Already have an account?{" "}
          <Link
            href={
              redirectTarget !== "/profile"
                ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
                : "/login"
            }
            className="font-semibold text-brand-emerald hover:underline"
          >
            Sign in
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

      {/* Avatar Picker */}
      <div className="flex items-center justify-between p-3.5 mb-5 rounded-xl bg-surface-subtle border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-slate-200 shrink-0">
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-slate-200 hover:border-brand-emerald text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
        >
          <Dices className="w-3.5 h-3.5 text-brand-emerald" />
          <span>Roll</span>
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="signup-name"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
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
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
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
            placeholder="student@fuoye.edu.ng"
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="signup-department"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Department
            </label>
            <select
              id="signup-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`${INPUT_CLASS} px-3 text-xs sm:text-sm`}
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
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Level
            </label>
            <select
              id="signup-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className={`${INPUT_CLASS} px-3 text-xs sm:text-sm`}
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
            className="block text-xs font-semibold text-slate-700 mb-1.5"
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
            htmlFor="signup-confirm-password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
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
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-brand-emerald animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading signup...</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
