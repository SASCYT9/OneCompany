"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, PackageX, Save, X } from "lucide-react";

import {
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
  AdminCheckboxField,
} from "@/components/admin/AdminFormFields";
import { useToast } from "@/components/admin/AdminToast";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { AdminActivityTimeline } from "@/components/admin/AdminActivityTimeline";

type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTED"
  | "REFUNDED"
  | "REJECTED";
type ReturnReason =
  | "WRONG_ITEM"
  | "DAMAGED"
  | "DEFECTIVE"
  | "NOT_AS_DESCRIBED"
  | "CHANGED_MIND"
  | "ORDERING_ERROR"
  | "OTHER";

type ReturnDetail = {
  id: string;
  rmaNumber: string;
  orderId: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonNote: string | null;
  refundMethod: string;
  refundAmount: number;
  currency: string;
  customerNote: string | null;
  adminNote: string | null;
  externalRefundId: string | null;
  restockOnReceive: boolean;
  allowedNextStatuses: ReturnStatus[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    email: string;
    customerName: string;
    currency: string;
    total: number;
    customerGroupSnapshot: string;
    paymentStatus: string;
    amountPaid: number;
    createdAt: string;
  };
  items: Array<{
    id: string;
    title: string;
    productSlug: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    refundAmount: number;
    reason: ReturnReason | null;
    conditionNote: string | null;
    restockedAt: string | null;
    restockLocationId: string | null;
  }>;
};

