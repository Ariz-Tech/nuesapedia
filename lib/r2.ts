import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function cleanCredential(val: string | undefined): string {
  const trimmed = (val || "").trim();
  if (!trimmed || trimmed.toLowerCase().startsWith("your_")) {
    return "";
  }
  return trimmed;
}

const R2_ACCOUNT_ID = cleanCredential(process.env.R2_ACCOUNT_ID);
const R2_ACCESS_KEY_ID = cleanCredential(process.env.R2_ACCESS_KEY_ID);
const R2_SECRET_ACCESS_KEY = cleanCredential(process.env.R2_SECRET_ACCESS_KEY);
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "nuesapedia-resources";
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export const MAX_PDF_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

export const isR2Configured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
);

let s3Client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Generates a short-lived pre-signed PUT URL for direct browser upload to Cloudflare R2.
 */
export async function generateSignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: params.key,
    ContentType: params.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds || 600,
  });
}

/**
 * Generates a fresh short-lived signed URL on demand for viewing (`inline`) or downloading (`attachment`).
 * NEVER store the returned signed URL in PostgreSQL.
 */
export async function getSignedDownloadUrl(params: {
  key: string;
  fileName?: string;
  disposition?: "inline" | "attachment";
  expiresInSeconds?: number;
}): Promise<string | null> {
  const disposition = params.disposition || "attachment";

  if (disposition === "inline" && R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${params.key}`;
  }

  const client = getR2Client();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      return `/api/uploads/mock-r2?key=${encodeURIComponent(params.key)}`;
    }
    return null;
  }

  const safeName = (params.fileName || "nuesapedia-resource.pdf").replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: params.key,
    ResponseContentType: "application/pdf",
    ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds || 900, // 15 minutes
  });
}

export interface VerifiedR2Object {
  valid: boolean;
  sizeBytes?: number;
  error?: string;
}

/**
 * Verifies server-side that an uploaded R2 object actually exists, respects the 30MB cap,
 * and starts with the `%PDF-` magic header (`0x25 0x50 0x44 0x46 0x2D`).
 */
export async function verifyR2PdfObject(
  key: string,
  maxBytes: number = MAX_PDF_UPLOAD_BYTES
): Promise<VerifiedR2Object> {
  const client = getR2Client();
  if (!client) {
    return { valid: false, error: "Cloudflare R2 is not configured." };
  }

  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    const sizeBytes = Number(head.ContentLength ?? 0);
    if (sizeBytes <= 0) {
      return { valid: false, error: "Uploaded file is empty." };
    }
    if (sizeBytes > maxBytes) {
      return {
        valid: false,
        sizeBytes,
        error: `Uploaded file exceeds maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))}MB.`,
      };
    }

    const rangeRes = await client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Range: "bytes=0-4",
      })
    );

    const bytes = await rangeRes.Body?.transformToByteArray();
    if (!bytes || bytes.length < 5) {
      return { valid: false, sizeBytes, error: "Uploaded file is too small to be a valid PDF." };
    }

    const magic = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    if (magic !== "%PDF-") {
      return {
        valid: false,
        sizeBytes,
        error: "Invalid file signature: uploaded file is not a valid PDF document.",
      };
    }

    return { valid: true, sizeBytes };
  } catch (err) {
    const code = (err as { name?: string })?.name;
    if (code === "NotFound" || code === "NoSuchKey") {
      return { valid: false, error: "Upload not found in storage. Please try uploading again." };
    }
    console.error("verifyR2PdfObject error:", err);
    return { valid: false, error: "Could not verify uploaded file in storage." };
  }
}

export async function deleteR2Object(key: string): Promise<boolean> {
  const client = getR2Client();
  if (!client) return false;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function checkR2Health(): Promise<{
  configured: boolean;
  reachable: boolean;
  bucket: string;
  mode: "cloudflare_r2" | "local_dev_mock" | "unconfigured";
}> {
  if (!isR2Configured) {
    return {
      configured: false,
      reachable: process.env.NODE_ENV !== "production",
      bucket: R2_BUCKET_NAME,
      mode: process.env.NODE_ENV !== "production" ? "local_dev_mock" : "unconfigured",
    };
  }

  const client = getR2Client()!;
  try {
    await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    return {
      configured: true,
      reachable: true,
      bucket: R2_BUCKET_NAME,
      mode: "cloudflare_r2",
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      bucket: R2_BUCKET_NAME,
      mode: "cloudflare_r2",
    };
  }
}
