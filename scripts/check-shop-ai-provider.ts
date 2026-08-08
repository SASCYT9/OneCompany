import { createShopAiPlan } from "../src/lib/shopAiAssistantProvider";

async function main() {
  const result = await createShopAiPlan({
    message: "Допоможи підібрати найкращий варіант",
    history: [],
    context: {
      locale: "ua",
      currency: "EUR",
      scope: "auto",
    },
  });
  const ok =
    result.usedProvider &&
    !result.degraded &&
    result.providerModel === "gemini-3.5-flash-lite" &&
    result.providerErrorKind === null;
  console.log(
    JSON.stringify(
      {
        ok,
        usedProvider: result.usedProvider,
        degraded: result.degraded,
        providerModel: result.providerModel,
        providerErrorKind: result.providerErrorKind,
        plannerLatencyMs: result.plannerLatencyMs,
        mode: result.plan.needsClarification ? "clarification" : "planned",
        goal: result.plan.goal,
        category: result.plan.category,
      },
      null,
      2
    )
  );
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
