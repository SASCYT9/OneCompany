"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Check, Loader2, LockKeyhole } from "lucide-react";
import { AdminInputField, AdminSelectField } from "@/components/admin/AdminFormFields";
import type { ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import styles from "./AdminInternationalDeliveryQuote.module.css";

type QuotePreview = {
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  regionalAdjustmentAmount?: number;
  total: number;
  shippingQuote: { amount: number; currency: ShopCurrencyCode; amountUah: number; rateToUah: number };
  ratesLocked: boolean;
};
const formatMoney = new Intl.NumberFormat("uk-UA", {
  style: "currency", currency: "UAH", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format;

function quoteError(code?: string) {
  switch (code) {
    case "INVALID_DELIVERY_QUOTE_COST": return "Введіть суму від 0, не більше двох цифр після коми.";
    case "UNSUPPORTED_SHIPPING_CURRENCY": return "Оберіть валюту доставки: USD, EUR або UAH.";
    case "DELIVERY_SHIPPING_AMOUNT_REQUIRED": return "Вкажіть суму та валюту доставки.";
    case "EXCHANGE_RATE_UNAVAILABLE": return "Курс для цієї валюти недоступний. Перевірте налаштування курсів.";
    case "DELIVERY_QUOTE_CHANGED": return "Розрахунок змінився. Перевірте нову суму й погодьте її з клієнтом.";
    case "DELIVERY_IMPORT_COST_REVIEW_REQUIRED": return "Спершу перевірте імпортні витрати цього замовлення.";
    case "ORDER_QUOTE_NOT_EDITABLE": return "Суму вже зафіксовано для оплати або замовлення оплачено. Перевірте його стан.";
    default: return "Не вдалося оновити розрахунок. Перевірте доставку та спробуйте ще раз.";
  }
}

export function AdminInternationalDeliveryQuote({
  orderId,
  shippingCostUah,
  shippingSource,
  savedTotalUah,
  isAgreed = false,
  paymentActions,
  onSaved,
}: {
  orderId: string;
  shippingCostUah?: number;
  shippingSource?: { amount: number; currency: ShopCurrencyCode } | null;
  savedTotalUah?: number;
  isAgreed?: boolean;
  paymentActions: (ready: boolean) => ReactNode;
  onSaved: () => Promise<void>;
}) {
  const savedSourceCurrency = shippingSource?.currency ?? "UAH";
  const savedSourceAmount = shippingSource?.amount ?? shippingCostUah;
  const [shipping, setShipping] = useState(savedSourceAmount == null ? "" : String(savedSourceAmount));
  const [shippingCurrency, setShippingCurrency] = useState<ShopCurrencyCode>(savedSourceCurrency);
  const [agreed, setAgreed] = useState(false);
  const [quote, setQuote] = useState<QuotePreview | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setQuote(null);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        shippingAmount: shipping || "0",
        shippingCurrency,
      });
      fetch(`/api/admin/shop/orders/${orderId}/delivery-quote?${params}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(quoteError(data.error));
          return data;
        })
        .then((quote) => {
          if (!controller.signal.aborted) {
            if (![quote.subtotal, quote.shippingCost, quote.taxAmount, quote.total].every(
              (amount) => typeof amount === "number" && Number.isFinite(amount)
            ) || !quote.shippingQuote || !["USD", "EUR", "UAH"].includes(quote.shippingQuote.currency))
              throw new Error(quoteError());
            setQuote(quote);
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : quoteError());
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [orderId, shipping, shippingCurrency, refresh]);

  async function save() {
    if (lock.current || !agreed || !quote || shipping === "") return;
    lock.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${orderId}/delivery-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAmount: shipping,
          shippingCurrency,
          expectedShippingCostUah: quote.shippingCost,
          expectedTotalUah: quote.total,
          customerAgreed: agreed,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (["DELIVERY_QUOTE_CHANGED", "ORDER_QUOTE_CHANGED"].includes(data.error)) {
          setAgreed(false);
          setQuote(null);
          setNotice("Курс або розрахунок змінився. Перевірте оновлену суму й погодьте її з клієнтом повторно.");
          setRefresh((value) => value + 1);
          return;
        }
        throw new Error(quoteError(data.error));
      }
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : quoteError());
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  const paymentReady = Boolean(isAgreed && quote && !saving && !error && shipping !== "" &&
    quote.total === savedTotalUah && quote.shippingCost === (shippingCostUah ?? 0) &&
    shippingCurrency === savedSourceCurrency && Number(shipping) === savedSourceAmount &&
    quote.shippingQuote?.currency === shippingCurrency && Number(shipping) === quote.shippingQuote.amount);
  return (
    <section id="international-delivery" className={styles.panel} aria-label="Міжнародна доставка та оплата">
      <header className={styles.header}>
        <div>
          <h3>Міжнародна доставка та оплата</h3>
          <p>Розрахуйте доставку, погодьте суму з клієнтом і підготуйте посилання для оплати.</p>
        </div>
        <span className={paymentReady ? styles.agreedBadge : styles.pendingBadge}>
          {paymentReady ? <Check size={14} aria-hidden="true" /> : null}
          {paymentReady ? "Суму погоджено" : isAgreed ? "Новий розрахунок" : "Очікує погодження"}
        </span>
      </header>
      <div className={styles.quoteGrid}>
        <div className={styles.delivery}>
          <h4><span>1</span> Вартість доставки</h4>
          <div className={styles.shippingFields}>
            <AdminInputField label="Вартість доставки" value={shipping}
              onChange={(value) => { setShipping(value); setQuote(null); setAgreed(false); setNotice(""); }}
              type="number" min={0} step="0.01" placeholder="0,00" disabled={saving}
            />
            <AdminSelectField label="Валюта доставки" value={shippingCurrency} disabled={saving}
              options={[{ value: "USD", label: "USD" }, { value: "EUR", label: "EUR" }, { value: "UAH", label: "UAH" }]}
              onChange={(value) => { setShippingCurrency(value as ShopCurrencyCode); setQuote(null); setAgreed(false); setNotice(""); }}
            />
          </div>
          <p className={styles.inputHint}>Якщо доставка безкоштовна, вкажіть 0.</p>
          {quote?.shippingQuote && shippingCurrency !== "UAH" ?
            <p className={styles.exchangeRate}>
              {quote.ratesLocked ? "Зафіксований курс" : "Курс для розрахунку"}: 1 {shippingCurrency} = {new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 6 }).format(quote.shippingQuote.rateToUah)} грн
            </p> : null}
          <p className={styles.calculationStatus} role="status">
            {error ? "Розрахунок недоступний." : !quote ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Оновлюємо розрахунок…</> : "Сума для mono — у гривні. Податки враховуються автоматично."}
          </p>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        </div>
        <div className={styles.summary}>
          <p className={styles.summaryTitle}>Сума для погодження</p>
          <dl>
            <div><dt>Товари</dt><dd>{quote ? formatMoney(quote.subtotal) : "—"}</dd></div>
            <div><dt>Доставка</dt><dd>{quote ? formatMoney(quote.shippingCost) : "—"}</dd></div>
            <div><dt>Податки</dt><dd>{quote ? formatMoney(quote.taxAmount) : "—"}</dd></div>
            {quote?.regionalAdjustmentAmount ? <div><dt>Регіональне коригування</dt><dd>{formatMoney(quote.regionalAdjustmentAmount)}</dd></div> : null}
          </dl>
          {quote?.shippingQuote && shippingCurrency !== "UAH" ? <p className={styles.sourceAmount}>
            Доставка: {new Intl.NumberFormat("uk-UA", { style: "currency", currency: shippingCurrency, minimumFractionDigits: 2 }).format(quote.shippingQuote.amount)} → {formatMoney(quote.shippingCost)}
          </p> : null}
          <div className={styles.total}>
            <span>Разом до списання</span>
            <strong aria-live="polite">{quote ? formatMoney(quote.total) : error ? "—" : "Розраховуємо…"}</strong>
          </div>
        </div>
      </div>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      <div className={styles.agreement}>
        <h4><span>2</span> Погодження з клієнтом</h4>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={agreed} disabled={saving || !quote || shipping === ""}
            onChange={(event) => setAgreed(event.target.checked)} />
          <span>Вартість доставки, загальна сума та списання у гривні погоджені з клієнтом</span>
        </label>
        <div className={styles.saveRow}>
          <button type="button" disabled={saving || !agreed || !quote || shipping === ""}
            onClick={() => void save()} className={styles.saveButton}>
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            {saving ? "Зберігаємо…" : "Зберегти погоджену суму"}
          </button>
          <p>{shipping === "" ? "Спершу вкажіть вартість доставки." : paymentReady && !agreed ? "Суму збережено. Зміни потребують нового підтвердження клієнта." : agreed ? "Збережіть суму, щоб перейти до оплати." : "Спершу підтвердьте, що клієнт погодив розрахунок."}</p>
        </div>
      </div>
      <div className={styles.payment}>
        <h4><span>3</span> Платіжне посилання</h4>
        <p className={styles.paymentHint}>
          {paymentReady ? "Погоджену суму збережено. Можна підготувати посилання для клієнта." : <><LockKeyhole size={14} aria-hidden="true" /> Доступно після збереження погодженої суми.</>}
        </p>
        {paymentActions(paymentReady)}
      </div>
    </section>
  );
}
