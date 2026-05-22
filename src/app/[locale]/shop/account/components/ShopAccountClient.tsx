"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Search, RefreshCw, User, Phone, Mail, MessageSquare } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { SupportedLocale } from "@/lib/seo";
import { formatShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { formatShopOrderStatus, shopOrderStatusBadgeClass } from "@/lib/shopOrderPresentation";
import {
  airtableOrderStatusBadgeClass,
  classifyCrmBalance,
  formatAirtableOrderStatus,
  normalizeAirtableOrderStatus,
} from "@/lib/airtableCrmStatus";

type Props = {
  locale: SupportedLocale;
  profile: {
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    companyName: string | null;
    vatNumber: string | null;
    group: "B2C" | "B2B_PENDING" | "B2B_APPROVED";
    b2bDiscountPercent: number | null;
    preferredLocale: string;
    defaultShippingAddress: {
      label: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      postcode: string | null;
      country: string;
    } | null;
    orders: Array<{
      orderNumber: string;
      status: string;
      currency: string;
      total: number;
      createdAt: string;
      itemCount: number;
      previewItem: {
        title: string;
        image: string | null;
      } | null;
      items: Array<{
        slug: string;
        quantity: number;
        variantId: string | null;
        title: string;
      }>;
    }>;
  };
};

function groupLabel(locale: SupportedLocale, group: Props["profile"]["group"]) {
  if (locale === "ua") {
    if (group === "B2B_APPROVED") return "B2B схвалено";
    if (group === "B2B_PENDING") return "B2B на розгляді";
    return "B2C";
  }
  if (group === "B2B_APPROVED") return "B2B approved";
  if (group === "B2B_PENDING") return "B2B pending";
  return "B2C";
}

export default function ShopAccountClient({ locale, profile: initialProfile }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [submittingB2B, setSubmittingB2B] = useState(false);
  const [b2bMessage, setB2BMessage] = useState("");
  const [profileGroup, setProfileGroup] = useState<Props["profile"]["group"]>(initialProfile.group);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "web" | "crm" | "active" | "completed">("all");
  const [reorderingOrderNumber, setReorderingOrderNumber] = useState<string | null>(null);

  // Profile edit modal state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: initialProfile.firstName,
    lastName: initialProfile.lastName,
    phone: initialProfile.phone ?? "",
    companyName: initialProfile.companyName ?? "",
    vatNumber: initialProfile.vatNumber ?? "",
    preferredLocale: initialProfile.preferredLocale,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  function openProfileEditor() {
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? "",
      companyName: profile.companyName ?? "",
      vatNumber: profile.vatNumber ?? "",
      preferredLocale: profile.preferredLocale,
    });
    setProfileError("");
    setEditingProfile(true);
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const response = await fetch("/api/shop/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProfileError(
          (data as { error?: string }).error ||
            (isUa ? "Не вдалося зберегти профіль" : "Failed to save profile")
        );
        return;
      }
      const updated = data as Props["profile"];
      setProfile(updated);
      setProfileGroup(updated.group);
      setEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  }

  // CRM orders from Airtable
  type CrmOrder = {
    id: string;
    number: number;
    name: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    clientTotal: number;
    tag: string;
    orderDate: string | null;
    itemCount: number;
    items: Array<{
      productName: string;
      brand: string;
      quantity: number;
      price: number;
      total: number;
    }>;
  };
  const [crmOrders, setCrmOrders] = useState<CrmOrder[]>([]);
  const [crmBalance, setCrmBalance] = useState<number>(0);
  const [crmLoading, setCrmLoading] = useState(true);
  const [expandedCrmOrder, setExpandedCrmOrder] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop/account/crm-orders")
      .then((r) => r.json())
      .then((d) => {
        setCrmOrders(d.data || []);
        setCrmBalance(d.balance || 0);
      })
      .catch(() => {})
      .finally(() => setCrmLoading(false));
  }, []);

  const balanceWho = classifyCrmBalance(crmBalance);
  const balanceLabel =
    balanceWho === "balanced"
      ? isUa
        ? "Розрахунки збігаються"
        : "Balanced"
      : balanceWho === "client_owes"
        ? isUa
          ? "Клієнт винен"
          : "Customer owes"
        : isUa
          ? "Ми винні"
          : "We owe";

  // First-cabinet-visit banner: when register API reports past guest orders
  // that auto-link to this email, surface the count so the customer knows
  // why their order history isn't empty.
  const [claimedOrdersCount, setClaimedOrdersCount] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("shop.account.claimedOrdersCount");
      const parsed = raw ? Number(raw) : 0;
      if (Number.isFinite(parsed) && parsed > 0) setClaimedOrdersCount(parsed);
    } catch {
      // ignore
    }
  }, []);
  function dismissClaimedOrdersBanner() {
    setClaimedOrdersCount(null);
    try {
      sessionStorage.removeItem("shop.account.claimedOrdersCount");
    } catch {
      // ignore
    }
  }
  const signOutCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/shop/account/login`
      : `/${locale}/shop/account/login`;

  async function handleApplyB2B() {
    setSubmittingB2B(true);
    setB2BMessage("");
    try {
      const response = await fetch("/api/shop/account/apply-b2b", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setB2BMessage(
          data.error || (isUa ? "Не вдалося надіслати заявку" : "Failed to submit request")
        );
        return;
      }
      if (data.group === "B2B_PENDING" || data.group === "B2B_APPROVED") {
        setProfileGroup(data.group);
      }
      setB2BMessage(
        isUa
          ? "B2B заявку надіслано. Менеджер перевірить акаунт."
          : "B2B request submitted. Our team will review your account."
      );
    } finally {
      setSubmittingB2B(false);
    }
  }

  async function handleReorder(orderNumber: string, items: Props["profile"]["orders"][0]["items"]) {
    if (reorderingOrderNumber) return;
    setReorderingOrderNumber(orderNumber);
    try {
      const payload = {
        items: items.map((i) => ({
          slug: i.slug,
          quantity: i.quantity,
          variantId: i.variantId || null,
        })),
      };
      const response = await fetch("/api/shop/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        router.push(`/${locale}/shop/cart`);
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(
          data.error || (isUa ? "Не вдалося повторити замовлення" : "Failed to repeat the order")
        );
      }
    } catch (error) {
      console.error("Reorder error:", error);
      alert(
        isUa
          ? "Виникла помилка при повторенні замовлення"
          : "An error occurred while repeating the order"
      );
    } finally {
      setReorderingOrderNumber(null);
    }
  }

  // Filtered orders
  const filteredWebOrders = profile.orders.filter((order) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.previewItem?.title &&
        order.previewItem.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.items.some((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "crm") return false;
    if (activeTab === "active") {
      return !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status);
    }
    if (activeTab === "completed") {
      return ["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status);
    }
    return true;
  });

  const filteredCrmOrders = crmOrders.filter((order) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      `#${order.number}`.includes(searchQuery) ||
      String(order.number).includes(searchQuery) ||
      order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.items &&
        order.items.some((item) =>
          item.productName.toLowerCase().includes(searchQuery.toLowerCase())
        ));

    if (!matchesSearch) return false;

    if (activeTab === "web") return false;
    const statusKind = normalizeAirtableOrderStatus(order.orderStatus);
    if (activeTab === "active") {
      return statusKind === "in_progress" || statusKind === "unknown";
    }
    if (activeTab === "completed") {
      return statusKind === "completed" || statusKind === "cancelled";
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-background text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(120,120,120,0.16),transparent_30%),linear-gradient(180deg,#070707_0%,#0f0f0f_55%,#050505_100%)]">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-6 md:pt-40 lg:pt-44">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-foreground/65 dark:text-foreground/45">
              {isUa ? "Акаунт клієнта" : "Customer account"}
            </p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl truncate">
              {profile.fullName}
            </h1>
            <p className="mt-2 text-sm text-foreground/70 dark:text-foreground/55 truncate">
              {profile.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors duration-300 ${
                profileGroup === "B2B_APPROVED"
                  ? "border-[#c29d59]/40 bg-[#c29d59]/10 text-[#c29d59]"
                  : "border-foreground/15 bg-foreground/5 text-foreground/85 dark:text-foreground/70"
              }`}
            >
              {groupLabel(locale, profileGroup)}
            </span>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: signOutCallbackUrl })}
              className="rounded-full border border-foreground/15 bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-primary/90"
            >
              {isUa ? "Вийти" : "Sign out"}
            </button>
          </div>
        </div>

        {claimedOrdersCount && claimedOrdersCount > 0 ? (
          <div className="mb-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/6 px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-emerald-100">
                {isUa
                  ? `Ми знайшли ${claimedOrdersCount} попередніх замовлень на цей email і прив'язали їх до акаунта.`
                  : `We linked ${claimedOrdersCount} past orders on this email to your account.`}
              </p>
              <p className="mt-1 text-[11px] text-emerald-100/55">
                {isUa
                  ? "Тепер ви можете бачити їх історію в розділі «Замовлення»."
                  : "You can now see them in the Orders section."}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissClaimedOrdersBanner}
              className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-500/15"
            >
              {isUa ? "Зрозуміло" : "Got it"}
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6 rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-foreground">
                  {isUa ? "Профіль" : "Profile"}
                </h2>
                <button
                  type="button"
                  onClick={openProfileEditor}
                  className="rounded-full border border-foreground/15 bg-foreground/5 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-foreground/90 dark:text-foreground/75 transition hover:border-foreground/30 hover:text-foreground"
                >
                  {isUa ? "Редагувати" : "Edit"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoCard label="Email" value={profile.email} />
                <InfoCard label={isUa ? "Телефон" : "Phone"} value={profile.phone || "—"} />
                <InfoCard
                  label={isUa ? "Компанія" : "Company"}
                  value={profile.companyName || "—"}
                />
                <InfoCard label="VAT" value={profile.vatNumber || "—"} />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-foreground">
                {isUa ? "B2B статус" : "B2B status"}
              </h2>
              <p className="mt-2 text-sm text-foreground/70 dark:text-foreground/55">
                {profileGroup === "B2B_APPROVED"
                  ? isUa
                    ? "Для цього акаунта вже активовано B2B доступ."
                    : "This account already has B2B access."
                  : profileGroup === "B2B_PENDING"
                    ? isUa
                      ? "Заявка на B2B уже на розгляді."
                      : "Your B2B request is currently under review."
                    : isUa
                      ? "Подайте заявку, щоб отримати схвалений B2B доступ і B2B pricing."
                      : "Apply to unlock approved B2B access and B2B pricing."}
              </p>
              {profileGroup === "B2B_APPROVED" && profile.b2bDiscountPercent != null ? (
                <p className="mt-3 text-sm text-foreground/80 dark:text-foreground/65">
                  {isUa
                    ? `Персональна B2B знижка: ${profile.b2bDiscountPercent}%`
                    : `Personal B2B discount: ${profile.b2bDiscountPercent}%`}
                </p>
              ) : null}
              {profileGroup === "B2C" ? (
                <button
                  type="button"
                  onClick={() => void handleApplyB2B()}
                  disabled={submittingB2B}
                  className="mt-4 rounded-full border border-foreground/20 bg-primary px-5 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingB2B
                    ? isUa
                      ? "Надсилання…"
                      : "Submitting…"
                    : isUa
                      ? "Подати B2B заявку"
                      : "Apply for B2B"}
                </button>
              ) : null}
              {b2bMessage ? (
                <p className="mt-3 text-sm text-foreground/80 dark:text-foreground/65">
                  {b2bMessage}
                </p>
              ) : null}
            </div>

            {profileGroup === "B2B_APPROVED" && (
              <div className="rounded-2xl border border-[#c29d59]/25 bg-gradient-to-b from-[#c29d59]/5 to-transparent p-5 relative overflow-hidden shadow-lg">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#c29d59]/5 blur-xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c29d59]/30 bg-[#c29d59]/10 text-[#c29d59] font-light text-lg">
                    {isUa ? "ОК" : "AK"}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground tracking-wide">
                      {isUa ? "Олександр Ковальчук" : "Alex Kovalchuk"}
                    </h3>
                    <p className="text-[10px] uppercase tracking-wider text-[#c29d59]/75 font-semibold">
                      {isUa ? "Персональний B2B менеджер" : "Personal B2B Manager"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <a
                    href="tel:+380671234567"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 transition text-xs text-foreground/80 hover:text-foreground"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#c29d59]/80" />
                    <span>+380 (67) 123-45-67</span>
                  </a>
                  <a
                    href="mailto:b2b@onecompany.global"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 transition text-xs text-foreground/80 hover:text-foreground"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#c29d59]/80" />
                    <span>b2b@onecompany.global</span>
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="https://t.me/onecompany_b2b"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 transition text-xs text-foreground/80 hover:text-foreground"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram</span>
                    </a>
                    <a
                      href="viber://chat?number=%2B380671234567"
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 transition text-xs text-foreground/80 hover:text-foreground"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                      <span>Viber</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-medium text-foreground">{isUa ? "Баланс" : "Balance"}</h2>
              <p className="mt-1 text-xs text-foreground/60 dark:text-foreground/40">
                {isUa
                  ? "Замовлення з сайту та з CRM (sales-команда) обліковуються окремо."
                  : "Web orders and CRM (sales-team) orders are tracked separately."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 mb-8">
                {/* Web orders card */}
                <div className="rounded-2xl border border-foreground/10 bg-card/55 dark:bg-black/25 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-foreground/50 rounded-full" />
                    <p className="text-[10px] uppercase tracking-[0.22em] text-foreground/60 dark:text-foreground/40">
                      {isUa ? "З сайту" : "Web orders"}
                    </p>
                  </div>
                  <p className="text-2xl font-light text-foreground">{profile.orders.length}</p>
                  <p className="text-[11px] text-foreground/65 dark:text-foreground/45 mt-1">
                    {profile.orders.length === 0
                      ? isUa
                        ? "Замовлень ще немає"
                        : "No orders yet"
                      : isUa
                        ? `Замовлень в історії`
                        : `Orders in history`}
                  </p>
                </div>

                {/* CRM (Airtable) card */}
                <div className="rounded-2xl border border-[#c29d59]/15 bg-[#c29d59]/3 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-[#c29d59]/80 rounded-full" />
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#c29d59]/70">
                      {isUa ? "CRM (Sales)" : "CRM (Sales)"}
                    </p>
                  </div>
                  {crmLoading ? (
                    <p className="text-2xl font-light text-foreground/60 dark:text-foreground/40">
                      …
                    </p>
                  ) : (
                    <>
                      <p
                        className={`text-2xl font-light ${balanceWho === "client_owes" ? "text-red-400" : balanceWho === "we_owe" ? "text-emerald-400" : "text-foreground/85 dark:text-foreground/70"}`}
                      >
                        {crmBalance === 0
                          ? "$0"
                          : crmBalance > 0
                            ? `+$${crmBalance.toLocaleString()}`
                            : `-$${Math.abs(crmBalance).toLocaleString()}`}
                      </p>
                      <span
                        className={`mt-2 inline-block text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${
                          balanceWho === "client_owes"
                            ? "border-red-500/20 text-red-400 bg-red-500/5"
                            : balanceWho === "we_owe"
                              ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                              : "border-foreground/15 text-foreground/70 dark:text-foreground/55 bg-foreground/5"
                        }`}
                      >
                        {balanceLabel}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-medium text-foreground">
                  {isUa ? "Адреса доставки" : "Shipping address"}
                </h2>
                <Link
                  href={`/${locale}/shop/account/addresses`}
                  className="text-xs uppercase tracking-[0.18em] text-foreground/70 dark:text-foreground/55 transition hover:text-foreground"
                >
                  {isUa ? "Усі адреси →" : "All addresses →"}
                </Link>
              </div>
              {profile.defaultShippingAddress ? (
                <div className="mt-3 rounded-2xl border border-foreground/10 bg-card/55 dark:bg-black/25 p-4 text-sm text-foreground/90 dark:text-foreground/75">
                  <p>{profile.defaultShippingAddress.label}</p>
                  <p className="mt-2">{profile.defaultShippingAddress.line1}</p>
                  {profile.defaultShippingAddress.line2 ? (
                    <p>{profile.defaultShippingAddress.line2}</p>
                  ) : null}
                  <p>
                    {profile.defaultShippingAddress.city}
                    {profile.defaultShippingAddress.region
                      ? `, ${profile.defaultShippingAddress.region}`
                      : ""}
                    {profile.defaultShippingAddress.postcode
                      ? ` ${profile.defaultShippingAddress.postcode}`
                      : ""}
                  </p>
                  <p>{profile.defaultShippingAddress.country}</p>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-foreground/15 bg-card/55 dark:bg-black/25 p-4 text-sm text-foreground/70 dark:text-foreground/55">
                  <p>
                    {isUa ? "Поки що немає збереженої адреси." : "No saved shipping address yet."}
                  </p>
                  <Link
                    href={`/${locale}/shop/account/addresses`}
                    className="mt-2 inline-block text-xs uppercase tracking-[0.18em] text-primary hover:text-foreground transition"
                  >
                    {isUa ? "Додати адресу →" : "Add address →"}
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-foreground/10 bg-foreground/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] flex flex-col">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  {isUa ? "Замовлення" : "Orders"}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-foreground/55 dark:text-foreground/35">
                  {isUa ? "Історія покупок Urban Automotive" : "Urban Automotive purchase history"}
                </p>
              </div>
              <Link
                href={`/${locale}/shop/urban/collections`}
                className="text-sm text-foreground/70 dark:text-foreground/55 hover:text-foreground"
              >
                {isUa ? "До покупок" : "Continue shopping"}
              </Link>
            </div>

            {/* Search Input */}
            <div className="mt-6 relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-4 w-4 text-foreground/45 dark:text-foreground/30" />
              </div>
              <input
                type="text"
                placeholder={
                  isUa
                    ? "Пошук замовлень за номером чи товаром..."
                    : "Search orders by number or item..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-foreground/10 bg-card/40 dark:bg-black/25 pl-11 pr-16 py-3 text-sm text-foreground placeholder:text-foreground/45 transition-all focus:border-[#c29d59]/50 focus:bg-card/70 dark:focus:bg-black/45 focus:outline-none focus:ring-1 focus:ring-[#c29d59]/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs text-foreground/45 hover:text-foreground transition-colors"
                >
                  {isUa ? "Очистити" : "Clear"}
                </button>
              )}
            </div>

            {/* Sliding Tabs */}
            <div className="mt-4 flex flex-wrap gap-1 border-b border-foreground/10 pb-2">
              {(
                [
                  { id: "all", label: isUa ? "Усі" : "All" },
                  { id: "web", label: isUa ? "З сайту" : "Web" },
                  { id: "crm", label: isUa ? "CRM" : "CRM" },
                  { id: "active", label: isUa ? "Активні" : "Active" },
                  { id: "completed", label: isUa ? "Виконані" : "Completed" },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4.5 py-2 text-xs uppercase tracking-wider rounded-xl transition-all duration-200 focus:outline-none ${
                      isActive
                        ? "text-[#c29d59] font-medium"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 rounded-xl bg-[#c29d59]/10 border border-[#c29d59]/30 z-0"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Orders Feed */}
            <div className="mt-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {filteredWebOrders.length > 0 && (
                  <motion.div
                    key="web-orders-section"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-1.5 h-1.5 bg-[#c29d59] rounded-full" />
                      <h3 className="text-[10px] uppercase tracking-widest text-foreground/55 dark:text-foreground/35 font-medium">
                        {isUa ? "Замовлення з сайту" : "Web Orders"}
                      </h3>
                      <span className="text-[9px] text-foreground/45 dark:text-foreground/25 font-mono">
                        ({filteredWebOrders.length})
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {filteredWebOrders.map((order) => (
                        <motion.li
                          key={order.orderNumber}
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden rounded-[26px] border border-foreground/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-4 shadow-md transition-all hover:border-foreground/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))]"
                        >
                          <Link
                            href={`/${locale}/shop/account/orders/${order.orderNumber}`}
                            className="block group/link"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 items-start gap-4">
                                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[22px] border border-foreground/10 bg-foreground/5 shadow-inner">
                                  {order.previewItem?.image ? (
                                    <Image
                                      src={order.previewItem.image}
                                      alt={order.previewItem.title}
                                      fill
                                      className="object-cover transition-transform duration-500 group-hover/link:scale-105"
                                      sizes="72px"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.22em] text-foreground/45 dark:text-foreground/30">
                                      OC
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-mono text-sm text-foreground group-hover/link:text-[#c29d59] transition-colors">
                                      {order.orderNumber}
                                    </div>
                                    <span className="text-[10px] text-foreground/30">•</span>
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/60 dark:text-foreground/45">
                                      {new Intl.DateTimeFormat(
                                        locale === "ua" ? "uk-UA" : "en-US",
                                        {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        }
                                      ).format(new Date(order.createdAt))}
                                    </div>
                                  </div>
                                  <div className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-foreground dark:text-foreground/80 group-hover/link:text-foreground transition-colors">
                                    {order.previewItem?.title ||
                                      (isUa
                                        ? "Замовлення без прев’ю товару"
                                        : "Order without preview item")}
                                  </div>
                                  {order.itemCount > 1 && (
                                    <div className="mt-1.5 text-xs uppercase tracking-[0.18em] text-foreground/50">
                                      {isUa
                                        ? `Ще ${order.itemCount - 1} позицій`
                                        : `${order.itemCount - 1} more items`}
                                    </div>
                                  )}
                                  <div className="mt-3">
                                    <span
                                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-semibold ${shopOrderStatusBadgeClass(order.status)}`}
                                    >
                                      {formatShopOrderStatus(locale, order.status)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                                  {isUa ? "Разом" : "Total"}
                                </div>
                                <div className="mt-1 text-base font-semibold text-foreground">
                                  {formatShopMoney(
                                    locale,
                                    order.total,
                                    order.currency as ShopCurrencyCode
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-foreground/55">
                                  {order.itemCount}{" "}
                                  {isUa
                                    ? order.itemCount === 1
                                      ? "товар"
                                      : "товари"
                                    : order.itemCount === 1
                                      ? "item"
                                      : "items"}
                                </div>
                              </div>
                            </div>
                          </Link>

                          <div className="mt-4 pt-3 border-t border-foreground/5 flex items-center justify-between gap-3">
                            <Link
                              href={`/${locale}/shop/account/orders/${order.orderNumber}`}
                              className="text-xs uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground transition-colors"
                            >
                              {isUa ? "Деталі замовлення →" : "Order details →"}
                            </Link>

                            <button
                              type="button"
                              onClick={() => void handleReorder(order.orderNumber, order.items)}
                              disabled={reorderingOrderNumber !== null}
                              className="inline-flex items-center gap-2 rounded-full border border-[#c29d59]/30 hover:border-[#c29d59]/60 bg-[#c29d59]/10 hover:bg-[#c29d59]/20 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#c29d59] transition-all disabled:opacity-50"
                            >
                              {reorderingOrderNumber === order.orderNumber ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span>{isUa ? "Повторити" : "Reorder"}</span>
                            </button>
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {filteredCrmOrders.length > 0 && (
                  <motion.div
                    key="crm-orders-section"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-1.5 h-1.5 bg-[#c29d59]/60 rounded-full" />
                      <h3 className="text-[10px] uppercase tracking-widest text-foreground/55 dark:text-foreground/35 font-medium">
                        {isUa ? "CRM Замовлення (Sales)" : "CRM Orders (Sales)"}
                      </h3>
                      <span className="text-[9px] text-foreground/45 dark:text-foreground/25 font-mono">
                        ({filteredCrmOrders.length})
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {filteredCrmOrders.map((o) => {
                        const statusKind = normalizeAirtableOrderStatus(o.orderStatus);
                        const statusLabel = formatAirtableOrderStatus(
                          statusKind,
                          locale,
                          o.orderStatus
                        );
                        const statusBadgeClass = airtableOrderStatusBadgeClass(statusKind);
                        const isExpanded = expandedCrmOrder === o.id;

                        return (
                          <motion.li
                            key={o.id}
                            layout
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 cursor-pointer transition hover:bg-foreground/[0.04] hover:border-[#c29d59]/25"
                            onClick={() => setExpandedCrmOrder(isExpanded ? null : o.id)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-foreground font-semibold">
                                    #{o.number}
                                  </span>
                                  <span
                                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-bold ${statusBadgeClass}`}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-foreground/75 dark:text-foreground/60 truncate">
                                  {o.name}
                                </p>
                                {o.orderDate && (
                                  <p className="text-[10px] text-foreground/45 dark:text-foreground/30 mt-1">
                                    {new Date(o.orderDate).toLocaleDateString(
                                      locale === "ua" ? "uk-UA" : "en-US",
                                      {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      }
                                    )}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-semibold text-foreground">
                                  ${o.clientTotal.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-foreground/55 mt-0.5">
                                  {o.itemCount}{" "}
                                  {isUa
                                    ? o.itemCount === 1
                                      ? "позиція"
                                      : "позицій"
                                    : o.itemCount === 1
                                      ? "item"
                                      : "items"}
                                </div>
                                <div className="text-[9px] text-[#c29d59]/70 mt-1.5 transition-transform duration-300">
                                  {isExpanded ? "▲" : "▼"}
                                </div>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {isExpanded && o.items && o.items.length > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 pt-3 border-t border-[#c29d59]/10 space-y-2.5">
                                    {o.items.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <span className="text-foreground/90 dark:text-foreground/75 font-medium">
                                            {item.productName}
                                          </span>
                                          {item.brand && (
                                            <span className="text-foreground/55 dark:text-foreground/35 ml-1.5 text-[10px] uppercase font-mono">
                                              ({item.brand})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-foreground/60 dark:text-foreground/45 shrink-0 text-right">
                                          {item.quantity} × ${item.price.toLocaleString()}
                                        </div>
                                        <div className="text-foreground/90 dark:text-foreground/75 font-semibold shrink-0 w-20 text-right font-mono">
                                          ${item.total.toLocaleString()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}

                {filteredWebOrders.length === 0 && filteredCrmOrders.length === 0 && (
                  <motion.div
                    key="no-orders"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="text-center py-16 rounded-[28px] border border-dashed border-foreground/10 bg-foreground/2 shadow-inner"
                  >
                    <ShoppingBag className="w-8 h-8 text-foreground/30 mx-auto mb-3 stroke-[1.2]" />
                    <p className="text-sm text-foreground/70 dark:text-foreground/55 font-medium">
                      {isUa ? "Не знайдено замовлень" : "No orders found"}
                    </p>
                    <p className="text-xs text-foreground/45 dark:text-foreground/30 mt-1">
                      {isUa
                        ? "Спробуйте змінити запит пошуку або фільтр"
                        : "Try changing your search query or filter"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>

      {editingProfile ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 dark:bg-black/85 backdrop-blur-md px-4"
          onClick={() => !savingProfile && setEditingProfile(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[28px] border border-foreground/10 bg-[#0a0a0a] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
          >
            <h3 className="text-xl font-light tracking-tight">
              {isUa ? "Редагувати профіль" : "Edit profile"}
            </h3>
            <p className="mt-1 text-xs text-foreground/65 dark:text-foreground/45">
              {isUa
                ? "Email не редагується — для зміни email зверніться у підтримку."
                : "Email cannot be edited here — contact support to change it."}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ProfileField
                label={isUa ? "Імʼя" : "First name"}
                value={profileForm.firstName}
                onChange={(v) => setProfileForm((f) => ({ ...f, firstName: v }))}
                required
              />
              <ProfileField
                label={isUa ? "Прізвище" : "Last name"}
                value={profileForm.lastName}
                onChange={(v) => setProfileForm((f) => ({ ...f, lastName: v }))}
                required
              />
              <ProfileField
                label={isUa ? "Телефон" : "Phone"}
                value={profileForm.phone}
                onChange={(v) => setProfileForm((f) => ({ ...f, phone: v }))}
              />
              <ProfileField
                label={isUa ? "Компанія" : "Company"}
                value={profileForm.companyName}
                onChange={(v) => setProfileForm((f) => ({ ...f, companyName: v }))}
              />
              <ProfileField
                label="VAT"
                value={profileForm.vatNumber}
                onChange={(v) => setProfileForm((f) => ({ ...f, vatNumber: v }))}
              />
              <label className="block">
                <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
                  {isUa ? "Бажана мова" : "Preferred language"}
                </span>
                <select
                  value={profileForm.preferredLocale}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, preferredLocale: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-4 py-3 text-sm text-foreground backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="ua">UA · Українська</option>
                  <option value="en">EN · English</option>
                </select>
              </label>
            </div>

            {profileError ? (
              <p className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {profileError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => setEditingProfile(false)}
                className="rounded-full border border-foreground/15 px-5 py-2 text-xs uppercase tracking-[0.18em] text-foreground/85 dark:text-foreground/70 transition hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
              >
                {isUa ? "Скасувати" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void saveProfile()}
                className="rounded-full border border-primary bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {savingProfile ? (isUa ? "Збереження…" : "Saving…") : isUa ? "Зберегти" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-foreground/65 dark:text-foreground/45">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-foreground/10 bg-card/70 dark:bg-black/40 px-4 py-3 text-sm text-foreground placeholder:text-foreground/55 dark:placeholder:text-foreground/30 backdrop-blur-md transition-all focus:border-primary/50 focus:bg-card/85 dark:focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card/55 dark:bg-black/25 p-4 overflow-hidden">
      <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40">
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground dark:text-foreground/80 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
