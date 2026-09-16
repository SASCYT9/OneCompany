"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  FileText,
  Globe2,
  Images,
  LayoutTemplate,
  Plus,
  Percent,
  Search,
  Trash2,
} from "lucide-react";

import { AdminInlineAlert, AdminPage, AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { Thumbnail } from "@/components/admin/proforma/shared";
import {
  CATALOG_BROCHURE_CURRENCIES,
  CATALOG_BROCHURE_LANGUAGES,
  CATALOG_BROCHURE_LAYOUTS,
  applyCatalogBrochureDiscount,
  applyCatalogBrochureFixedDiscount,
  catalogBrochurePrice,
  catalogBrochureProductPageCount,
  type CatalogBrochureBranding,
  type CatalogBrochureCurrency,
  type CatalogBrochureLayout,
  type CatalogBrochureLanguage,
} from "@/lib/admin/catalogBrochure";
import styles from "./catalog.module.css";
import { getBrandLogo } from "@/lib/brandLogos";

type CatalogProduct = {
  id: string;
  slug: string;
  titleUa: string;
  titleEn: string;
  sku: string | null;
  brand: string | null;
  stock: string;
  imageUrl: string | null;
  imageSources?: string[];
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
};

type SelectedProduct = {
  product: CatalogProduct;
  prices: Record<CatalogBrochureCurrency, string>;
  imageSource: string | null;
};

type BulkAdjustmentMode = "percent" | "fixed";

function money(value: number | null, currency: CatalogBrochureCurrency) {
  if (value == null) return "За запитом";
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function priceInput(value: number | null) {
  return value == null ? "" : String(value);
}

function productName(product: CatalogProduct) {
  return product.titleUa || product.titleEn;
}

function productImages(product: CatalogProduct) {
  return Array.from(
    new Set(
      [product.imageUrl, ...(product.imageSources ?? [])].filter(
        (source): source is string => typeof source === "string" && source.trim().length > 0
      )
    )
  );
}

function detectLogoTone(image: HTMLImageElement): "light" | "dark" | "unknown" {
  try {
    const canvas = document.createElement("canvas");
    const width = 160;
    const height = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * width));
    canvas.width = width;
    canvas.height = Math.min(height, 100);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return "unknown";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let luma = 0;
    let weight = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.08) continue;
      luma +=
        (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) * alpha;
      weight += alpha;
    }
    if (weight === 0) return "unknown";
    return luma / weight >= 150 ? "light" : "dark";
  } catch {
    return "unknown";
  }
}

