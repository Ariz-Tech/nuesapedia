import { NextResponse } from "next/server";

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiFailurePayload {
  success: false;
  error: ApiErrorDetail;
}

export function apiError(
  code: string,
  message: string,
  status: number = 400,
  headers?: HeadersInit
): NextResponse<ApiFailurePayload> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status, headers }
  );
}

export function apiSuccess<T extends Record<string, unknown>>(
  payload: T,
  status: number = 200,
  headers?: HeadersInit
): NextResponse<T & { success: true }> {
  return NextResponse.json(
    {
      success: true as const,
      ...payload,
    },
    { status, headers }
  );
}

/**
 * Safely extracts a human-readable error string from any API response shape
 * (both `{ error: { code, message } }` and legacy `{ error: "message" }`),
 * preventing `[object Object]` from ever rendering in UI banners.
 */
export function extractApiError(
  data: unknown,
  fallback: string = "Something went wrong. Please try again."
): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const err = record.error;

  if (typeof err === "string" && err.trim().length > 0) {
    return err.trim();
  }
  if (err && typeof err === "object") {
    const errObj = err as Record<string, unknown>;
    if (typeof errObj.message === "string" && errObj.message.trim().length > 0) {
      return errObj.message.trim();
    }
  }
  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message.trim();
  }
  return fallback;
}

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Canonical password policy across signup, password change, and password reset.
 */
export function validatePassword(password: unknown): PasswordValidationResult {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: "Password is required." };
  }
  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long.",
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      message: "Password cannot exceed 128 characters.",
    };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one letter and one number.",
    };
  }
  return { valid: true };
}

/**
 * Validates post-login redirect targets to prevent open-redirect vulnerabilities.
 */
export function getSafeRedirectPath(
  raw: string | null | undefined,
  fallback: string = "/profile"
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    if (parsed.pathname === "/login" || parsed.pathname === "/signup") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) {
    return "PDF Document";
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function parseSizeToBytes(sizeStr: string | null | undefined): number | null {
  if (!sizeStr || typeof sizeStr !== "string") return null;
  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (!Number.isFinite(val) || val < 0) return null;
  const unit = match[2].toUpperCase();
  if (unit === "B") return Math.round(val);
  if (unit === "KB") return Math.round(val * 1024);
  if (unit === "MB") return Math.round(val * 1024 * 1024);
  if (unit === "GB") return Math.round(val * 1024 * 1024 * 1024);
  return null;
}

export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export const extractYoutubeId = (url?: string | null): string | undefined =>
  extractYouTubeId(url) ?? undefined;

