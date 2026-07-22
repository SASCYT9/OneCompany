import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";

export type AdminRoutePolicyRule = {
  id: string;
  pattern: string;
  methods: readonly string[];
  permission?: string;
  public?: boolean;
};

export type AdminRouteAccessDecision = {
  allowed: boolean;
  rule: AdminRoutePolicyRule | null;
  reason?: "UNAUTHORIZED" | "FORBIDDEN" | "UNREGISTERED_ROUTE";
};

const READ = ["GET", "HEAD"] as const;
const MUTATE = ["POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Explicit policy for the new authorization surface. Legacy commerce handlers
 * keep their existing in-handler checks while they are migrated incrementally.
 * New admin routes must be registered here; unmatched routes are denied.
 */
export const ADMIN_ROUTE_POLICY: readonly AdminRoutePolicyRule[] = [
  {
    id: "admin-auth-read",
    pattern: "/api/admin/auth",
    methods: READ,
    public: true,
  },
  {
    id: "admin-auth-mutate",
    pattern: "/api/admin/auth",
    methods: ["POST", "DELETE"],
    public: true,
  },
  {
    id: "admin-dashboard-page",
    pattern: "/admin",
    methods: READ,
    permission: ADMIN_PERMISSIONS.ADMIN_DASHBOARD_READ,
  },
  {
    id: "ops-overview-page",
    pattern: "/admin/operations",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-inbox-pages",
    pattern: "/admin/operations/inbox/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_INBOX_READ,
  },
  {
    id: "ops-project-pages",
    pattern: "/admin/operations/projects/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-task-pages",
    pattern: "/admin/operations/tasks/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-knowledge-pages",
    pattern: "/admin/operations/knowledge/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    id: "ops-directory-pages",
    pattern: "/admin/operations/directory/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    id: "ops-approval-pages",
    pattern: "/admin/operations/approvals/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE,
  },
  {
    id: "ops-system-pages",
    pattern: "/admin/operations/system/**",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE,
  },
  {
    id: "ops-project-list",
    pattern: "/api/admin/operations/projects",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-csrf",
    pattern: "/api/admin/operations/csrf",
    methods: READ,
  },
  {
    id: "ops-project-create",
    pattern: "/api/admin/operations/projects",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-project-detail-read",
    pattern: "/api/admin/operations/projects/:projectId",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-project-detail-write",
    pattern: "/api/admin/operations/projects/:projectId",
    methods: ["PATCH"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-list",
    pattern: "/api/admin/operations/tasks",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-task-create",
    pattern: "/api/admin/operations/tasks",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-detail-read",
    pattern: "/api/admin/operations/tasks/:taskId",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-task-detail-write",
    pattern: "/api/admin/operations/tasks/:taskId",
    methods: ["PATCH"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-transition",
    pattern: "/api/admin/operations/tasks/:taskId/transition",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-comments",
    pattern: "/api/admin/operations/tasks/:taskId/comments",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-attachment-access",
    pattern: "/api/admin/operations/tasks/:taskId/attachments/:attachmentId/access",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-task-knowledge-link",
    pattern: "/api/admin/operations/tasks/:taskId/knowledge/:articleId",
    methods: ["POST", "DELETE"],
    permission: ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  },
  {
    id: "ops-task-automations-read",
    pattern: "/api/admin/operations/tasks/:taskId/automations",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_READ,
  },
  {
    id: "ops-task-automations-run",
    pattern: "/api/admin/operations/tasks/:taskId/automations",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN,
  },
  {
    id: "ops-members-read",
    pattern: "/api/admin/operations/members",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN,
  },
  {
    id: "ops-knowledge-list",
    pattern: "/api/admin/operations/knowledge",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    id: "ops-knowledge-create",
    pattern: "/api/admin/operations/knowledge",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE,
  },
  {
    id: "ops-knowledge-detail-read",
    pattern: "/api/admin/operations/knowledge/:articleId",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  },
  {
    id: "ops-knowledge-detail-write",
    pattern: "/api/admin/operations/knowledge/:articleId",
    methods: ["PATCH"],
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE,
  },
  {
    id: "ops-knowledge-publish",
    pattern: "/api/admin/operations/knowledge/:articleId/publish",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH,
  },
  {
    id: "ops-inbox-list",
    pattern: "/api/admin/operations/inbox",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_INBOX_READ,
  },
  {
    id: "ops-inbox-attachment-access",
    pattern: "/api/admin/operations/inbox/:inboxItemId/attachments/:attachmentId/access",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_INBOX_READ,
  },
  {
    id: "ops-inbox-proposal-update",
    pattern: "/api/admin/operations/inbox/:inboxItemId/proposals/:proposalId",
    methods: ["PATCH"],
    permission: ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  },
  {
    id: "ops-inbox-proposal-create",
    pattern: "/api/admin/operations/inbox/:inboxItemId/proposals",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  },
  {
    id: "ops-inbox-apply",
    pattern: "/api/admin/operations/inbox/:inboxItemId/apply",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  },
  {
    id: "ops-inbox-ignore",
    pattern: "/api/admin/operations/inbox/:inboxItemId/ignore",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  },
  {
    id: "ops-inbox-undo",
    pattern: "/api/admin/operations/inbox/:inboxItemId/undo",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  },
  {
    id: "ops-approvals-read",
    pattern: "/api/admin/operations/approvals",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE,
  },
  {
    id: "ops-approval-decide",
    pattern: "/api/admin/operations/approvals/:approvalId/decide",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE,
  },
  {
    id: "ops-system-read",
    pattern: "/api/admin/operations/system",
    methods: READ,
    permission: ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE,
  },
  {
    id: "ops-system-retry",
    pattern: "/api/admin/operations/system",
    methods: ["POST"],
    permission: ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE,
  },
] as const;

function normalizePathname(pathname: string) {
  const value = pathname.split("?")[0]?.trim() || "/";
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function policyPatternToRegex(pattern: string) {
  const normalized = normalizePathname(pattern);
  const segments = normalized.split("/").filter(Boolean);
  let source = "^";

  for (const segment of segments) {
    if (segment === "**") {
      source += "(?:/.*)?";
      continue;
    }
    source += segment.startsWith(":") ? "/[^/]+" : `/${escapeRegex(segment)}`;
  }

  return new RegExp(`${source || "^/"}$`);
}

function normalizedMethod(method?: string) {
  return (method || "GET").trim().toUpperCase();
}

export function findAdminRoutePolicy(
  pathname: string,
  method = "GET"
): AdminRoutePolicyRule | null {
  const normalizedPath = normalizePathname(pathname);
  const requestMethod = normalizedMethod(method);

  return (
    ADMIN_ROUTE_POLICY.find(
      (rule) =>
        rule.methods.includes(requestMethod) &&
        policyPatternToRegex(rule.pattern).test(normalizedPath)
    ) ?? null
  );
}

export function evaluateAdminRouteAccess(input: {
  pathname: string;
  method?: string;
  permissions?: readonly string[] | null;
}): AdminRouteAccessDecision {
  const rule = findAdminRoutePolicy(input.pathname, input.method);
  if (!rule) {
    return { allowed: false, rule: null, reason: "UNREGISTERED_ROUTE" };
  }

  if (rule.public) {
    return { allowed: true, rule };
  }

  if (!input.permissions) {
    return { allowed: false, rule, reason: "UNAUTHORIZED" };
  }

  if (rule.permission && !matchesAdminPermission([...input.permissions], rule.permission)) {
    return { allowed: false, rule, reason: "FORBIDDEN" };
  }
  return { allowed: true, rule };
}

export function isRegisteredAdminRoute(pathname: string, method = "GET") {
  return findAdminRoutePolicy(pathname, method) !== null;
}

export const ADMIN_ROUTE_METHOD_GROUPS = {
  read: READ,
  mutate: MUTATE,
} as const;