export default function AdminCatalogsPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState<CatalogBrochureCurrency>("EUR");
  const [layout, setLayout] = useState<CatalogBrochureLayout>("single");
  const [language, setLanguage] = useState<CatalogBrochureLanguage>("ua");
  const [branding, setBranding] = useState<CatalogBrochureBranding>("onecompany");
  const [brandName, setBrandName] = useState("");
  const [brandLogoTone, setBrandLogoTone] = useState<"light" | "dark" | "unknown">("unknown");
  const [title, setTitle] = useState("Нова конфігурація");
  const [subtitle, setSubtitle] = useState("Презентаційний каталог");
  const [showPrice, setShowPrice] = useState(true);
  const [bulkAdjustmentMode, setBulkAdjustmentMode] = useState<BulkAdjustmentMode>("percent");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", limit: "24" });
        if (search.trim()) params.set("search", search.trim());
        const response = await fetch(`/api/admin/shop/catalogs/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Не вдалося завантажити товари.");
        setProducts(Array.isArray(data.products) ? data.products : []);
        setError("");
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setError((reason as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const selectedIds = useMemo(() => new Set(selected.map((entry) => entry.product.id)), [selected]);
  const brandOptions = useMemo(
    () =>
      Array.from(new Set(selected.map((entry) => entry.product.brand).filter(Boolean))) as string[],
    [selected]
  );
  function addProduct(product: CatalogProduct) {
    if (selectedIds.has(product.id)) return;
    setSelected((current) => [
      ...current,
      {
        product,
        prices: {
          EUR: priceInput(catalogBrochurePrice(product, "EUR")),
          USD: priceInput(catalogBrochurePrice(product, "USD")),
          UAH: priceInput(catalogBrochurePrice(product, "UAH")),
        },
        imageSource: productImages(product)[0] ?? null,
      },
    ]);
    if (!brandName && product.brand) setBrandName(product.brand);
    setSuccess("");
  }

  useEffect(() => {
    if (brandName && !brandOptions.includes(brandName)) setBrandName(brandOptions[0] || "");
  }, [brandName, brandOptions]);

  useEffect(() => {
    setBrandLogoTone("unknown");
  }, [brandName]);

  function removeProduct(id: string) {
    setSelected((current) => current.filter((entry) => entry.product.id !== id));
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.length) return;
    setSelected((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function updatePrice(id: string, value: string) {
    setSelected((current) =>
      current.map((entry) =>
        entry.product.id === id
          ? { ...entry, prices: { ...entry.prices, [currency]: value } }
          : entry
      )
    );
  }

  function cycleProductImage(id: string) {
    setSelected((current) =>
      current.map((entry) => {
        if (entry.product.id !== id) return entry;
        const sources = productImages(entry.product);
        if (sources.length < 2) return entry;
        const currentIndex = Math.max(0, sources.indexOf(entry.imageSource ?? ""));
        return { ...entry, imageSource: sources[(currentIndex + 1) % sources.length] };
      })
    );
  }

  function applyBulkAdjustment(mode: BulkAdjustmentMode, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        mode === "percent"
          ? "Вкажіть відсоток знижки більше нуля."
          : `Вкажіть суму знижки більше нуля в ${currency}.`
      );
      setSuccess("");
      return;
    }
    if (mode === "percent" && amount > 100) {
      setError("Відсоток знижки має бути від 0,01% до 100%.");
      setSuccess("");
      return;
    }
    const eligible = selected.filter((entry) => {
      const value = Number(entry.prices[currency]);
      return entry.prices[currency].trim() !== "" && Number.isFinite(value) && value >= 0;
    }).length;
    if (eligible === 0) {
      setError("Спочатку введіть хоча б одну коректну ціну в обраній валюті.");
      setSuccess("");
      return;
    }
    setSelected((current) =>
      current.map((entry) => {
        const raw = entry.prices[currency].trim();
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value < 0) return entry;
        return {
          ...entry,
          prices: {
            ...entry.prices,
            [currency]: String(
              mode === "percent"
                ? applyCatalogBrochureDiscount(value, amount)
                : applyCatalogBrochureFixedDiscount(value, amount)
            ),
          },
        };
      })
    );
    setError("");
    const formattedAmount = new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: 2,
    }).format(amount);
    setSuccess(
      `Застосовано знижку −${formattedAmount}${mode === "percent" ? "%" : ` ${currency}`} до ${eligible} ${eligible === 1 ? "позиції" : "позицій"}.`
    );
  }

  function applyCustomBulkAdjustment() {
    const normalized = bulkAdjustmentValue.trim().replace(",", ".");
    applyBulkAdjustment(bulkAdjustmentMode, Number(normalized));
  }

  async function generatePdf() {
    setGenerating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/pdf/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          language,
          currency,
          layout,
          branding,
          brandName: branding === "brand" ? brandName : null,
          showPrice,
          items: selected.map((entry) => ({
            productId: entry.product.id,
            imageSource: entry.imageSource,
            priceOverride:
              entry.prices[currency].trim() === "" ? null : Number(entry.prices[currency]),
          })),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Не вдалося сформувати PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.trim() || "onecompany-catalog"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess("PDF сформовано та завантажено.");
    } catch (reason) {
      setError((reason as Error).message || "Не вдалося сформувати PDF.");
    } finally {
      setGenerating(false);
    }
  }

  const firstProduct = selected[0]?.product;
  const firstPreviewImage = selected[0]?.imageSource || firstProduct?.imageUrl || null;
  const productPages = catalogBrochureProductPageCount(selected.length, layout);
  const summaryPages = selected.length ? Math.ceil(selected.length / 8) : 0;
  const documentPages = selected.length ? productPages + summaryPages + 1 : "—";
  const languageLabel = CATALOG_BROCHURE_LANGUAGES.find((entry) => entry.value === language)?.label;
  const brandLogoSrc = brandName ? getBrandLogo(brandName) : null;
  const selectedLogoSrc =
    branding === "onecompany"
      ? "/branding/logo-light.svg"
      : branding === "brand"
        ? brandLogoSrc
        : null;

  return (
    <AdminPage className={styles.page} wide>
      <AdminPageHeader
        eyebrow="Матеріали для клієнта"
        title="Презентаційні каталоги"
        description="Зберіть красиву PDF-презентацію з вибраних товарів. Порядок позицій, мова та ціни налаштовуються перед кожною генерацією."
        actions={
          <Link
            href="/admin/shop/drafts"
            className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/6"
          >
            <FileText className="h-4 w-4" />
            До проформ
          </Link>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? (
        <div className={`${styles.alert} ${styles.success}`} role="status">
          {success}
        </div>
      ) : null}

      <div className={styles.workbench}>
        <main className={styles.main}>
          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>01 / Обкладинка та формат</div>
                <h2>Налаштуйте подачу</h2>
              </div>
              <LayoutTemplate size={20} color="#79a9ff" aria-hidden="true" />
            </div>
            <div className={styles.fields}>
              <label className={`${styles.field} ${styles.full}`}>
                Назва каталогу
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                />
              </label>
              <label className={styles.field}>
                Підзаголовок
                <input
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  maxLength={220}
                />
              </label>
              <label className={styles.field}>
                Мова PDF
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as CatalogBrochureLanguage)}
                >
                  {CATALOG_BROCHURE_LANGUAGES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Валюта
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as CatalogBrochureCurrency)}
                >
                  {CATALOG_BROCHURE_CURRENCIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {option.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                Розкладка товарів
                <select
                  value={layout}
                  onChange={(event) => setLayout(event.target.value as CatalogBrochureLayout)}
                >
                  {CATALOG_BROCHURE_LAYOUTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={styles.fieldHint}>
                  {CATALOG_BROCHURE_LAYOUTS.find((option) => option.value === layout)?.description}
                </span>
              </label>
              <label className={styles.field}>
                Логотип у PDF
                <select
                  value={branding}
                  onChange={(event) => setBranding(event.target.value as CatalogBrochureBranding)}
                >
                  <option value="onecompany">Логотип OneCompany</option>
                  <option value="brand" disabled={brandOptions.length === 0}>
                    Логотип бренду{brandName ? ` · ${brandName}` : ""}
                  </option>
                  <option value="none">Без логотипа</option>
                </select>
              </label>
              {branding === "brand" ? (
                <label className={styles.field}>
                  Бренд
                  <select
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    disabled={brandOptions.length === 0}
                  >
                    {brandOptions.length === 0 ? (
                      <option value="">Спочатку додайте товар</option>
                    ) : null}
                    {brandOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(event) => setShowPrice(event.target.checked)}
                />
                Показувати ціни
              </label>
              <div className={styles.toggle}>
                <Globe2 size={14} /> {languageLabel}
              </div>
            </div>
            {language === "ru" ? (
              <p className={styles.hint}>
                Для російської мови поки використовується український опис товару, якщо окремого
                перекладу ще немає.
              </p>
            ) : null}
            {branding === "brand" && brandLogoSrc === "/branding/one-company-logo.svg" ? (
              <p className={styles.hint}>
                Для цього бренду ще немає завантаженого логотипа. Оберіть OneCompany або «Без
                логотипа».
              </p>
            ) : null}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>02 / Каталог V2</div>
                <h2>Додайте товари</h2>
              </div>
              <Images size={20} color="#79a9ff" aria-hidden="true" />
            </div>
            <label className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Пошук за назвою, артикулом або брендом"
              />
            </label>
            <div className={styles.results}>
              {loading ? <div className={styles.empty}>Завантажуємо каталог…</div> : null}
              {!loading && products.length === 0 ? (
                <div className={styles.empty}>Товарів за цим запитом не знайдено.</div>
              ) : null}
              {!loading
                ? products.map((product) => {
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`${styles.productResult} ${isSelected ? styles.selected : ""}`}
                        onClick={() => addProduct(product)}
                        disabled={isSelected}
                      >
                        <Thumbnail src={product.imageUrl} sources={product.imageSources} />
                        <span className={styles.productDetails}>
                          <span className={styles.productName}>{productName(product)}</span>
                          <span className={styles.productMeta}>
                            {[product.brand, product.sku].filter(Boolean).join(" · ") ||
                              "Без артикула"}
                          </span>
                        </span>
                        <span className={styles.productPrice}>
                          {isSelected ? (
                            <Check size={15} />
                          ) : (
                            money(catalogBrochurePrice(product, currency), currency)
                          )}
                        </span>
                      </button>
                    );
                  })
                : null}
            </div>
            <div className={styles.resultFooter}>
              <span>Пошук через Catalog V2 · показано до 24 товарів</span>
              <span>{selected.length} вибрано</span>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>03 / Комплектація</div>
                <h2>Порядок і ціни</h2>
              </div>
              <span className={styles.muted}>
                {selected.length} {selected.length === 1 ? "позиція" : "позицій"}
              </span>
            </div>
            <div className={styles.bulkBar}>
              <div className={styles.bulkHeader}>
                <div>
                  <div className={styles.bulkLabel}>
                    <Percent size={14} /> Масова зміна цін
                  </div>
                  <div className={styles.bulkHint}>Від поточних цін у {currency}</div>
                </div>
                <div className={styles.bulkActions} aria-label="Швидкі знижки">
                  {[5, 10, 15, 20].map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      className={styles.bulkButton}
                      onClick={() => applyBulkAdjustment("percent", percent)}
                      disabled={selected.length === 0}
                    >
                      −{percent}%
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.bulkCustom}>
                <div className={styles.bulkMode} aria-label="Тип знижки">
                  <button
                    type="button"
                    className={`${styles.bulkModeButton} ${
                      bulkAdjustmentMode === "percent" ? styles.bulkModeActive : ""
                    }`}
                    aria-pressed={bulkAdjustmentMode === "percent"}
                    onClick={() => setBulkAdjustmentMode("percent")}
                  >
                    Відсоток
                  </button>
                  <button
                    type="button"
                    className={`${styles.bulkModeButton} ${
                      bulkAdjustmentMode === "fixed" ? styles.bulkModeActive : ""
                    }`}
                    aria-pressed={bulkAdjustmentMode === "fixed"}
                    onClick={() => setBulkAdjustmentMode("fixed")}
                  >
                    Сума
                  </button>
                </div>
                <label className={styles.bulkInputWrap}>
                  <span className={styles.srOnly}>
                    {bulkAdjustmentMode === "percent"
                      ? "Власний відсоток знижки"
                      : `Фіксована знижка в ${currency}`}
                  </span>
                  <input
                    className={styles.bulkInput}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={bulkAdjustmentMode === "percent" ? "100" : undefined}
                    step="0.01"
                    value={bulkAdjustmentValue}
                    onChange={(event) => setBulkAdjustmentValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyCustomBulkAdjustment();
                    }}
                    placeholder={bulkAdjustmentMode === "percent" ? "Напр. 7,5" : "Напр. 250"}
                    disabled={selected.length === 0}
                  />
                  <span className={styles.bulkUnit}>
                    {bulkAdjustmentMode === "percent" ? "%" : currency}
                  </span>
                </label>
                <button
                  type="button"
                  className={styles.bulkApplyButton}
                  onClick={applyCustomBulkAdjustment}
                  disabled={selected.length === 0}
                >
                  Застосувати
                </button>
              </div>
              <div className={styles.bulkFootnote}>
                До всіх коректно введених цін. Фіксована знижка не опускає ціну нижче нуля.
              </div>
            </div>
            {selected.length === 0 ? (
              <div className={styles.empty}>
                Виберіть товари вище — тут можна буде змінити їх порядок та ціну для цього
                конкретного каталогу.
              </div>
            ) : (
              <div className={styles.selectedList}>
                {selected.map((entry, index) => {
                  const imageSources = productImages(entry.product);
                  const imageIndex = Math.max(0, imageSources.indexOf(entry.imageSource ?? ""));
                  return (
                    <div className={styles.selectedRow} key={entry.product.id}>
                      <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                      <div className={styles.selectedThumb}>
                        <Thumbnail src={entry.imageSource} sources={imageSources} />
                      </div>
                      <div>
                        <div className={styles.selectedName}>{productName(entry.product)}</div>
                        <div className={styles.selectedSku}>
                          {entry.product.sku || "Артикул не вказаний"}
                        </div>
                      </div>
                      <input
                        className={styles.priceInput}
                        aria-label={`Ціна ${productName(entry.product)}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={entry.prices[currency]}
                        onChange={(event) => updatePrice(entry.product.id, event.target.value)}
                        placeholder="Ціна"
                      />
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.iconButton} ${styles.photoButton}`}
                          type="button"
                          onClick={() => cycleProductImage(entry.product.id)}
                          disabled={imageSources.length < 2}
                          aria-label={`Наступне фото для ${productName(entry.product)}`}
                          title={`Фото ${imageIndex + 1} з ${Math.max(1, imageSources.length)}`}
                        >
                          <Images size={14} />
                          <span>
                            {imageIndex + 1}/{Math.max(1, imageSources.length)}
                          </span>
                        </button>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => moveProduct(index, -1)}
                          disabled={index === 0}
                          aria-label="Перемістити вище"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className={styles.iconButton}
                          type="button"
                          onClick={() => moveProduct(index, 1)}
                          disabled={index === selected.length - 1}
                          aria-label="Перемістити нижче"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                      <button
                        className={styles.removeButton}
                        type="button"
                        onClick={() => removeProduct(entry.product.id)}
                        aria-label={`Видалити ${productName(entry.product)}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className={styles.hint}>
              Зміна ціни впливає лише на цей PDF і не змінює ціну товару в каталозі.
            </p>
          </section>
        </main>

        <aside className={styles.aside}>
          <section className={styles.preview}>
            <div className={styles.previewTop}>
              <div className={styles.eyebrow}>Live outline</div>
              <h2>Так виглядатиме каталог</h2>
            </div>
            <div className={styles.paper}>
              <div className={styles.paperCover}>
                {selectedLogoSrc ? (
                  <div
                    className={`${styles.paperLogoFrame} ${styles.paperLogoCover} ${
                      branding === "brand"
                        ? `${styles.brandMark} ${
                            brandLogoTone === "light"
                              ? styles.brandMarkDark
                              : brandLogoTone === "dark"
                                ? styles.brandMarkLight
                                : styles.brandMarkUnknown
                          }`
                        : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.paperLogoImage}
                      src={selectedLogoSrc}
                      alt={branding === "brand" ? brandName : "OneCompany"}
                      onLoad={(event) => {
                        if (branding === "brand") {
                          setBrandLogoTone(detectLogoTone(event.currentTarget));
                        }
                      }}
                    />
                  </div>
                ) : null}
                <div className={styles.paperKicker}>Презентаційний каталог</div>
                <h3>{title || "Нова конфігурація"}</h3>
              </div>
              <div className={styles.paperHero}>
                {firstPreviewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstPreviewImage} alt="Перше фото для обкладинки" />
                ) : (
                  <span>Додайте товар — фото з’явиться тут</span>
                )}
              </div>
              <div className={styles.paperBody}>
                <span className={styles.paperAccent} />
                <strong>{subtitle || "Презентаційний каталог"}</strong>
                <p>
                  {selected.length || 0} позицій · {currency} · {languageLabel}
                </p>
              </div>
            </div>
            <div className={styles.previewMeta}>
              <div className={styles.metaBox}>
                <span>Сторінок</span>
                <strong>{documentPages}</strong>
              </div>
              <div className={styles.metaBox}>
                <span>Товарів</span>
                <strong>{selected.length}</strong>
              </div>
              <div className={styles.metaBox}>
                <span>Формат</span>
                <strong>A4 · {layout === "double" ? "2 / стор." : "1 / стор."}</strong>
              </div>
              <div className={styles.metaBox}>
                <span>Фото</span>
                <strong>{firstProduct ? "Авто" : "—"}</strong>
              </div>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={generatePdf}
                disabled={
                  generating ||
                  selected.length === 0 ||
                  !title.trim() ||
                  !subtitle.trim() ||
                  (branding === "brand" &&
                    (!brandName || brandLogoSrc === "/branding/one-company-logo.svg"))
                }
              >
                <Download size={16} />
                {generating ? "Генеруємо…" : "Завантажити PDF"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setSelected([]);
                  setSuccess("");
                }}
                disabled={selected.length === 0}
                aria-label="Очистити вибрані товари"
              >
                <Plus size={16} style={{ transform: "rotate(45deg)" }} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </AdminPage>
  );
}
