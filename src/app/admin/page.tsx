"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  FilePlus2,
  Layers3,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Users,
  AlertCircle,
} from "lucide-react";
import { DASHBOARD_ORDER_STATUS, type DashboardOverview } from "@/lib/admin/dashboardOverview";
import styles from "./overview.module.css";

const date = (value: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
const number = (value: number) => value.toLocaleString("uk-UA");
function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${number(value)} ${currency}`;
  }
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dashboard?view=overview", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Сесія завершилася. Оновіть сторінку та увійдіть знову."
            : response.status === 403
              ? "Немає доступу до огляду."
              : "Не вдалося оновити дані. Спробуйте ще раз."
        );
      const payload: DashboardOverview = await response.json();
      if (!controller.signal.aborted) setData(payload);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Помилка завантаження.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !requestRef.current?.signal.aborted)
        void refresh();
    }, 120_000);
    return () => {
      window.clearInterval(timer);
      requestRef.current?.abort();
    };
  }, [refresh]);

  const counts = data?.orders.counts ?? {};
  const metrics = [
    {
      label: "На перевірці",
      value: counts.PENDING_REVIEW ?? 0,
      note: "Переглянути нові замовлення",
      icon: ShoppingBag,
      href: "#recent-orders",
      accent: true,
    },
    {
      label: "Очікують оплату",
      value: counts.PENDING_PAYMENT ?? 0,
      note: "Статус замовлення",
      icon: Clock3,
      href: "#recent-orders",
    },
    {
      label: "У роботі",
      value: (counts.CONFIRMED ?? 0) + (counts.PROCESSING ?? 0),
      note: "Підтверджені та в обробці",
      icon: Package,
      href: "#recent-orders",
    },
    {
      label: "B2B на розгляді",
      value: data?.customers.pendingCount ?? 0,
      note: "Усі активні заявки",
      icon: Users,
      href: "#b2b-requests",
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            ONECOMPANY <span>/</span> ОГЛЯД
          </p>
          <h1>Робочий стіл</h1>
          <p className={styles.subtitle}>
            Замовлення, клієнти та каталог — усе для початку роботи.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refresh}
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Оновити огляд"
          >
            <RefreshCw size={16} className={loading ? styles.spin : undefined} />
          </button>
          <Link className={styles.primary} href="/admin/shop/orders/create">
            <Plus size={17} /> Нове замовлення
          </Link>
        </div>
      </header>

      <div className={styles.dateline}>
        <span>
          {data ? date(data.updatedAt) : loading ? "Завантаження огляду" : "Огляд недоступний"}
        </span>
        <span aria-live="polite">
          {loading
            ? "Оновлюємо дані…"
            : error
              ? "Дані не оновлено"
              : data
                ? `Оновлено о ${new Date(data.updatedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })} · Київ`
                : ""}
        </span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} />
          <span>
            {error}
            {data ? " Нижче — останні завантажені дані." : ""}
          </span>
          <button onClick={() => void refresh()} disabled={loading}>
            Повторити
          </button>
        </div>
      )}

      <section className={styles.focus} aria-labelledby="focus-heading">
        <div className={styles.sectionHeading}>
          <h2 id="focus-heading">У фокусі</h2>
          <span>Замовлення за останні 30 днів</span>
        </div>
        <div className={styles.metrics}>
          {metrics.map(({ label, value, note, icon: Icon, href, accent }) => (
            <a
              href={href}
              key={label}
              className={`${styles.metric} ${accent ? styles.metricAccent : ""}`}
            >
              <div className={styles.metricTop}>
                <span>{label}</span>
                <Icon size={18} />
              </div>
              <strong>{data ? number(value) : "—"}</strong>
              <div className={styles.metricBottom}>
                <span>{note}</span>
                <ArrowDownLeft size={15} />
              </div>
            </a>
          ))}
        </div>
      </section>

      <div className={styles.columns}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} id="recent-orders" aria-labelledby="orders-heading">
            <div className={styles.panelHeading}>
              <div>
                <h2 id="orders-heading">Останні замовлення</h2>
                <p>За 30 днів · суми у валюті замовлення</p>
              </div>
              <Link href="/admin/shop/orders" className={styles.textLink}>
                Усі <ArrowUpRight size={15} />
              </Link>
            </div>
            {!data ? (
              <div className={styles.empty}>
                {loading ? "Завантажуємо замовлення…" : "Замовлення недоступні"}
              </div>
            ) : data.orders.recent.length === 0 ? (
              <div className={styles.empty}>
                <ShoppingBag size={25} />
                <h3>Поки немає нових замовлень</h3>
                <p>За останні 30 днів записи відсутні. Попередні доступні в центрі замовлень.</p>
                <Link href="/admin/shop/orders">
                  Відкрити центр замовлень <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <div className={styles.orders}>
                <div className={styles.tableHeading}>
                  <span>Замовлення / клієнт</span>
                  <span>Статус</span>
                  <span>Сума</span>
                  <span />
                </div>
                {data.orders.recent.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/shop/orders/${order.id}`}
                    className={styles.orderRow}
                  >
                    <div className={styles.orderIdentity}>
                      <span className={styles.orderNumber}>{order.number}</span>
                      <strong>{order.customer || "Клієнт без імені"}</strong>
                      <small>
                        {date(order.createdAt)} · Позицій: {order.itemCount}
                      </small>
                    </div>
                    <span
                      className={`${styles.status} ${["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status) ? styles.statusPending : ""}`}
                    >
                      {DASHBOARD_ORDER_STATUS[order.status] ?? order.status}
                    </span>
                    <span className={styles.orderAmount}>{money(order.total, order.currency)}</span>
                    <ArrowUpRight className={styles.rowArrow} size={17} />
                  </Link>
                ))}
              </div>
            )}
            {data && data.orders.olderOpen > 0 && (
              <div className={styles.archiveNote}>
                <Clock3 size={17} />
                <p>
                  <strong>
                    {number(data.orders.olderOpen)} незакритих замовлень старше 30 днів.
                  </strong>
                  <span>
                    Вони не входять у показники вище. Перевірте актуальність їхніх статусів.
                  </span>
                </p>
                <Link href="/admin/shop/orders" aria-label="Переглянути старі замовлення">
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="catalog-heading">
            <div className={styles.panelHeading}>
              <div>
                <h2 id="catalog-heading">Каталог</h2>
                <p>Поточний стан та останні зміни товарів</p>
              </div>
              <Link href="/admin/shop" className={styles.textLink}>
                Відкрити <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className={styles.catalogTotals}>
              <div>
                <span className={styles.dot} />
                <strong>{data ? number(data.catalog.published) : "—"}</strong>
                <span>Опубліковано</span>
              </div>
              <div>
                <strong>{data ? number(data.catalog.unpublished) : "—"}</strong>
                <span>Не опубліковано</span>
              </div>
            </div>
            <p className={styles.listLabel}>ОСТАННІ ОНОВЛЕННЯ</p>
            {data?.catalog.recent.map((product) => (
              <Link
                key={product.id}
                href={`/admin/shop/${product.id}`}
                className={styles.productRow}
              >
                <span className={styles.productIcon}>
                  <Package size={18} />
                </span>
                <span className={styles.productCopy}>
                  <strong>{product.title}</strong>
                  <small>
                    {product.brand || "Без бренду"} <span>·</span> {date(product.updatedAt)}{" "}
                    <span>·</span> {product.published ? "Опубліковано" : "Не опубліковано"}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {data && !data.catalog.recent.length && (
              <p className={styles.empty}>Товарів поки немає.</p>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.quickSection} aria-labelledby="quick-heading">
            <div className={styles.sectionHeading}>
              <h2 id="quick-heading">Швидкі дії</h2>
              <ArrowUpRight size={16} />
            </div>
            {[
              {
                title: "Додати товар",
                note: "Нова позиція каталогу",
                href: "/admin/shop/new",
                icon: Plus,
              },
              {
                title: "Створити котирування",
                note: "Чернетка для клієнта",
                href: "/admin/shop/drafts/new",
                icon: FilePlus2,
              },
              {
                title: "Клієнти",
                note: "Контакти та B2B-доступ",
                href: "/admin/shop/customers",
                icon: Users,
              },
              {
                title: "Колекції",
                note: "Добірки товарів",
                href: "/admin/shop/collections",
                icon: Layers3,
              },
            ].map(({ title, note, href, icon: Icon }) => (
              <Link key={href} href={href} className={styles.quickLink}>
                <Icon size={19} />
                <span>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </section>

          <section className={styles.panel} id="b2b-requests" aria-labelledby="b2b-heading">
            <div className={styles.panelHeading}>
              <div>
                <h2 id="b2b-heading">B2B-заявки</h2>
                <p>Очікують вашого рішення</p>
              </div>
              <span className={styles.countBadge}>{data ? data.customers.pendingCount : "—"}</span>
            </div>
            {!data ? (
              <p className={styles.empty}>{loading ? "Завантаження…" : "Дані недоступні"}</p>
            ) : data.customers.pending.length === 0 ? (
              <div className={styles.empty}>
                <Check size={23} />
                <h3>Усе опрацьовано</h3>
                <p>Активних заявок на розгляді немає.</p>
              </div>
            ) : (
              data.customers.pending.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/admin/shop/customers/${customer.id}`}
                  className={styles.customerRow}
                >
                  <span className={styles.avatar}>
                    {(customer.company || customer.name || "B").slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{customer.company || customer.name}</strong>
                    {customer.company && <small>{customer.name}</small>}
                    <small>Заявка від {date(customer.createdAt)}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ))
            )}
            <Link className={styles.panelFooter} href="/admin/shop/customers">
              Усі клієнти <ArrowRight size={15} />
            </Link>
          </section>
          <div className={styles.note}>
            <span>ОДНЕ МІСЦЕ ДЛЯ РОБОТИ</span>
            <p>
              Детальні фінанси та історія продажів — у CRM. Тут — поточні записи й наступні дії.
            </p>
            <Link href="/admin/crm">
              Перейти до CRM <ArrowUpRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>ONECOMPANY / ADMIN</span>
        <span>Автооновлення кожні 2 хв, коли вкладка відкрита</span>
      </footer>
    </div>
  );
}
