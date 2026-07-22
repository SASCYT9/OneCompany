"use client";

import { useState, type FormEvent } from "react";
import {
  AlertOctagon,
  BadgeCheck,
  FileClock,
  FileQuestion,
  Globe2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { AdminInlineAlert, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import type { OneAiQualityAction } from "@/lib/admin/oneAiQualityMutation";
import type {
  OneAiQualityProductDetail,
  OneAiQualityVehicleApplication,
} from "@/lib/admin/oneAiQualityTypes";

export type OneAiQualityActionRequest = {
  action: OneAiQualityAction;
  reason?: string | null;
  application?: {
    applicationId: string | null;
    variantId: string | null;
    scope: "auto" | "moto";
    vehicleType: "car" | "motorcycle";
    make: string;
    model: string | null;
    generation: string | null;
    chassisCode: string | null;
    yearFrom: number | null;
    yearTo: number | null;
    engine: string | null;
    fuel: string | null;
    bodyStyle: string | null;
    drivetrain: string | null;
    transmission: string | null;
    market: string | null;
    opfGpf: "with" | "without" | "unknown";
    categoryGroup: string | null;
    productKind: string | null;
    material: string | null;
  };
  evidence?: {
    excerpt: string;
    sourceRef: string | null;
  } | null;
  targetRevisionId?: string | null;
  targetRevision?: number | null;
};

type ActionTab = Exclude<OneAiQualityAction, "undo">;

type ApplicationForm = {
  applicationId: string;
  variantId: string;
  make: string;
  model: string;
  generation: string;
  chassisCode: string;
  yearFrom: string;
  yearTo: string;
  engine: string;
  fuel: string;
  bodyStyle: string;
  drivetrain: string;
  transmission: string;
  market: string;
  opfGpf: "with" | "without" | "unknown";
  categoryGroup: string;
  productKind: string;
  material: string;
  reason: string;
  evidenceExcerpt: string;
  evidenceSourceRef: string;
};

const ACTIONS: Array<{
  id: ActionTab;
  label: string;
  description: string;
  icon: typeof BadgeCheck;
}> = [
  {
    id: "verify_and_reindex",
    label: "Verify & reindex",
    description: "Publish one evidenced application and queue Knowledge V2.",
    icon: BadgeCheck,
  },
  {
    id: "save_draft",
    label: "Save draft",
    description: "Store a non-active application for later review.",
    icon: FileClock,
  },
  {
    id: "mark_universal",
    label: "Mark universal",
    description: "Replace active fitment with an evidenced universal claim.",
    icon: Globe2,
  },
  {
    id: "needs_source",
    label: "Needs source",
    description: "Downgrade active applications until provenance is supplied.",
    icon: FileQuestion,
  },
  {
    id: "block_strict",
    label: "Block strict",
    description: "Immediately remove this product from strict One AI matching.",
    icon: AlertOctagon,
  },
];

const inputClass =
  "mt-1.5 h-10 w-full border border-white/8 bg-black/25 px-3 text-sm text-zinc-100 outline-hidden transition placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
  "mt-1.5 min-h-24 w-full resize-y border border-white/8 bg-black/25 px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-hidden transition placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "block text-xs font-medium text-zinc-400";

function clean(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function year(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function applicationToForm(
  application: OneAiQualityVehicleApplication | null,
  detail: OneAiQualityProductDetail
): ApplicationForm {
  return {
    applicationId: application?.id ?? "",
    variantId: application?.variantId ?? "",
    make: application?.make ?? "",
    model: application?.model ?? "",
    generation: application?.generation ?? "",
    chassisCode: application?.chassisCode ?? "",
    yearFrom: application?.yearFrom?.toString() ?? "",
    yearTo: application?.yearTo?.toString() ?? "",
    engine: application?.engine ?? "",
    fuel: application?.fuel ?? "",
    bodyStyle: application?.bodyStyle ?? "",
    drivetrain: application?.drivetrain ?? "",
    transmission: application?.transmission ?? "",
    market: application?.market ?? "",
    opfGpf:
      application?.opfGpf === "with" || application?.opfGpf === "without"
        ? application.opfGpf
        : "unknown",
    categoryGroup: application?.categoryGroup ?? detail.product.knowledge?.categoryGroup ?? "",
    productKind: application?.productKind ?? "",
    material: application?.material ?? "",
    reason: "",
    evidenceExcerpt: "",
    evidenceSourceRef: "",
  };
}

export function OneAiQualityActionEditor({
  detail,
  submittingAction,
  error,
  success,
  conflict,
  onReload,
  onSubmit,
}: {
  detail: OneAiQualityProductDetail;
  submittingAction: OneAiQualityAction | null;
  error: string;
  success: string;
  conflict: { expectedRevision: number; currentRevision: number } | null;
  onReload: () => void;
  onSubmit: (request: OneAiQualityActionRequest) => Promise<void>;
}) {
  const knowledge = detail.product.knowledge;
  const applications = knowledge?.vehicleApplications ?? [];
  const firstApplication =
    applications.find((application) => application.isActive) ?? applications[0] ?? null;
  const [activeAction, setActiveAction] = useState<ActionTab>("verify_and_reindex");
  const [form, setForm] = useState<ApplicationForm>(() =>
    applicationToForm(firstApplication, detail)
  );
  const busy = submittingAction !== null;

  function setField<K extends keyof ApplicationForm>(field: K, value: ApplicationForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseApplication(applicationId: string) {
    const application = applications.find((item) => item.id === applicationId) ?? null;
    const next = applicationToForm(application, detail);
    setForm((current) => ({
      ...next,
      reason: current.reason,
      evidenceExcerpt: current.evidenceExcerpt,
      evidenceSourceRef: current.evidenceSourceRef,
    }));
  }

  async function submitApplication(
    event: FormEvent<HTMLFormElement>,
    action: "save_draft" | "verify_and_reindex"
  ) {
    event.preventDefault();
    const scope = detail.product.scope === "moto" ? "moto" : "auto";
    await onSubmit({
      action,
      reason: clean(form.reason),
      application: {
        applicationId: clean(form.applicationId),
        variantId: clean(form.variantId),
        scope,
        vehicleType: scope === "moto" ? "motorcycle" : "car",
        make: form.make.trim(),
        model: clean(form.model),
        generation: clean(form.generation),
        chassisCode: clean(form.chassisCode),
        yearFrom: year(form.yearFrom),
        yearTo: year(form.yearTo),
        engine: clean(form.engine),
        fuel: clean(form.fuel),
        bodyStyle: clean(form.bodyStyle),
        drivetrain: clean(form.drivetrain),
        transmission: clean(form.transmission),
        market: clean(form.market),
        opfGpf: form.opfGpf,
        categoryGroup: clean(form.categoryGroup),
        productKind: clean(form.productKind),
        material: clean(form.material),
      },
      evidence: form.evidenceExcerpt.trim()
        ? {
            excerpt: form.evidenceExcerpt.trim(),
            sourceRef: clean(form.evidenceSourceRef),
          }
        : null,
    });
  }

  async function submitSimple(
    event: FormEvent<HTMLFormElement>,
    action: "mark_universal" | "needs_source" | "block_strict"
  ) {
    event.preventDefault();
    await onSubmit({
      action,
      reason: clean(form.reason),
      evidence:
        action === "mark_universal"
          ? {
              excerpt: form.evidenceExcerpt.trim(),
              sourceRef: clean(form.evidenceSourceRef),
            }
          : form.evidenceExcerpt.trim()
            ? {
                excerpt: form.evidenceExcerpt.trim(),
                sourceRef: clean(form.evidenceSourceRef),
              }
            : null,
    });
  }

  if (!knowledge || !detail.ready) {
    return (
      <AdminInlineAlert tone="warning">
        This product does not have an editable Knowledge V2 record yet. Run the staging backfill
        first.
      </AdminInlineAlert>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Controlled manager action</div>
          <div className="mt-1 text-xs text-zinc-500">
            Every write includes evidence, an immutable revision, audit data, and optimistic
            concurrency.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdminStatusBadge>revision {knowledge.revision}</AdminStatusBadge>
          <AdminStatusBadge>active {knowledge.activeRevision}</AdminStatusBadge>
        </div>
      </div>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}
      {conflict ? (
        <AdminInlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              This record changed from revision {conflict.expectedRevision} to{" "}
              {conflict.currentRevision}. Reload the latest version before applying your decision.
            </span>
            <button
              type="button"
              onClick={onReload}
              className="inline-flex h-8 items-center gap-2 border border-amber-400/25 bg-amber-400/8 px-3 text-xs font-medium text-amber-100 transition hover:bg-amber-400/15 focus:outline-hidden focus:ring-2 focus:ring-amber-400/30"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload latest
            </button>
          </div>
        </AdminInlineAlert>
      ) : null}

      <div
        role="tablist"
        aria-label="Knowledge quality actions"
        className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
      >
        {ACTIONS.map((action) => {
          const selected = activeAction === action.id;
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`one-ai-action-${action.id}`}
              onClick={() => setActiveAction(action.id)}
              disabled={busy}
              className={`min-h-24 border px-3 py-3 text-left transition focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 ${
                selected
                  ? action.id === "block_strict"
                    ? "border-red-500/35 bg-red-500/8"
                    : "border-blue-500/35 bg-blue-500/8"
                  : "border-white/8 bg-black/15 hover:border-white/15 hover:bg-white/3"
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                <Icon
                  className={`h-4 w-4 ${
                    action.id === "block_strict" ? "text-red-400" : "text-blue-400"
                  }`}
                  aria-hidden="true"
                />
                {action.label}
              </span>
              <span className="mt-2 block text-[11px] leading-4 text-zinc-500">
                {action.description}
              </span>
            </button>
          );
        })}
      </div>

      {activeAction === "verify_and_reindex" || activeAction === "save_draft" ? (
        <ApplicationActionForm
          id={`one-ai-action-${activeAction}`}
          action={activeAction}
          detail={detail}
          applications={applications}
          form={form}
          busy={busy}
          onField={setField}
          onChooseApplication={chooseApplication}
          onSubmit={(event) => void submitApplication(event, activeAction)}
          submitting={submittingAction === activeAction}
        />
      ) : null}

      {activeAction === "mark_universal" ? (
        <SimpleActionForm
          id="one-ai-action-mark_universal"
          title="Confirm universal fitment"
          description="This replaces all active vehicle applications after a source-backed reindex. Use only when the manufacturer explicitly states the item is universal."
          buttonLabel="Mark universal & reindex"
          tone="warning"
          requireEvidence
          form={form}
          busy={busy}
          submitting={submittingAction === "mark_universal"}
          onField={setField}
          onSubmit={(event) => void submitSimple(event, "mark_universal")}
        />
      ) : null}

      {activeAction === "needs_source" ? (
        <SimpleActionForm
          id="one-ai-action-needs_source"
          title="Require a better source"
          description="Exact matching is disabled for the active applications until a manager or import provides trustworthy evidence."
          buttonLabel="Mark as needs source"
          tone="warning"
          form={form}
          busy={busy}
          submitting={submittingAction === "needs_source"}
          onField={setField}
          onSubmit={(event) => void submitSimple(event, "needs_source")}
        />
      ) : null}

      {activeAction === "block_strict" ? (
        <SimpleActionForm
          id="one-ai-action-block_strict"
          title="Block strict One AI matching"
          description="This is an immediate safety action. The product stays in the storefront, but One AI cannot return it from strict matching until a manager verifies a replacement."
          buttonLabel="Block strict matching"
          tone="danger"
          form={form}
          busy={busy}
          submitting={submittingAction === "block_strict"}
          onField={setField}
          onSubmit={(event) => void submitSimple(event, "block_strict")}
        />
      ) : null}
    </div>
  );
}

function ApplicationActionForm({
  id,
  action,
  detail,
  applications,
  form,
  busy,
  submitting,
  onField,
  onChooseApplication,
  onSubmit,
}: {
  id: string;
  action: "save_draft" | "verify_and_reindex";
  detail: OneAiQualityProductDetail;
  applications: OneAiQualityVehicleApplication[];
  form: ApplicationForm;
  busy: boolean;
  submitting: boolean;
  onField: <K extends keyof ApplicationForm>(field: K, value: ApplicationForm[K]) => void;
  onChooseApplication: (applicationId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const verified = action === "verify_and_reindex";
  return (
    <form
      id={id}
      role="tabpanel"
      onSubmit={onSubmit}
      className="border border-white/8 bg-black/15 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            {verified ? "Verified vehicle application" : "Draft vehicle application"}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Keep make, model, chassis, years, engine and variant in one correlated row. Empty fields
            remain unknown; they are never inferred by this form.
          </p>
        </div>
        <AdminStatusBadge tone={verified ? "success" : "warning"}>
          {verified ? "Evidence required" : "Inactive draft"}
        </AdminStatusBadge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className={labelClass}>
          Base application
          <select
            value={form.applicationId}
            onChange={(event) => onChooseApplication(event.target.value)}
            disabled={busy}
            className={inputClass}
          >
            <option value="">New application</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.make || "Universal"} {application.model || ""}{" "}
                {application.chassisCode || ""} · {application.source} · r{application.revision}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Variant
          <select
            value={form.variantId}
            onChange={(event) => onField("variantId", event.target.value)}
            disabled={busy}
            className={inputClass}
          >
            <option value="">All variants</option>
            {detail.product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.sku || variant.title || variant.id}
              </option>
            ))}
          </select>
        </label>

        <ReadOnlyField label="Scope" value={detail.product.scope.toUpperCase()} />

        <TextField
          label="Make"
          value={form.make}
          onChange={(value) => onField("make", value)}
          required
          disabled={busy}
          placeholder="BMW"
        />
        <TextField
          label="Model"
          value={form.model}
          onChange={(value) => onField("model", value)}
          disabled={busy}
          placeholder="M3"
        />
        <TextField
          label="Generation"
          value={form.generation}
          onChange={(value) => onField("generation", value)}
          disabled={busy}
          placeholder="G80"
        />
        <TextField
          label="Chassis"
          value={form.chassisCode}
          onChange={(value) => onField("chassisCode", value)}
          disabled={busy}
          placeholder="G80"
        />
        <TextField
          label="Year from"
          value={form.yearFrom}
          onChange={(value) => onField("yearFrom", value)}
          disabled={busy}
          type="number"
          min={1886}
          max={2200}
          placeholder="2021"
        />
        <TextField
          label="Year to"
          value={form.yearTo}
          onChange={(value) => onField("yearTo", value)}
          disabled={busy}
          type="number"
          min={1886}
          max={2200}
          placeholder="2026"
        />
        <TextField
          label="Engine"
          value={form.engine}
          onChange={(value) => onField("engine", value)}
          disabled={busy}
          placeholder="S58"
        />
        <TextField
          label="Fuel"
          value={form.fuel}
          onChange={(value) => onField("fuel", value)}
          disabled={busy}
          placeholder="petrol"
        />
        <TextField
          label="Body"
          value={form.bodyStyle}
          onChange={(value) => onField("bodyStyle", value)}
          disabled={busy}
          placeholder="sedan"
        />
        <TextField
          label="Drivetrain"
          value={form.drivetrain}
          onChange={(value) => onField("drivetrain", value)}
          disabled={busy}
          placeholder="xDrive"
        />
        <TextField
          label="Transmission"
          value={form.transmission}
          onChange={(value) => onField("transmission", value)}
          disabled={busy}
          placeholder="automatic"
        />
        <TextField
          label="Market"
          value={form.market}
          onChange={(value) => onField("market", value)}
          disabled={busy}
          placeholder="EU"
        />

        <label className={labelClass}>
          OPF / GPF
          <select
            value={form.opfGpf}
            onChange={(event) => onField("opfGpf", event.target.value as ApplicationForm["opfGpf"])}
            disabled={busy}
            className={inputClass}
          >
            <option value="unknown">Unknown</option>
            <option value="with">With OPF / GPF</option>
            <option value="without">Without OPF / GPF</option>
          </select>
        </label>

        <TextField
          label="Category group"
          value={form.categoryGroup}
          onChange={(value) => onField("categoryGroup", value)}
          disabled={busy}
          placeholder="exhaust"
        />
        <TextField
          label="Product kind"
          value={form.productKind}
          onChange={(value) => onField("productKind", value)}
          disabled={busy}
          placeholder="system"
        />
        <TextField
          label="Material"
          value={form.material}
          onChange={(value) => onField("material", value)}
          disabled={busy}
          placeholder="titanium"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className={labelClass}>
          Evidence excerpt {verified ? <RequiredMark /> : null}
          <textarea
            value={form.evidenceExcerpt}
            onChange={(event) => onField("evidenceExcerpt", event.target.value)}
            disabled={busy}
            required={verified}
            maxLength={2000}
            className={textareaClass}
            placeholder="Paste the exact supplier or manufacturer statement that supports this correlated fitment."
          />
        </label>
        <div className="space-y-4">
          <TextField
            label="Evidence source reference"
            value={form.evidenceSourceRef}
            onChange={(value) => onField("evidenceSourceRef", value)}
            disabled={busy}
            placeholder="supplier:catalog-2026-07 / URL / document row"
          />
          <TextField
            label="Change note"
            value={form.reason}
            onChange={(value) => onField("reason", value)}
            disabled={busy}
            placeholder="Why this application is being added or replaced"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
        <p className="max-w-2xl text-[11px] leading-5 text-zinc-500">
          {verified
            ? "The canonical manager row is written first; the legacy fitment metafield is dual-written only for rollout compatibility."
            : "Draft applications stay inactive and cannot make a product an exact match."}
        </p>
        <button
          type="submit"
          disabled={busy || !form.make.trim()}
          className="inline-flex h-10 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : verified ? (
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <FileClock className="h-4 w-4" aria-hidden="true" />
          )}
          {verified ? "Verify & queue reindex" : "Save inactive draft"}
        </button>
      </div>
    </form>
  );
}

function SimpleActionForm({
  id,
  title,
  description,
  buttonLabel,
  tone,
  requireEvidence,
  form,
  busy,
  submitting,
  onField,
  onSubmit,
}: {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  tone: "warning" | "danger";
  requireEvidence?: boolean;
  form: ApplicationForm;
  busy: boolean;
  submitting: boolean;
  onField: <K extends keyof ApplicationForm>(field: K, value: ApplicationForm[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const danger = tone === "danger";
  return (
    <form
      id={id}
      role="tabpanel"
      onSubmit={onSubmit}
      className={`border p-4 sm:p-5 ${
        danger ? "border-red-500/25 bg-red-950/12" : "border-amber-500/20 bg-amber-950/10"
      }`}
    >
      <h3 className={`text-sm font-semibold ${danger ? "text-red-100" : "text-amber-100"}`}>
        {title}
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">{description}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className={labelClass}>
          Manager reason <RequiredMark />
          <textarea
            value={form.reason}
            onChange={(event) => onField("reason", event.target.value)}
            disabled={busy}
            required
            maxLength={500}
            className={textareaClass}
            placeholder="Record the exact reason for this safety decision."
          />
        </label>
        <div className="space-y-4">
          <label className={labelClass}>
            Evidence excerpt {requireEvidence ? <RequiredMark /> : null}
            <textarea
              value={form.evidenceExcerpt}
              onChange={(event) => onField("evidenceExcerpt", event.target.value)}
              disabled={busy}
              required={requireEvidence}
              maxLength={2000}
              className={textareaClass}
              placeholder={
                requireEvidence
                  ? "Manufacturer statement proving universal fitment."
                  : "Optional supporting excerpt."
              }
            />
          </label>
          <TextField
            label="Evidence source reference"
            value={form.evidenceSourceRef}
            onChange={(value) => onField("evidenceSourceRef", value)}
            disabled={busy}
            placeholder="supplier document / URL / ticket"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-white/6 pt-4">
        <button
          type="submit"
          disabled={
            busy || !form.reason.trim() || (requireEvidence && !form.evidenceExcerpt.trim())
          }
          className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white transition focus:outline-hidden focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            danger
              ? "bg-red-600 hover:bg-red-500 focus:ring-red-500/40"
              : "bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/40"
          }`}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : danger ? (
            <AlertOctagon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <FileQuestion className="h-4 w-4" aria-hidden="true" />
          )}
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <label className={labelClass}>
      {label} {required ? <RequiredMark /> : null}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        min={min}
        max={max}
        className={inputClass}
        autoComplete="off"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={labelClass}>{label}</div>
      <div className="mt-1.5 flex h-10 items-center border border-white/6 bg-white/2 px-3 text-sm text-zinc-400">
        {value}
      </div>
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="text-red-400" aria-label="required">
      *
    </span>
  );
}
