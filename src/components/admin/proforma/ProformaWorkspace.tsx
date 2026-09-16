"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import {
  draftCatalogPrice,
  draftTotals,
  validateDraftBody,
  type DraftCurrency,
} from "@/lib/admin/proformaDraft";
import { proformaRecipients } from "@/lib/admin/proformaRecipients";
import { catalogImageSources } from "@/lib/admin/catalogImageSources";
import { StockExportPanel } from "./StockExportPanel";
import {
  Field,
  SectionTitle,
  Thumbnail,
  money,
  productTitle,
  lineKey,
  type Customer,
  type Product,
  type Variant,
  type Line,
} from "./shared";
import styles from "./proforma.module.css";

export function ProformaWorkspace() {
  const [tab, setTab] = useState<"proforma" | "stock">("proforma");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState<DraftCurrency>("EUR");
  const [shipping, setShipping] = useState("0");
  const [tax, setTax] = useState("0");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");
  const [locale, setLocale] = useState("ua");
  const [recipient, setRecipient] = useState("recipient-1");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; orderNumber: string } | null>(null);
  const saveLock = useRef(false);
  const successRef = useRef<HTMLElement>(null);
  const approvedB2b = customer?.group === "B2B_APPROVED";
  const dirty =
    !saved &&
    Boolean(
      name ||
      email ||
      phone ||
      address ||
      items.length ||
      note ||
      validUntil ||
      Number(shipping) ||
      Number(tax)
    );

  useEffect(() => {
    if (saved) {
      successRef.current?.scrollIntoView({ block: "start" });
      successRef.current?.focus({ preventScroll: true });
    }
  }, [saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const controller = new AbortController();
    setCustomers([]);
    setCustomerError("");
    if (customerSearch.trim().length < 2) {
      setCustomerLoading(false);
      return;
    }
    setCustomerLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/shop/customers", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("Не вдалося знайти клієнтів. Заповніть дані вручну або повторіть пошук.");
        const data: Customer[] = await response.json();
        if (controller.signal.aborted) return;
        const needle = customerSearch.trim().toLowerCase();
        setCustomers(
          data
            .filter((entry) =>
              [entry.email, entry.fullName, entry.companyName].some((v) =>
                v?.toLowerCase().includes(needle)
              )
            )
            .slice(0, 8)
        );
      } catch (err) {
        if (!controller.signal.aborted)
          setCustomerError(err instanceof Error ? err.message : "Помилка пошуку.");
      } finally {
        if (!controller.signal.aborted) setCustomerLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearch]);

  useEffect(() => {
    const controller = new AbortController();
    setProducts([]);
    setProductError("");
    setProductLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/shop/products?search=${encodeURIComponent(search.trim())}&limit=12`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? "Немає доступу до каталогу. Зверніться до адміністратора."
              : "Каталог не завантажився. Спробуйте ще раз."
          );
        const data = await response.json();
        if (!controller.signal.aborted) setProducts(data.products ?? []);
      } catch (err) {
        if (!controller.signal.aborted)
          setProductError(err instanceof Error ? err.message : "Помилка каталогу.");
      } finally {
        if (!controller.signal.aborted) setProductLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, retry]);

  function addProduct(product: Product, variant: Variant | null) {
    const price = draftCatalogPrice(product, variant, currency, approvedB2b);
    const imageSources = catalogImageSources([
      variant?.image,
      product.image,
      product.imageUrl,
      ...(product.imageSources ?? []),
      ...(product.media?.filter((media) => media.mediaType === "IMAGE").map((media) => media.src) ??
        []),
      ...(product.gallery ?? []),
    ]);
    const line: Line = {
      productId: product.id,
      productSlug: product.slug,
      variantId: variant?.id ?? null,
      title: [
        productTitle(product),
        variant?.title && variant.title !== "Default Title" ? variant.title : "",
      ]
        .filter(Boolean)
        .join(" · "),
      sku: variant?.sku || product.sku,
      image: imageSources[0] ?? null,
      imageSources,
      quantity: "1",
      price: price == null ? "" : String(price),
    };
    setItems((current) =>
      current.some((entry) => lineKey(entry) === lineKey(line))
        ? current.map((entry) =>
            lineKey(entry) === lineKey(line)
              ? { ...entry, quantity: String(Math.min(10000, (Number(entry.quantity) || 0) + 1)) }
              : entry
          )
        : [...current, line]
    );
    setSelectedProduct(null);
    setError("");
  }

  async function chooseProduct(product: Product) {
    if (saved || saving || loadingProduct) return;
    setLoadingProduct(product.id);
    setProductError("");
    try {
      const response = await fetch(`/api/admin/shop/products/${encodeURIComponent(product.id)}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Не вдалося завантажити варіанти товару. Спробуйте ще раз.");
      const detail: Product = await response.json();
      setTab("proforma");
      if ((detail.variants?.length ?? 0) > 1) {
        setSelectedProduct(detail);
        setVariantId(detail.variants!.find((v) => v.isDefault)?.id ?? detail.variants![0].id);
      } else addProduct(detail, detail.variants?.[0] ?? null);
    } catch (err) {
      setTab("proforma");
      setProductError(err instanceof Error ? err.message : "Помилка товару.");
    } finally {
      setLoadingProduct(null);
    }
  }

  const numericItems = items.map((item) => ({
    ...item,
    price: item.price.trim() ? Number(item.price) : NaN,
    quantity: Number(item.quantity),
  }));
  const totals = draftTotals(
    numericItems.map((item) => ({
      price: Number.isFinite(item.price) ? item.price : 0,
      quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
    })),
    Number(shipping) || 0,
    Number(tax) || 0
  );
  const incomplete = items.some((item) => !item.price.trim() || !item.quantity.trim());
  const previewUrl = saved
    ? `/api/admin/pdf/proforma/${saved.id}?locale=${locale}&recipient=${recipient}&currency=${currency}`
    : "";
  const selectedVariant = selectedProduct?.variants?.find((v) => v.id === variantId) ?? null;
  const selectedPrice = selectedProduct
    ? draftCatalogPrice(selectedProduct, selectedVariant, currency, approvedB2b)
    : null;
  function updateItem(index: number, patch: Partial<Line>) {
    setItems((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current || saved) return;
    const body = {
      customerId: customer?.id ?? null,
      customerName: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      currency,
      shippingAddress: { line1: address.trim() },
      items: numericItems,
      shippingCost: shipping.trim() ? Number(shipping) : NaN,
      taxAmount: tax.trim() ? Number(tax) : NaN,
      internalNote: note.trim() || null,
      validUntil: validUntil || null,
    };
    const validation = validateDraftBody(body);
    if (validation) {
      setError(validation);
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не вдалося зберегти проформу.");
      setSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка збереження. Перевірте з’єднання.");
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }

  return (
    <AdminPage className={styles.page}>
      <Link
        href="/admin/shop/drafts"
        className={styles.back}
        onClick={(event) => {
          if (dirty && !window.confirm("Вийти без збереження проформи?")) event.preventDefault();
        }}
      >
        <ArrowLeft size={15} /> Усі проформи та котирування
      </Link>
      <AdminPageHeader
        eyebrow="Робочий простір менеджера"
        title="Проформа та наявність"
        description="Від підбору товарів — до готової пропозиції клієнту."
        actions={
          <span className={styles.status}>
            <span /> {saved ? "Проформу збережено" : "Нова проформа"}
          </span>
        }
      />
      <div className={styles.tabs} aria-label="Режим робочого простору">
        <button type="button" aria-pressed={tab === "proforma"} onClick={() => setTab("proforma")}>
          <FileText size={17} /> Створити проформу {items.length > 0 && <span>{items.length}</span>}
        </button>
        <button type="button" aria-pressed={tab === "stock"} onClick={() => setTab("stock")}>
          <Package size={17} /> Наявність · Telegram
        </button>
      </div>
      <div hidden={tab !== "stock"}>
        <StockExportPanel
          active={tab === "stock"}
          onAdd={chooseProduct}
          addDisabled={Boolean(saved || saving || loadingProduct)}
        />
      </div>
      <div hidden={tab !== "proforma"}>
        {saved && (
          <section className={styles.success} role="status" ref={successRef} tabIndex={-1}>
            <CheckCircle2 size={28} />
            <div>
              <h2>Проформу {saved.orderNumber} збережено</h2>
              <p>Активне замовлення не створено. Клієнту нічого не надіслано.</p>
              <div className={styles.actions}>
                <Link className={styles.secondary} href="/admin/shop/drafts/new">
                  Створити ще одну
                </Link>
                <a className={styles.primary} href={previewUrl} target="_blank" rel="noreferrer">
                  <FileText size={17} /> Відкрити проформу <ArrowUpRight size={15} />
                </a>
                <a className={styles.secondary} href={`${previewUrl}&format=pdf`}>
                  Завантажити PDF
                </a>
                <Link className={styles.secondary} href={`/admin/shop/drafts/${saved.id}`}>
                  Картка проформи
                </Link>
              </div>
            </div>
          </section>
        )}
        <form onSubmit={submit} className={styles.layout}>
          <fieldset className={styles.main} disabled={saving || Boolean(saved)}>
            <section className={styles.card}>
              <SectionTitle
                number="01"
                title="Для кого проформа?"
                description="Оберіть клієнта з бази або заповніть дані вручну."
              />
              {customer ? (
                <div className={styles.customer}>
                  <span className={styles.avatar}>
                    {(customer.fullName || customer.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{customer.fullName || customer.email}</strong>
                    <small>
                      {customer.companyName || customer.email} ·{" "}
                      {approvedB2b ? "B2B · погоджений" : "Роздрібні ціни"}
                    </small>
                  </div>
                  <button
                    className={styles.iconButton}
                    type="button"
                    aria-label="Прибрати вибраного клієнта"
                    onClick={() => setCustomer(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <label className={styles.search}>
                    <Search size={18} />
                    <input
                      aria-label="Пошук клієнта"
                      placeholder="Ім’я, email або компанія…"
                      value={customerSearch}
                      onChange={(event) => setCustomerSearch(event.target.value)}
                    />
                  </label>
                  {customerLoading && (
                    <p className={styles.hint} role="status">
                      Шукаємо клієнта…
                    </p>
                  )}
                  {customerError && (
                    <p className={styles.error} role="alert">
                      {customerError}
                    </p>
                  )}
                  {!customerLoading &&
                    !customerError &&
                    customerSearch.trim().length >= 2 &&
                    !customers.length && (
                      <p className={styles.hint}>
                        Збігів немає. Вкажіть дані нового клієнта нижче.
                      </p>
                    )}
                  {customers.length > 0 && (
                    <div className={styles.customerResults}>
                      {customers.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setCustomer(entry);
                            setName(entry.fullName || entry.companyName || "");
                            setEmail(entry.email);
                            setPhone("");
                            setAddress("");
                            setCustomerSearch("");
                          }}
                        >
                          <strong>{entry.fullName || entry.companyName || entry.email}</strong>
                          <small>{entry.email}</small>
                          <Plus size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className={styles.fields}>
                <Field label="Ім’я або назва клієнта *">
                  <input
                    required
                    maxLength={200}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Олександр Петренко"
                  />
                </Field>
                <Field label="Email *">
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="client@company.com"
                  />
                </Field>
                <Field label="Телефон">
                  <input
                    type="tel"
                    maxLength={80}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+380"
                  />
                </Field>
                <Field label="Адреса доставки" hint="Необов’язково. Буде вказана у проформі.">
                  <input
                    maxLength={500}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Місто, вулиця, індекс, країна"
                  />
                </Field>
              </div>
            </section>
            <section className={styles.card}>
              <SectionTitle
                number="02"
                title="Товари у проформі"
                description="Додайте товари з каталогу та погодьте ціну кожної позиції."
              />
              <div className={styles.catalogToolbar}>
                <label className={styles.search}>
                  <Search size={18} />
                  <input
                    aria-label="Пошук товарів"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Назва, бренд або артикул…"
                  />
                </label>
                <Field label="Валюта">
                  <select
                    aria-label="Валюта проформи"
                    value={currency}
                    disabled={items.length > 0 || Boolean(loadingProduct)}
                    onChange={(event) => {
                      setCurrency(event.target.value as DraftCurrency);
                      if (event.target.value !== "EUR") setRecipient("recipient-1");
                    }}
                  >
                    {["EUR", "USD", "UAH"].map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {items.length > 0 && (
                <p className={styles.hint}>
                  Ціни зафіксовані в {currency}. Для зміни валюти спочатку приберіть товари. Зміна
                  клієнта не перераховує додані позиції.
                </p>
              )}
              {productError && (
                <div className={styles.error} role="alert">
                  {productError}{" "}
                  <button
                    className={styles.textButton}
                    type="button"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Повторити
                  </button>
                </div>
              )}
              {productLoading ? (
                <div className={styles.catalogState} role="status">
                  <Loader2 className={styles.spin} size={19} /> Завантажуємо каталог…
                </div>
              ) : !products.length && !productError ? (
                <div className={styles.catalogState}>
                  <Search size={23} />
                  <div>
                    Товарів не знайдено<small>Спробуйте іншу назву або артикул.</small>
                  </div>
                </div>
              ) : (
                <div className={styles.catalog} aria-label="Товари каталогу">
                  {products.map((product) => (
                    <button
                      className={styles.product}
                      key={product.id}
                      type="button"
                      disabled={Boolean(loadingProduct)}
                      onClick={() => void chooseProduct(product)}
                    >
                      <Thumbnail src={product.imageUrl} sources={product.imageSources} />
                      <span className={styles.productInfo}>
                        <strong>{productTitle(product)}</strong>
                        <small>
                          {[product.brand, product.sku].filter(Boolean).join(" · ") || product.slug}
                        </small>
                      </span>
                      <span className={styles.add}>
                        {loadingProduct === product.id ? (
                          <Loader2 className={styles.spin} size={16} />
                        ) : (
                          <Plus size={17} />
                        )}
                        <span>Обрати</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className={styles.hint}>
                До 12 результатів — уточніть пошук для інших товарів.{" "}
                {approvedB2b
                  ? "Підставляємо доступні каталожні B2B-ціни; персональні знижки узгодьте вручну."
                  : "Підставляємо роздрібні ціни каталогу."}
              </p>
              {selectedProduct && (
                <div className={styles.variantPicker}>
                  <div className={styles.row}>
                    <strong>{productTitle(selectedProduct)}</strong>
                    <button
                      className={styles.iconButton}
                      type="button"
                      aria-label="Закрити вибір варіанта"
                      onClick={() => setSelectedProduct(null)}
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <Field label="Варіант товару">
                    <select
                      value={variantId}
                      onChange={(event) => setVariantId(event.target.value)}
                    >
                      {selectedProduct.variants?.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.title || "Основний варіант"}
                          {variant.sku ? ` · ${variant.sku}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className={styles.row}>
                    <span>
                      {selectedPrice == null
                        ? "Ціну потрібно вказати вручну"
                        : money(selectedPrice, currency)}
                    </span>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => addProduct(selectedProduct, selectedVariant)}
                    >
                      <Plus size={16} /> Додати до проформи
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.selectedHeader}>
                <h3>
                  Обрані позиції <span>{items.length}</span>
                </h3>
                <small>Кількість і ціну можна змінити</small>
              </div>
              {!items.length ? (
                <div className={styles.empty}>
                  <Package size={29} />
                  <strong>Почніть із першого товару</strong>
                  <span>Знайдіть його вище й натисніть «Обрати».</span>
                </div>
              ) : (
                <div className={styles.lines}>
                  {items.map((item, index) => (
                    <div className={styles.line} key={lineKey(item)}>
                      <div className={styles.lineProduct}>
                        <Thumbnail src={item.image} sources={item.imageSources} />
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.sku || item.productSlug}</small>
                        </div>
                      </div>
                      <Field label="К-сть">
                        <input
                          aria-label={`Кількість: ${item.title}`}
                          type="number"
                          min="1"
                          max="10000"
                          step="1"
                          required
                          value={item.quantity}
                          onChange={(event) => updateItem(index, { quantity: event.target.value })}
                        />
                      </Field>
                      <Field label={`Ціна, ${currency}`}>
                        <input
                          aria-label={`Ціна: ${item.title}`}
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="Вкажіть"
                          value={item.price}
                          onChange={(event) => updateItem(index, { price: event.target.value })}
                        />
                      </Field>
                      <div className={styles.lineTotal}>
                        <small>Сума</small>
                        <strong>
                          {item.price.trim()
                            ? money(
                                draftTotals([
                                  { price: Number(item.price), quantity: Number(item.quantity) },
                                ]).total,
                                currency
                              )
                            : "—"}
                        </strong>
                      </div>
                      <button
                        className={styles.iconButton}
                        type="button"
                        aria-label={`Видалити: ${item.title}`}
                        onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={17} />
                      </button>
                      {!item.price.trim() && (
                        <p className={styles.missingPrice}>
                          У каталозі немає ціни в {currency}. Вкажіть погоджену ціну.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className={styles.card}>
              <SectionTitle
                number="03"
                title="Умови та оформлення"
                description="Дата проформи встановлюється автоматично під час збереження."
              />
              <div className={styles.fields}>
                <Field label={`Доставка, ${currency}`}>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={shipping}
                    onChange={(event) => setShipping(event.target.value)}
                  />
                </Field>
                <Field label="Мова документа">
                  <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                    <option value="ua">Українська</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="Отримувач платежу" hint="Wise доступний для проформ у EUR.">
                  <select value={recipient} onChange={(event) => setRecipient(event.target.value)}>
                    {proformaRecipients.map((entry) => (
                      <option
                        key={entry.id}
                        value={entry.id}
                        disabled={Boolean(entry.currency && entry.currency !== currency)}
                      >
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <details className={styles.advanced}>
                <summary>
                  Додаткові налаштування <span>Необов’язково</span>
                </summary>
                <div className={styles.fields}>
                  <Field
                    label="Дійсна до"
                    hint="Не дата документа, а необов’язковий термін дії пропозиції."
                  >
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                    />
                  </Field>
                  <Field
                    label={`Податки, ${currency}`}
                    hint="Фіксована сума, без автоматичного розрахунку."
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tax}
                      onChange={(event) => setTax(event.target.value)}
                    />
                  </Field>
                  <Field label="Внутрішня примітка" hint="Лише для команди. Не потрапляє до PDF.">
                    <textarea
                      rows={3}
                      maxLength={10000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Домовленості та деталі для колег…"
                    />
                  </Field>
                </div>
              </details>
            </section>
          </fieldset>
          <aside className={styles.summary}>
            <div className={styles.documentIcon}>
              <FileText size={23} />
            </div>
            <span className={styles.eyebrow}>Рахунок-проформа</span>
            <h2>Підсумок документа</h2>
            <div className={styles.summaryCustomer}>
              <span>Клієнт</span>
              <strong>{name || "Ще не вказано"}</strong>
              <small>{email || "Заповніть дані клієнта"}</small>
            </div>
            <dl>
              <div>
                <dt>Дата проформи</dt>
                <dd>Автоматично</dd>
              </div>
              <div>
                <dt>Товари · {items.length} поз.</dt>
                <dd>{money(totals.subtotal, currency)}</dd>
              </div>
              <div>
                <dt>Доставка</dt>
                <dd>{money(Number(shipping) || 0, currency)}</dd>
              </div>
              <div>
                <dt>Податки</dt>
                <dd>{money(Number(tax) || 0, currency)}</dd>
              </div>
            </dl>
            <div className={styles.grandTotal}>
              <span>Разом{incomplete ? " · попередньо" : ""}</span>
              <strong>{money(totals.total, currency)}</strong>
            </div>
            <ul className={styles.checklist}>
              <li data-ready={Boolean(name.trim() && email.trim())}>
                <Check size={15} /> Дані клієнта
              </li>
              <li data-ready={items.length > 0 && !incomplete}>
                <Check size={15} /> Товари та ціни
              </li>
              <li data-ready>
                <Check size={15} /> {currency} · {locale === "ua" ? "Українська" : "English"}
              </li>
            </ul>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              className={styles.primary}
              type="submit"
              disabled={saving || Boolean(saved) || !items.length || Boolean(loadingProduct)}
            >
              {saving ? (
                <Loader2 className={styles.spin} size={18} />
              ) : saved ? (
                <CheckCircle2 size={18} />
              ) : (
                <FileText size={18} />
              )}
              {saving ? "Зберігаємо…" : saved ? "Проформу збережено" : "Зберегти проформу"}
            </button>
            <p className={styles.hint}>Після збереження — перегляд, PDF і друк.</p>
            <div className={styles.reassurance}>
              <ShieldCheck size={19} />
              <p>Без активного замовлення, списання залишків і автоматичної відправки клієнту.</p>
            </div>
          </aside>
        </form>
      </div>
    </AdminPage>
  );
}
