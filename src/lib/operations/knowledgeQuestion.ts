/**
 * A message is a question for the knowledge base when it starts with «?»,
 * «❓» or «/ask». Everything else keeps creating tasks as before.
 */
export function extractOpsKnowledgeQuestion(text: string | null | undefined) {
  const value = String(text ?? "").trim();
  const match = /^(?:\?|❓|\/ask(?:@[A-Za-z0-9_]+)?(?:\s|$))\s*([\s\S]*)$/u.exec(value);
  if (!match) return null;
  const question = match[1].trim().slice(0, 500);
  return question.length >= 3 ? question : null;
}
