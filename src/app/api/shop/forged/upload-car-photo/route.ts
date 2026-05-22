/**
 * POST /api/shop/forged/upload-car-photo
 *
 * Accepts a single image file via multipart/form-data, uploads to
 * Vercel Blob, returns the public URL. Used by the configurator's
 * "Upload my photo" preview mode.
 *
 * Falls back to rejecting the request if BLOB_READ_WRITE_TOKEN is not
 * configured — we never want to silently lose a customer's photo.
 */

import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { isBlobStorageConfigured } from "@/lib/runtimeBlobStorage";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(req: NextRequest) {
  if (!isBlobStorageConfigured()) {
    return NextResponse.json({ error: "Blob storage not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 8 MB" }, { status: 413 });
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/heic"
          ? "heic"
          : "jpg";
  const id = randomBytes(8).toString("hex");
  const key = `forged/car-uploads/${id}.${ext}`;

  try {
    const result = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });
    return NextResponse.json({ url: result.url });
  } catch (e) {
    console.error("[forged] Blob upload failed:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
