/**
 * One AI stays dark until the owner switches it on: the API answers 404 and
 * the catalog renders no button unless these are set to "1".
 */
export function isOneAiAgentEnabled() {
  return process.env.SHOP_AI_AGENT_ENABLED === "1";
}
