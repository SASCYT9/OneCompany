import type { OpsJob } from "@prisma/client";

import {
  extractOpsProposalWithAi,
  type OpsAiBudget,
  type OpsAiUsage,
} from "../../src/lib/operations/ai";
import { prisma } from "../../src/lib/prisma";
import { asPayload, extractionContext } from "../../src/lib/operations/telegramJobs";

const MAX_CASES = 5;

function redact(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, "[phone]")
    .trim()
    .slice(0, 600);
}

async function main() {
  const jobs = await prisma.opsJob.findMany({
    where: {
      inboxItemId: { not: null },
      status: "SUCCEEDED",
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  const selected = jobs
    .map((job) => ({ job, payload: asPayload(job as OpsJob) }))
    .filter(({ payload }) =>
      Boolean(payload.extractionText ?? payload.transcription ?? payload.text)
    )
    .filter(({ payload }) => Boolean(payload.extraction?.tasks.length))
    .slice(0, MAX_CASES);

  if (!selected.length) throw new Error("No completed extraction cases were found");

  const recorded: OpsAiUsage[] = [];
  const budget: OpsAiBudget = {
    async reserve() {},
    async record(usage) {
      recorded.push(usage);
    },
  };
  const results = [];
  for (const { job, payload } of selected) {
    const text = payload.extractionText ?? payload.transcription ?? payload.text ?? "";
    const previous = payload.extraction!;
    const response = await extractOpsProposalWithAi({
      text,
      context: await extractionContext(prisma, payload),
      budget,
    });
    results.push({
      jobId: job.id,
      source: redact(text),
      previous: {
        tasks: previous.tasks.map((task) => ({
          title: redact(task.title),
          assigneeRef: task.assignee_ref,
          nextAction: redact(task.next_action),
        })),
        ambiguities: previous.ambiguities.map(redact),
      },
      candidate: {
        model: response.model,
        tasks: response.value.tasks.map((task) => ({
          title: redact(task.title),
          assigneeRef: task.assignee_ref,
          nextAction: redact(task.next_action),
        })),
        ambiguities: response.value.ambiguities.map(redact),
        requiresApproval: response.value.requires_approval,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        evaluated: results.length,
        totalCostMicros: recorded
          .reduce((sum, usage) => sum + usage.costMicros, BigInt(0))
          .toString(),
        results,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Gemini evaluation failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
