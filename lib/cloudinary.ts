import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Check if Cloudinary is configured with valid credentials
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET) ||
      process.env.CLOUDINARY_URL
  );
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  bytes: number;
  format?: string;
}

/**
 * Upload a document buffer (PDF) directly to Cloudinary
 */
export async function uploadDocumentToCloudinary(
  buffer: Buffer,
  originalFilename: string,
  folder: string = "nuesapedia/documents"
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables."
    );
  }

  // Clean filename without extension for public_id, keeping .pdf suffix
  const ext = originalFilename.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
  const cleanBaseName = originalFilename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniquePublicId = `${cleanBaseName}_${Date.now()}${ext}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: uniquePublicId,
        resource_type: "raw", // Use raw for PDF files to preserve exact headers and extensions
        use_filename: true,
        unique_filename: true,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          reject(error || new Error("Failed to upload document to Cloudinary"));
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
            bytes: result.bytes,
            format: result.format,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a document from Cloudinary by public ID
 */
export async function deleteDocumentFromCloudinary(
  publicId: string,
  resourceType: "raw" | "image" | "video" = "raw"
): Promise<void> {
  if (!isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary deletion error:", err);
  }
}

export default cloudinary;
