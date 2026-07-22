import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    // Clear the entire shop cache to ensure all database values immediately reflect in RSC layer
    revalidatePath("/", "layout");

    return NextResponse.json({
      success: true,
      message: "Next.js App Router cache forcefully cleared.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to revalidate cache" }, { status: 500 });
  }
}
