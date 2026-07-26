import { z } from "zod";
import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { calculateStructuredQuote } from "@/lib/quoteKnowledge";

const inputSchema = z.object({
  brandKey: z.string().regex(/^[a-z0-9-]+$/),
  mode: z.enum(["RETAIL", "WHOLESALE"]),
  productPriceMinor: z.number().int().nonnegative(),
  localShippingMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  internationalShippingMinor: z.number().int().nonnegative().optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!matchesBearerSecret(request.headers, resolveSecret("QUOTE_KNOWLEDGE_API_SECRET"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  return Response.json(calculateStructuredQuote(parsed.data), {
    headers: { "cache-control": "private, no-store" },
  });
}
