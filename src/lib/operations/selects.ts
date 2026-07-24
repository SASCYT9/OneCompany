import { Prisma } from "@prisma/client";

export const opsTaskListSelect = {
  id: true,
  number: true,
  externalId: true,
  title: true,
  description: true,
  tags: true,
  status: true,
  priority: true,
  isShared: true,
  executorType: true,
  dueAt: true,
  nextAction: true,
  blockerType: true,
  blockerDescription: true,
  rank: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  archivedAt: true,
  project: {
    select: {
      id: true,
      externalId: true,
      title: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  assignees: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      adminUserId: true,
      createdAt: true,
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  requestedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  shopOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  },
  _count: {
    select: {
      children: true,
      comments: true,
      attachments: true,
    },
  },
} satisfies Prisma.OpsTaskSelect;

export const opsTaskDetailSelect = {
  ...opsTaskListSelect,
  definitionOfDone: true,
  sourceType: true,
  sourceId: true,
  parentTaskId: true,
  attemptCount: true,
  retryAt: true,
  children: {
    where: { archivedAt: null },
    orderBy: [{ status: "asc" as const }, { rank: "asc" as const }],
    select: opsTaskListSelect,
  },
  events: {
    orderBy: { createdAt: "desc" as const },
    take: 100,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      attachment: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          state: true,
          retentionAt: true,
          pinned: true,
          createdAt: true,
          transcription: true,
          transcriptionLanguage: true,
          transcriptionConfidence: true,
          transcriptionModel: true,
          inboxItem: {
            select: {
              transcription: true,
            },
          },
        },
      },
    },
  },
  knowledgeLinks: {
    include: {
      article: {
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          brandKey: true,
          tags: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  },
  automationRuns: {
    orderBy: { createdAt: "desc" as const },
    take: 25,
  },
  approvals: {
    orderBy: { createdAt: "desc" as const },
    take: 25,
    select: {
      id: true,
      action: true,
      status: true,
      expiresAt: true,
      approvedAt: true,
      rejectedAt: true,
      decisionNote: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OpsTaskSelect;

export function serializeOpsJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item))
  ) as T;
}
