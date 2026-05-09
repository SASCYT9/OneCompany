"use client";

import { useState } from "react";

import { Plus, Save, Trash2, Users } from "lucide-react";

import { AdminInspectorCard } from "@/components/admin/AdminPrimitives";
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from "@/components/admin/AdminFormFields";

/**
 * Segment Editor — UI for building rule sets.
 *
 * Field options follow shopCustomerSegments.ts contract:
 *   group, isActive, country, tag, totalSpent, ordersCount, lastOrderDays
 */

export type SegmentRules = {
  match: "all" | "any";
  conditions: Condition[];
};

type Condition = {
  field: string;
  operator: string;
  value: string | number;
};

const FIELDS = [
  { value: "group", label: "Customer group", operators: ["equals"], type: "group" },
  { value: "isActive", label: "Active status", operators: ["equals"], type: "boolean" },
  { value: "country", label: "Country code", operators: ["equals"], type: "text" },
  { value: "tag", label: "Has tag", operators: ["has", "lacks"], type: "text" },
  { value: "totalSpent", label: "Lifetime spend", operators: ["gte", "lte"], type: "number" },
  { value: "ordersCount", label: "Orders count", operators: ["gte", "lte"], type: "number" },
  {
    value: "lastOrderDays",
    label: "Days since last order",
    operators: ["gte", "lte"],
    type: "number",
  },
] as const;

const OPERATOR_LABEL: Record<string, string> = {
  equals: "=",
  in: "in",
  gte: "≥",
  lte: "≤",
  has: "has",
  lacks: "lacks",
};

type EditorProps = {
  initialName?: string;
  initialDescription?: string;
  initialRules?: SegmentRules;
  onSave: (payload: {
    name: string;
    description: string | null;
    rulesJson: SegmentRules;
  }) => Promise<void>;
};

export function SegmentEditor({
  initialName = "",
  initialDescription = "",
  initialRules,
  onSave,
}: EditorProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [match, setMatch] = useState<"all" | "any">(initialRules?.match ?? "all");
  const [conditions, setConditions] = useState<Condition[]>(
    initialRules?.conditions ?? [{ field: "group", operator: "equals", value: "B2B_APPROVED" }]
  );
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  function addCondition() {
    setConditions((cur) => [...cur, { field: "group", operator: "equals", value: "B2C" }]);
  }

  function removeCondition(idx: number) {
    setConditions((cur) => cur.filter((_, i) => i !== idx));
  }

  function updateCondition(idx: number, patch: Partial<Condition>) {
    setConditions((cur) =>
      cur.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        // Reset value when field changes since type may differ
        if (patch.field !== undefined && patch.field !== c.field) {
          const fieldDef = FIELDS.find((f) => f.value === patch.field);
          next.operator = fieldDef?.operators[0] ?? "equals";
          next.value = fieldDef?.type === "number" ? 0 : "";
        }
        return next;
      })
    );
  }

  async function handlePreview() {
    setPreviewing(true);
    try {
      // Use temporary segment compute via direct API call shape
      const response = await fetch("/api/admin/shop/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rulesJson: { match, conditions } }),
      });
      if (!response.ok) {
        setPreviewCount(null);
        return;
      }
      const data = await response.json();
      setPreviewCount(data.count ?? null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        rulesJson: { match, conditions },
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <AdminInspectorCard
          title="Identity"
          description="Name and optional description for this segment."
        >
          <div className="space-y-3">
            <AdminInputField
              label="Segment name"
              value={name}
              onChange={setName}
              placeholder="e.g. B2B churned 90d"
            />
            <AdminTextareaField
              label="Description"
              value={description}
              onChange={setDescription}
              rows={2}
            />
          </div>
        </AdminInspectorCard>

        <AdminInspectorCard
          title="Rules"
          description="Conditions that customers must satisfy. Choose ALL or ANY for combination logic."
        >
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Match</span>
            <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/3">
              <button
                type="button"
                onClick={() => setMatch("all")}
                className={`px-3 py-1 text-xs ${match === "all" ? "bg-blue-500/15 text-blue-300" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                ALL conditions
              </button>
              <button
                type="button"
                onClick={() => setMatch("any")}
                className={`px-3 py-1 text-xs ${match === "any" ? "bg-blue-500/15 text-blue-300" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                ANY condition
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {conditions.map((cond, idx) => {
              const fieldDef = FIELDS.find((f) => f.value === cond.field);
              const operators = fieldDef?.operators ?? ["equals"];
              return (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2 rounded-none border border-white/5 bg-[#171717] p-2"
                >
                  <AdminSelectField
                    label="Field"
                    value={cond.field}
                    onChange={(v) => updateCondition(idx, { field: v })}
                    options={FIELDS.map((f) => ({ value: f.value, label: f.label }))}
                  />
                  <AdminSelectField
                    label="Op"
                    value={cond.operator}
                    onChange={(v) => updateCondition(idx, { operator: v })}
                    options={operators.map((op) => ({
                      value: op,
                      label: OPERATOR_LABEL[op] || op,
                    }))}
                  />
                  <ConditionValueInput
                    type={fieldDef?.type ?? "text"}
                    value={cond.value}
                    onChange={(v) => updateCondition(idx, { value: v })}
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(idx)}
                    className="rounded-none p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Remove condition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="mt-3 inline-flex items-center gap-1.5 rounded-none border border-white/10 bg-white/3 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/6"
          >
            <Plus className="h-3 w-3" />
            Add condition
          </button>
        </AdminInspectorCard>
      </div>

      <aside className="space-y-4">
        <AdminInspectorCard title="Preview & save" description="Compute live count, then save.">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={previewing || conditions.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-blue-500/25 bg-blue-500/6 px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-300 transition hover:bg-blue-500/12 disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5" />
              {previewing ? "Computing…" : "Preview matches"}
            </button>
            {previewCount !== null ? (
              <div className="rounded-none border border-blue-500/30 bg-blue-500/8 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-blue-300">
                  Matching customers
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-blue-200">
                  {previewCount}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !name.trim() || conditions.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save segment"}
            </button>
          </div>
        </AdminInspectorCard>
      </aside>
    </div>
  );
}

function ConditionValueInput({
  type,
  value,
  onChange,
}: {
  type: string;
  value: string | number;
  onChange: (v: string | number) => void;
}) {
  if (type === "group") {
    return (
      <AdminSelectField
        label="Value"
        value={String(value)}
        onChange={(v) => onChange(v)}
        options={[
          { value: "B2C", label: "B2C" },
          { value: "B2B_PENDING", label: "B2B pending" },
          { value: "B2B_APPROVED", label: "B2B approved" },
        ]}
      />
    );
  }
  if (type === "boolean") {
    return (
      <AdminSelectField
        label="Value"
        value={String(value)}
        onChange={(v) => onChange(v)}
        options={[
          { value: "true", label: "Active" },
          { value: "false", label: "Inactive" },
        ]}
      />
    );
  }
  if (type === "number") {
    return (
      <AdminInputField
        label="Value"
        value={String(value)}
        onChange={(v) => onChange(parseFloat(v) || 0)}
        type="number"
        step="0.01"
      />
    );
  }
  return <AdminInputField label="Value" value={String(value)} onChange={onChange} />;
}
