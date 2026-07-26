import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { listQuoteWarehouses } from "@/lib/quoteKnowledge";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!matchesBearerSecret(request.headers, resolveSecret("QUOTE_KNOWLEDGE_API_SECRET"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(
    { warehouses: await listQuoteWarehouses() },
    { headers: { "cache-control": "private, no-store" } }
  );
}
