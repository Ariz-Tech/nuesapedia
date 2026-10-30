import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory mock storage with LRU size limits to prevent V8 heap OOM
const MAX_MOCK_ENTRIES = 10;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB
const mockR2Store = new Map<string, { buffer: ArrayBuffer; contentType: string; size: number }>();

function evictIfNecessary(incomingSize: number) {
  let currentBytes = 0;
  for (const item of mockR2Store.values()) {
    currentBytes += item.size;
  }

  while (mockR2Store.size >= MAX_MOCK_ENTRIES || currentBytes + incomingSize > MAX_TOTAL_BYTES) {
    const oldestKey = mockR2Store.keys().next().value;
    if (!oldestKey) break;
    const removed = mockR2Store.get(oldestKey);
    if (removed) currentBytes -= removed.size;
    mockR2Store.delete(oldestKey);
  }
}

/**
 * PUT: Receives direct file stream from client browser mimicking Cloudflare R2
 */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || `mock_${Date.now()}.pdf`;
    const contentType = request.headers.get("content-type") || "application/pdf";

    const arrayBuffer = await request.arrayBuffer();
    evictIfNecessary(arrayBuffer.byteLength);

    mockR2Store.set(key, { buffer: arrayBuffer, contentType, size: arrayBuffer.byteLength });

    return new NextResponse(null, {
      status: 200,
      headers: {
        "ETag": `"mock-etag-${Date.now()}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Mock R2 upload error:", error);
    return NextResponse.json({ error: "Failed to process mock upload" }, { status: 500 });
  }
}

/**
 * GET: Serves the mock file
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "";
  const isDownload = searchParams.get("download") === "1";
  const rawName = searchParams.get("filename") || "document.pdf";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const stored = mockR2Store.get(key);
  if (!stored) {
    return new NextResponse("File not found in local mock R2 store", { status: 404 });
  }

  return new NextResponse(stored.buffer, {
    headers: {
      "Content-Type": stored.contentType,
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${safeName}"`,
    },
  });
}
