import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.R2_KEY || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "nuesapedia-storage";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

/**
 * Check if Cloudflare R2 credentials are configured
 */
export function isR2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

let r2ClientInstance: S3Client | null = null;

/**
 * Get configured S3 client connected to Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2ClientInstance;
}

/**
 * Generate a pre-signed PUT upload URL for direct-to-R2 upload from client browser
 * As documented in docs/flow.md and docs/API_SPEC.md (Section 15.1)
 */
export async function generateSignedUploadUrl(
  key: string,
  contentType: string = "application/pdf",
  expiresInSeconds: number = 900 // 15 minutes
): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in your environment variables."
    );
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    key,
    expiresIn: expiresInSeconds,
  };
}

/**
 * Generate a pre-signed GET download URL or return public URL
 */
export async function getFileUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  // If custom public domain or R2 dev subdomain is configured, use it directly
  if (R2_PUBLIC_URL) {
    const cleanBase = R2_PUBLIC_URL.replace(/\/$/, "");
    const cleanKey = key.replace(/^\//, "");
    return `${cleanBase}/${cleanKey}`;
  }

  // Otherwise generate pre-signed read URL
  if (isR2Configured()) {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  return "";
}

/**
 * Delete an object from Cloudflare R2 storage
 */
export async function deleteR2Object(key: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
  } catch (err) {
    console.error("Cloudflare R2 deletion error:", err);
  }
}
