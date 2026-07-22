"use client";

import { useEffect, useState } from "react";

import { CircleAlert, Loader2 } from "lucide-react";

import { OpsSurface } from "./OpsSurface";
import { OpsTaskDetail } from "./OpsTaskDetail";
import { opsGet } from "./opsApi";
import type { OpsKnowledgeArticle, OpsTask } from "./types";

export function OpsTaskScreen({
  taskId,
  initialTask,
  demoMode = false,
  canLinkKnowledge = false,
  initialKnowledge,
  permissions,
  canWrite = false,
  canReadKnowledge = false,
  currentAdminId,
  canManageAll = false,
  automationsEnabled = false,
  canRunAutomation = false,
  canDecideApprovals = false,
}: {
  taskId: string;
  initialTask?: OpsTask;
  demoMode?: boolean;
  canLinkKnowledge?: boolean;
  initialKnowledge?: OpsKnowledgeArticle[];
  permissions: readonly string[];
  canWrite?: boolean;
  canReadKnowledge?: boolean;
  currentAdminId: string;
  canManageAll?: boolean;
  automationsEnabled?: boolean;
  canRunAutomation?: boolean;
  canDecideApprovals?: boolean;
}) {
  const [task, setTask] = useState(initialTask);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTask || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ task: OpsTask }>(`/api/admin/operations/tasks/${taskId}`, controller.signal)
      .then((response) => setTask(response.task))
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Не удалось открыть задачу");
      });
    return () => controller.abort();
  }, [demoMode, initialTask, taskId]);

  return (
    <OpsSurface showMobileNav={false} permissions={permissions}>
      {task ? (
        <OpsTaskDetail
          task={task}
          demoMode={demoMode}
          canLinkKnowledge={canLinkKnowledge}
          initialKnowledge={initialKnowledge}
          canWrite={
            canWrite &&
            (canManageAll ||
              task.isShared ||
              task.assignee?.id === currentAdminId ||
              task.createdBy?.id === currentAdminId)
          }
          canReadKnowledge={canReadKnowledge}
          canAssign={canManageAll}
          automationsEnabled={automationsEnabled}
          canRunAutomation={canRunAutomation}
          canDecideApprovals={canDecideApprovals}
        />
      ) : error ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <CircleAlert className="h-9 w-9 text-red-500" />
          <h1 className="mt-3 text-xl font-bold">Задача не открылась</h1>
          <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
        </div>
      ) : (
        <div className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка задачи…
        </div>
      )}
    </OpsSurface>
  );
}