function statusTone(status: ReturnStatus): "default" | "success" | "warning" | "danger" {
  if (status === "REFUNDED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  IN_TRANSIT: "In transit",
  RECEIVED: "Received",
  INSPECTED: "Inspected",
  REFUNDED: "Refunded",
  REJECTED: "Rejected",
};

const REASON_LABEL: Record<ReturnReason, string> = {
  WRONG_ITEM: "Wrong item",
  DAMAGED: "Damaged in transit",
  DEFECTIVE: "Defective on arrival",
  NOT_AS_DESCRIBED: "Not as described",
  CHANGED_MIND: "Changed mind",
  ORDERING_ERROR: "Ordering error",
  OTHER: "Other",
};

export default function AdminReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const toast = useToast();
  const confirm = useConfirm();

  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editable fields
  const [adminNote, setAdminNote] = useState("");
  const [refundMethod, setRefundMethod] = useState("NONE");
  const [refundAmount, setRefundAmount] = useState("0");
  const [externalRefundId, setExternalRefundId] = useState("");
  const [restockOnReceive, setRestockOnReceive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/shop/returns/${id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as ReturnDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || "Failed to load");
        if (cancelled) return;
        setRet(data);
        setAdminNote(data.adminNote ?? "");
        setRefundMethod(data.refundMethod);
        setRefundAmount(String(data.refundAmount));
        setExternalRefundId(data.externalRefundId ?? "");
        setRestockOnReceive(data.restockOnReceive);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function handleStatusTransition(nextStatus: ReturnStatus) {
    if (!ret) return;
    const dangerous = nextStatus === "REJECTED" || nextStatus === "REFUNDED";
    if (dangerous) {
      const ok = await confirm({
        tone: nextStatus === "REFUNDED" ? "warning" : "danger",
        title: nextStatus === "REFUNDED" ? `Mark RMA refunded?` : `Reject RMA?`,
        description:
          nextStatus === "REFUNDED"
            ? `This will record a refund of ${formatMoney(ret.refundAmount, ret.currency)} via ${refundMethod}. The Stripe refund itself must be triggered separately if applicable.`
            : "The RMA will be closed and the customer notified. Cannot be undone.",
        confirmLabel: nextStatus === "REFUNDED" ? "Mark refunded" : "Reject",
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/shop/returns/${ret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(nextStatus === "REFUNDED"
            ? { externalRefundId, refundMethod, refundAmount: parseFloat(refundAmount) }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Could not update status", data.error || "Try again");
        return;
      }
      toast.success(`RMA → ${STATUS_LABEL[nextStatus]}`);
      setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNotes() {
    if (!ret) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/shop/returns/${ret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNote: adminNote.trim() || null,
          refundMethod,
          refundAmount: parseFloat(refundAmount),
          externalRefundId: externalRefundId.trim() || null,
          restockOnReceive,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error("Could not save", data.error || "Try again");
        return;
      }
      toast.success("RMA updated");
      setReloadKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="space-y-3">
          <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/6" />
          <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/6" />
        </div>
      </AdminPage>
    );
  }

  if (!ret) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error || "Return not found"}</AdminInlineAlert>
      </AdminPage>
    );
  }

  const isB2B = ret.order.customerGroupSnapshot.startsWith("B2B");

  return (
    <AdminPage className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href="/admin/shop/returns"
          className="inline-flex items-center gap-1 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to returns
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Operations"
        title={ret.rmaNumber}
        description={`Return for order ${ret.order.orderNumber} · ${ret.order.customerName}`}
        actions={
          <>
            <AdminStatusBadge tone={statusTone(ret.status)}>
              {STATUS_LABEL[ret.status]}
            </AdminStatusBadge>
            {isB2B ? (
              <span className="rounded-full border border-blue-500/25 bg-blue-500/8 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                B2B
              </span>
            ) : null}
          </>
        }
      />

      {/* Status workflow */}
      <AdminInspectorCard
        title="Status workflow"
        description="Move the RMA through the pipeline. Each transition is logged and may trigger restock or refund."
      >
        <div className="flex flex-wrap gap-2">
          {ret.allowedNextStatuses.length === 0 ? (
            <div className="text-sm text-zinc-500">Closed — no transitions available.</div>
          ) : (
            ret.allowedNextStatuses.map((next) => (
              <button
                key={next}
                type="button"
                onClick={() => void handleStatusTransition(next)}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                  next === "REFUNDED"
                    ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/15"
                    : next === "REJECTED"
                      ? "border-red-500/30 bg-red-500/8 text-red-300 hover:bg-red-500/15"
                      : "border-blue-500/25 bg-blue-500/8 text-blue-300 hover:bg-blue-500/15"
                }`}
              >
                {next === "REFUNDED" ? (
                  <Check className="h-4 w-4" />
                ) : next === "REJECTED" ? (
                  <X className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {STATUS_LABEL[next]}
              </button>
            ))
          )}
        </div>
      </AdminInspectorCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Items being returned */}
          <AdminTableShell>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-medium text-zinc-100">Returned items</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Reason: <b>{REASON_LABEL[ret.reason]}</b>
                {ret.reasonNote ? ` · ${ret.reasonNote}` : ""}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Qty</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Refund</th>
                    <th className="px-4 py-3 font-medium">Restocked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {ret.items.map((it) => (
                    <tr key={it.id} className="hover:bg-white/3">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-100">{it.title}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
                          {it.productSlug}
                        </div>
                        {it.conditionNote ? (
                          <div className="mt-1 text-xs italic text-zinc-500">
                            {it.conditionNote}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">{it.quantity}</td>
                      <td className="px-4 py-3 text-zinc-300 tabular-nums">
                        {formatMoney(it.unitPrice, ret.currency)}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-100 tabular-nums">
                        {formatMoney(it.refundAmount, ret.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {it.restockedAt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                            <Check className="h-3 w-3" />
                            {new Date(it.restockedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/3">
                    <td
                      colSpan={3}
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500"
                    >
                      Total refund
                    </td>
                    <td colSpan={2} className="px-4 py-3 font-bold text-emerald-300 tabular-nums">
                      {formatMoney(ret.refundAmount, ret.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </AdminTableShell>

          {/* Refund settings */}
          <AdminInspectorCard
            title="Refund settings"
            description="Method, amount, and external refund tracking."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelectField
                label="Refund method"
                value={refundMethod}
                onChange={setRefundMethod}
                options={[
                  { value: "NONE", label: "None (replacement only)" },
                  { value: "STRIPE_REFUND", label: "Stripe refund (B2C)" },
                  { value: "STORE_CREDIT", label: "Store credit (B2B)" },
                  { value: "BANK_TRANSFER", label: "Bank transfer (B2B)" },
                  { value: "REPLACEMENT", label: "Replacement shipment" },
                ]}
              />
              <AdminInputField
                label={`Refund amount (${ret.currency})`}
                value={refundAmount}
                onChange={setRefundAmount}
                type="number"
                step="0.01"
                min={0}
              />
              <AdminInputField
                label="External refund ID"
                value={externalRefundId}
                onChange={setExternalRefundId}
                placeholder="e.g. Stripe re_..."
              />
              <AdminCheckboxField
                label="Restock on RECEIVED"
                checked={restockOnReceive}
                onChange={setRestockOnReceive}
              />
            </div>
            <div className="mt-4">
              <AdminTextareaField
                label="Internal admin note"
                value={adminNote}
                onChange={setAdminNote}
                rows={3}
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleSaveNotes()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </AdminInspectorCard>

          {/* Customer note */}
          {ret.customerNote ? (
            <AdminInspectorCard
              title="Customer note"
              description="What the customer wrote when requesting the return."
            >
              <div className="rounded-none border border-white/5 bg-[#171717] p-4 text-sm leading-6 text-zinc-300">
                {ret.customerNote}
              </div>
            </AdminInspectorCard>
          ) : null}
        </div>

        <aside className="space-y-4">
          <AdminInspectorCard title="Order context">
            <AdminKeyValueGrid
              rows={[
                { label: "Order #", value: ret.order.orderNumber },
                { label: "Customer", value: ret.order.customerName },
                { label: "Email", value: ret.order.email },
                { label: "Group", value: ret.order.customerGroupSnapshot },
                { label: "Order total", value: formatMoney(ret.order.total, ret.order.currency) },
                { label: "Paid", value: formatMoney(ret.order.amountPaid, ret.order.currency) },
                { label: "Order date", value: new Date(ret.order.createdAt).toLocaleDateString() },
              ]}
            />
            <Link
              href={`/admin/shop/orders/${ret.order.id}`}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/6"
            >
              Open original order
            </Link>
          </AdminInspectorCard>

          <AdminInspectorCard title="Timeline">
            <AdminKeyValueGrid
              rows={[
                { label: "Requested", value: new Date(ret.createdAt).toLocaleString() },
                {
                  label: "Approved",
                  value: ret.approvedAt ? new Date(ret.approvedAt).toLocaleString() : "—",
                },
                {
                  label: "Received",
                  value: ret.receivedAt ? new Date(ret.receivedAt).toLocaleString() : "—",
                },
                {
                  label: "Refunded",
                  value: ret.refundedAt ? new Date(ret.refundedAt).toLocaleString() : "—",
                },
              ]}
            />
          </AdminInspectorCard>

          <AdminInspectorCard title="Activity" description="All admin actions on this RMA.">
            <AdminActivityTimeline
              entityType="shop.return"
              entityId={ret.id}
              emptyTitle="No activity logged"
              emptyDescription="Status transitions and edits will appear here."
            />
          </AdminInspectorCard>
        </aside>
      </div>
    </AdminPage>
  );
}
