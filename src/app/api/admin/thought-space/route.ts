import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE);
    const thoughtPath = path.join(process.cwd(), ".agents", "THOUGHT_SPACE.md");

    if (!fs.existsSync(thoughtPath)) {
      return NextResponse.json({ content: "Thought space is currently empty." });
    }

    const content = fs.readFileSync(thoughtPath, "utf8");
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to read thought space" }, { status: 500 });
  }
}
