import { matchesBearerSecret, resolveSecret } from "@/lib/requestSecrets";
import { getQuoteBrandKnowledge } from "@/lib/quoteKnowledge";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  if (!matchesBearerSecret(request.headers, resolveSecret("QUOTE_KNOWLEDGE_API_SECRET"))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { key } = await context.params;
  const knowledge = await getQuoteBrandKnowledge(key);
  if (!knowledge) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(knowledge, {
    headers: { "cache-control": "private, no-store" },
  });
}
