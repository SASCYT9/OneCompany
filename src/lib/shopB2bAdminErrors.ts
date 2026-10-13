import { NextResponse } from "next/server";

/** Error codes thrown by `shopB2bAdmin.server.ts` and admin auth → HTTP answers. */
const KNOWN_ERRORS: Readonly<Record<string, readonly [number, string]>> = {
  UNAUTHORIZED: [401, "Unauthorized"],
  FORBIDDEN: [403, "Forbidden"],
  BRAND_REQUIRED: [400, "Оберіть бренд"],
  DISCOUNT_OUT_OF_RANGE: [400, "Знижка має бути від 0 до 100%"],
  GROUP_NAME_REQUIRED: [400, "Вкажіть назву групи"],
  GROUP_NAME_TOO_LONG: [400, "Назва групи — до 60 символів"],
  GROUP_NAME_TAKEN: [409, "Група з такою назвою вже є"],
  GROUP_NOT_FOUND: [404, "Групу не знайдено — оновіть сторінку"],
  CUSTOMER_NOT_FOUND: [404, "Клієнта не знайдено"],
};

export function shopB2bAdminErrorResponse(
  error: unknown,
  logLabel: string,
  fallback = "Не вдалося зберегти"
) {
  const known = KNOWN_ERRORS[(error as Error)?.message ?? ""];
  if (known) return NextResponse.json({ error: known[1] }, { status: known[0] });
  console.error(logLabel, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
