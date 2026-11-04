export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".odt",
  ".odp",
  ".rtf",
  ".txt",
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "application/octet-stream",
] as const;

export function isAllowedDocumentFilename(fileName: string): boolean {
  if (!fileName || typeof fileName !== "string") return false;
  const lower = fileName.trim().toLowerCase();
  return ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  if (!mimeType || typeof mimeType !== "string") return false;
  const lower = mimeType.trim().toLowerCase().split(";")[0].trim();
  return (
    ALLOWED_DOCUMENT_MIME_TYPES.includes(lower as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]) ||
    lower.startsWith("text/") ||
    lower.includes("word") ||
    lower.includes("presentation") ||
    lower.includes("spreadsheet") ||
    lower.includes("document") ||
    lower === "application/octet-stream"
  );
}

export function getMimeTypeForFilename(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "odt":
      return "application/vnd.oasis.opendocument.text";
    case "odp":
      return "application/vnd.oasis.opendocument.presentation";
    case "rtf":
      return "application/rtf";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export function getFileFormatDisplay(fileName?: string): {
  label: string;
  extension: string;
  isPdf: boolean;
  isPresentation: boolean;
  isWord: boolean;
  isSpreadsheet: boolean;
  isText: boolean;
} {
  const ext = (fileName || "").toLowerCase().split(".").pop() || "doc";
  const isPdf = ext === "pdf";
  const isPresentation = ["ppt", "pptx", "odp"].includes(ext);
  const isWord = ["doc", "docx", "odt", "rtf"].includes(ext);
  const isSpreadsheet = ["xls", "xlsx"].includes(ext);
  const isText = ext === "txt";

  let label = "Document";
  if (isPdf) label = "PDF Document";
  else if (isPresentation) label = "Slides / Presentation";
  else if (isWord) label = "Word Document";
  else if (isSpreadsheet) label = "Spreadsheet";
  else if (isText) label = "Text File";

  return {
    label,
    extension: ext.toUpperCase(),
    isPdf,
    isPresentation,
    isWord,
    isSpreadsheet,
    isText,
  };
}

/**
 * Validates magic headers / signatures for supported academic documents.
 */
export function verifyDocumentBytes(
  bytes: Uint8Array,
  fileName?: string
): { valid: boolean; error?: string } {
  if (!bytes || bytes.length === 0) {
    return { valid: false, error: "Uploaded file is empty." };
  }

  const ext = (fileName || "").toLowerCase().split(".").pop();

  // 1. PDF: %PDF-
  if (ext === "pdf" || (!ext && bytes.length >= 5 && Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-")) {
    if (bytes.length < 5 || Buffer.from(bytes.slice(0, 5)).toString("ascii") !== "%PDF-") {
      return { valid: false, error: "Invalid file signature: not a valid PDF document." };
    }
    return { valid: true };
  }

  // 2. OpenXML formats (DOCX, PPTX, XLSX, ODT, ODP) are standard ZIP archives: PK\x03\x04
  if (["docx", "pptx", "xlsx", "odt", "odp"].includes(ext || "")) {
    if (bytes.length < 4) {
      return { valid: false, error: `Invalid ${ext?.toUpperCase()} file: file is too small.` };
    }
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (!isZip) {
      return { valid: false, error: `Invalid ${ext?.toUpperCase()} file signature.` };
    }
    return { valid: true };
  }

  // 3. Legacy Microsoft Compound Document File Format (DOC, PPT, XLS): 0xD0 0xCF 0x11 0xE0
  if (["doc", "ppt", "xls"].includes(ext || "")) {
    if (bytes.length < 4) {
      return { valid: false, error: `Invalid ${ext?.toUpperCase()} file: file is too small.` };
    }
    const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    // Allow if valid OLE or valid text
    if (!isOle && bytes.length > 512) {
      return { valid: false, error: `Invalid legacy ${ext?.toUpperCase()} file format.` };
    }
    return { valid: true };
  }

  // 4. RTF: {\rtf
  if (ext === "rtf") {
    if (bytes.length < 5 || Buffer.from(bytes.slice(0, 5)).toString("ascii") !== "{\\rtf") {
      return { valid: false, error: "Invalid RTF document signature." };
    }
    return { valid: true };
  }

  // 5. TXT: plain text
  if (ext === "txt") {
    return { valid: true };
  }

  // Fallback for recognized extensions
  if (isAllowedDocumentFilename(fileName || "")) {
    return { valid: true };
  }

  return { valid: false, error: "Unsupported file type." };
}

