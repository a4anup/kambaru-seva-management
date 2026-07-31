import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const extension = path.extname(name).toLowerCase();
  if (path.basename(name) !== name || !CONTENT_TYPES[extension]) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const image = await readFile(path.join(process.cwd(), "assets", "images", name));
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": CONTENT_TYPES[extension],
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
