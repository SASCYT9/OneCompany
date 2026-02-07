import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";

const blogDir = path.join(process.cwd(), "public", "blog");

async function ensurePaths() {
  await fs.mkdir(blogDir, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    await ensurePaths();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
    const filename = `${Date.now()}-${safeName}`;
    const filepath = path.join(blogDir, filename);

    await fs.writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      filename,
      url: `/blog/${filename}`,
      type: file.type,
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to upload blog media", error);
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
  }
}

export const runtime = "nodejs";
