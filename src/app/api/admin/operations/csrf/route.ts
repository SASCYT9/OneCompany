import { NextResponse } from "next/server";
import { assertCurrentAdminAccess } from "@/lib/admin/adminAccess";
import { opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { createOpsCsrfToken, OPS_CSRF_COOKIE } from "@/lib/operations/request";

export async function GET() {
  try {
    assertOperationsEnabled();
    // A CSRF token grants no capability by itself; every mutation still checks
    // its own current-DB permission. This keeps the endpoint usable by
    // knowledge-only editors and inbox-only reviewers.
    await assertCurrentAdminAccess();
    const token = createOpsCsrfToken();
    const response = NextResponse.json({ token });
    response.cookies.set(OPS_CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin/operations",
      maxAge: 60 * 60 * 12,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return opsErrorResponse(error);
  }
}
