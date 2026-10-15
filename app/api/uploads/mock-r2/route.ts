import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// In-memory mock storage for local development testing
const mockR2Store = new Map<string, { buffer: ArrayBuffer; contentType: string }>();

/**
 * PUT: Receives direct file stream from client browser mimicking Cloudflare R2
 */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || `mock_${Date.now()}.pdf`;
    const contentType = request.headers.get("content-type") || "application/pdf";

    const arrayBuffer = await request.arrayBuffer();
    mockR2Store.set(key, { buffer: arrayBuffer, contentType });

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

  const stored = mockR2Store.get(key);
  if (!stored) {
    return new NextResponse("File not found in local mock R2 store", { status: 404 });
  }

  return new NextResponse(stored.buffer, {
    headers: {
      "Content-Type": stored.contentType,
      "Content-Disposition": 'inline; filename="document.pdf"',
    },
  });
}
