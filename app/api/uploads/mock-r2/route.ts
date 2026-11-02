import { getSession } from "@/lib/auth";
import { isR2Configured, MAX_PDF_UPLOAD_BYTES } from "@/lib/r2";
import { apiError, apiSuccess, isSafeStorageKey } from "@/lib/api-helpers";
import { mockR2Store } from "@/lib/mock-r2-store";

/**
 * Local development-only R2 mock storage.
 * Strictly disabled in production or whenever real Cloudflare R2 is configured.
 * Enforces authentication, PDF magic-byte verification, size limits, and sandboxed headers.
 */

function isMockAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && !isR2Configured;
}

export async function PUT(req: Request) {
  if (!isMockAllowed()) {
    return apiError("NOT_FOUND", "Endpoint not available.", 404);
  }

  const session = await getSession();
  if (!session) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!isSafeStorageKey(key)) {
    return apiError("INVALID_KEY", "Invalid storage key.", 400);
  }

  const arrayBuffer = await req.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PDF_UPLOAD_BYTES) {
    return apiError(
      "FILE_SIZE_INVALID",
      "File must be non-empty and at most 30MB.",
      413
    );
  }

  if (
    bytes.byteLength < 5 ||
    Buffer.from(bytes.slice(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    return apiError(
      "INVALID_FILE_TYPE",
      "Only valid PDF documents (%PDF-) are accepted.",
      415
    );
  }

  mockR2Store.set(key, {
    bytes,
    sizeBytes: bytes.byteLength,
    uploadedBy: session.userId,
    createdAt: Date.now(),
  });

  return apiSuccess({ key, sizeBytes: bytes.byteLength });
}

export async function GET(req: Request) {
  if (!isMockAllowed()) {
    return apiError("NOT_FOUND", "Endpoint not available.", 404);
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!isSafeStorageKey(key)) {
    return apiError("INVALID_KEY", "Invalid storage key.", 400);
  }

  const stored = mockR2Store.get(key);
  if (!stored) {
    return apiError("NOT_FOUND", "Mock storage object not found.", 404);
  }

  const safeBody = new Uint8Array(stored.bytes);
  return new Response(safeBody, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(stored.sizeBytes),
      "Content-Disposition": 'inline; filename="document.pdf"',
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
