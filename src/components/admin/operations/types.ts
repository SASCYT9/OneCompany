export type OpsTaskStatus =
  | "INBOX"
  | "PLANNED"
  | "IN_PROGRESS"
  | "AGENT_RUNNING"
  | "WAITING_HUMAN"
  | "WAITING_EXTERNAL"
  | "NEEDS_APPROVAL"
  | "REVIEW"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED";

export type OpsPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type OpsPerson = {
  id: string;
  name: string | null;
  email: string;
  activeTaskCount?: number;
};

export type OpsTaskAssignee = OpsPerson | { adminUser: OpsPerson };

export type OpsAutomationRun = {
  id: string;
  taskId?: string;
  automationType: "research_draft" | "document_summary" | "catalog_check" | string;
  status: string;
  stage?: string | null;
  attempts?: number;
  maxAttempts?: number;
  inputSnapshot?: unknown;
  result?: unknown;
  errorType?: string | null;
  errorMessage?: string | null;
  requestedById?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OpsTaskApproval = {
  id: string;
  action: string;
  status: string;
  expiresAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  decisionNote?: string | null;
  createdAt?: string;
};

export type OpsApproval = OpsTaskApproval & {
  payload: unknown;
  payloadHash: string;
  updatedAt: string;
  requester: OpsPerson;
  approver?: OpsPerson | null;
  task: {
    id: string;
    externalId: string;
    title: string;
    status: OpsTaskStatus;
    version: number;
  };
};

export type OpsTask = {
  id: string;
  number?: number;
  externalId: string;
  title: string;
  description?: string | null;
  tags?: string[];
  status: OpsTaskStatus;
  priority: OpsPriority;
  isShared?: boolean;
  executorType?: "HUMAN" | "AUTOMATION" | "MIXED";
  dueAt?: string | null;
  nextAction?: string | null;
  blockerType?: string | null;
  blockerDescription?: string | null;
  rank?: string | number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  project?: { id: string; externalId: string; title: string } | null;
  assignee?: OpsPerson | null;
  assignees?: OpsTaskAssignee[];
  requestedBy?: OpsPerson | null;
  createdBy?: OpsPerson | null;
  shopOrder?: { id: string; orderNumber: string; status: string } | null;
  definitionOfDone?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  telegramSource?: {
    inboxItemId: string;
    originalMessage?: string | null;
    transcription?: string | null;
    receivedAt: string;
    isForwarded: boolean;
    forwardedFrom?: string | null;
    replyTo?: {
      text?: string | null;
      sender?: string | null;
    } | null;
  } | null;
  children?: OpsTask[];
  comments?: OpsComment[];
  events?: OpsEvent[];
  attachments?: Array<{
    id: string;
    attachment: OpsAttachment;
  }>;
  knowledgeLinks?: Array<{
    article: Pick<
      OpsKnowledgeArticle,
      "id" | "slug" | "title" | "category" | "brandKey" | "tags" | "status" | "updatedAt"
    >;
  }>;
  automationRuns?: OpsAutomationRun[];
  approvals?: OpsTaskApproval[];
  _count?: { children: number; comments: number; attachments: number };
};

export type OpsComment = {
  id: string;
  text: string;
  createdAt: string;
  author?: OpsPerson | null;
};

export type OpsEvent = {
  id: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown>;
  actor?: OpsPerson | null;
};

export type OpsAttachment = {
  id: string;
  fileName: string | null;
  mimeType: string;
  sizeBytes: string | number;
  state: string;
  retentionAt?: string | null;
  pinned?: boolean;
  createdAt?: string;
  accessUrl?: string;
  transcription?: string | null;
  transcriptionLanguage?: string | null;
  transcriptionConfidence?: string | null;
  transcriptionModel?: string | null;
  inboxItem?: { transcription?: string | null } | null;
};

export type OpsProject = {
  id: string;
  externalId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: OpsPriority;
  startDate?: string | null;
  dueDate?: string | null;
  nextAction?: string | null;
  version: number;
  owner?: OpsPerson | null;
  updatedAt?: string;
  _count?: { tasks: number; knowledgeArticles: number };
};

export type OpsKnowledgeArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  contentMarkdown: string;
  locale: string;
  category: string;
  brandKey?: string | null;
  tags: string[];
  status: "DRAFT" | "PUBLISHED" | string;
  version: number;
  publishedRevision?: number | null;
  updatedAt: string;
  author?: OpsPerson;
  _count?: { taskLinks: number; revisions: number };
  revisions?: Array<{
    id: string;
    revision: number;
    status: string;
    changeNote?: string | null;
    createdAt: string;
  }>;
};

export type OpsInboxItem = {
  id: string;
  originalMessage: string;
  transcription?: string | null;
  extractionStatus: string;
  reviewStatus: string;
  confidence?: number | string | null;
  summary?: string | null;
  ambiguities?: unknown;
  requiresApproval?: boolean;
  processingError?: string | null;
  createdAt: string;
  telegramUpdate?: {
    telegramUserId: string;
    updateType: string;
    isUntrustedForward: boolean;
    receivedAt: string;
  };
  proposals?: Array<{
    id: string;
    kind: string;
    payload: Record<string, unknown>;
    payloadHash?: string;
    confidence?: number | string | null;
    status: string;
    appliedTaskId?: string | null;
  }>;
  attachments?: OpsAttachment[];
  jobs?: Array<{ id: string; type: string; status: string; stage?: string; errorMessage?: string }>;
};

export type OpsDemoData = {
  tasks: OpsTask[];
  projects: OpsProject[];
  articles: OpsKnowledgeArticle[];
  inbox: OpsInboxItem[];
};
