import assert from "node:assert/strict";
import test from "node:test";
import robots from "../../../src/app/robots";

test("robots blocks model-training crawlers and keeps search and answer agents", () => {
  const { rules } = robots();
  const list = Array.isArray(rules) ? rules : [rules];
  const blocked = list.find((rule) => rule.disallow === "/");
  const agents = new Set([blocked?.userAgent].flat());
  for (const agent of ["GPTBot", "CCBot", "ClaudeBot", "Bytespider", "Amazonbot", "Google-Extended"])
    assert.equal(agents.has(agent), true, agent);
  for (const agent of ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "*"])
    assert.equal(agents.has(agent), false, agent);
  const general = list.find((rule) => rule.userAgent === "*");
  assert.equal(general?.allow, "/");
});
