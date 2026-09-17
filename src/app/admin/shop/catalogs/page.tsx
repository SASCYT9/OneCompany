"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  Images,
  LayoutTemplate,
  Pencil,
  Plus,
  Percent,
  Search,
  Send,
  RotateCcw,
  Trash2,
  X,
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
  type CatalogBrochureDescriptionMode,
  type CatalogBrochureGalleryLayout,
  type CatalogBrochureImageEdit,
  type CatalogBrochureItemDescriptionMode,
  type CatalogBrochureLayout,
  type CatalogBrochureLanguage,
  type CatalogBrochurePageTemplate,
  type CatalogBrochurePhotoMode,
} from "@/lib/admin/catalogBrochure";
import styles from "./catalog.module.css";
import { getBrandLogo } from "@/lib/brandLogos";
import { useAdminCurrency } from "@/lib/admin/currencyContext";

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
  imageSources: string[];
  galleryLayout: CatalogBrochureGalleryLayout;
  pageTemplate: CatalogBrochurePageTemplate;
  descriptionMode: CatalogBrochureItemDescriptionMode;
  titleOverride: string;
  descriptionOverride: string;
  showSku: boolean;
  showBrand: boolean;
  showPrice: boolean;
  imageEdits: Record<string, CatalogBrochureImageEdit>;
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

function selectedProductImages(entry: SelectedProduct) {
  return entry.imageSources.length
    ? entry.imageSources
    : entry.imageSource
      ? [entry.imageSource]
      : [];
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
  const { rates, ratesLoading } = useAdminCurrency();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [search, setSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [resultPages, setResultPages] = useState(1);
  const [currency, setCurrency] = useState<CatalogBrochureCurrency>("EUR");
  const [layout, setLayout] = useState<CatalogBrochureLayout>("single");
  const [photoMode, setPhotoMode] = useState<CatalogBrochurePhotoMode>("gallery");
  const [descriptionMode, setDescriptionMode] = useState<CatalogBrochureDescriptionMode>("short");
  const [language, setLanguage] = useState<CatalogBrochureLanguage>("ua");
  const [branding, setBranding] = useState<CatalogBrochureBranding>("onecompany");
  const [brandName, setBrandName] = useState("");
  const [brandLogoTone, setBrandLogoTone] = useState<"light" | "dark" | "unknown">("unknown");
  const [title, setTitle] = useState("Нова конфігурація");
  const [subtitle, setSubtitle] = useState("Презентаційний каталог");
  const [showPrice, setShowPrice] = useState(true);
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [showContactPage, setShowContactPage] = useState(true);
  const [bulkAdjustmentMode, setBulkAdjustmentMode] = useState<BulkAdjustmentMode>("percent");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeEditorPage, setActiveEditorPage] = useState<string>("cover");
  const [activePhoto, setActivePhoto] = useState<{ productId: string; source: string } | null>(
    null
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(productPage),
          limit: "50",
        });
        if (search.trim()) params.set("search", search.trim());
        const response = await fetch(`/api/admin/shop/catalogs/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Не вдалося завантажити товари.");
        setProducts(Array.isArray(data.products) ? data.products : []);
        setProductTotal(Number(data.metadata?.totalCount) || 0);
        setResultPages(Math.max(1, Number(data.metadata?.totalPages) || 1));
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
  }, [search, productPage]);

  const selectedIds = useMemo(() => new Set(selected.map((entry) => entry.product.id)), [selected]);
  const brandOptions = useMemo(
    () =>
      Array.from(new Set(selected.map((entry) => entry.product.brand).filter(Boolean))) as string[],
    [selected]
  );
  function addProduct(product: CatalogProduct) {
    if (selectedIds.has(product.id)) return;
    const imageSources = productImages(product).slice(0, 8);
    setSelected((current) => [
      ...current,
      {
        product,
        prices: {
          EUR: priceInput(catalogBrochurePrice(product, "EUR", rates)),
          USD: priceInput(catalogBrochurePrice(product, "USD", rates)),
          UAH: priceInput(catalogBrochurePrice(product, "UAH", rates)),
        },
        imageSource: imageSources[0] ?? null,
        imageSources,
        galleryLayout: "auto",
        pageTemplate: "editorial",
        descriptionMode: "inherit",
        titleOverride: "",
        descriptionOverride: "",
        showSku: true,
        showBrand: true,
        showPrice: true,
        imageEdits: Object.fromEntries(
          imageSources.map((source) => [
            source,
            { source, fit: "cover" as const, focusX: 50, focusY: 50, zoom: 1 },
          ])
        ),
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

  useEffect(() => {
    if (!editorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditorOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen]);

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
        const sources = selectedProductImages(entry);
        if (sources.length < 2) return entry;
        const nextSources = [...sources.slice(1), sources[0]];
        return { ...entry, imageSource: nextSources[0], imageSources: nextSources };
      })
    );
  }

  function moveProductImage(id: string, imageIndex: number, direction: -1 | 1) {
    setSelected((current) =>
      current.map((entry) => {
        if (entry.product.id !== id) return entry;
        const nextIndex = imageIndex + direction;
        if (nextIndex < 0 || nextIndex >= entry.imageSources.length) return entry;
        const imageSources = [...entry.imageSources];
        [imageSources[imageIndex], imageSources[nextIndex]] = [
          imageSources[nextIndex],
          imageSources[imageIndex],
        ];
        return { ...entry, imageSource: imageSources[0] ?? null, imageSources };
      })
    );
  }

  function removeProductImage(id: string, imageIndex: number) {
    setSelected((current) =>
      current.map((entry) => {
        if (entry.product.id !== id || entry.imageSources.length <= 1) return entry;
        const imageSources = entry.imageSources.filter((_, index) => index !== imageIndex);
        return { ...entry, imageSource: imageSources[0] ?? null, imageSources };
      })
    );
  }

  function restoreProductImages(id: string) {
    setSelected((current) =>
      current.map((entry) => {
        if (entry.product.id !== id) return entry;
        const imageSources = productImages(entry.product).slice(0, 8);
        return { ...entry, imageSource: imageSources[0] ?? null, imageSources };
      })
    );
  }

  function updateGalleryLayout(id: string, galleryLayout: CatalogBrochureGalleryLayout) {
    setSelected((current) =>
      current.map((entry) => (entry.product.id === id ? { ...entry, galleryLayout } : entry))
    );
  }

  function updateProductPresentation(id: string, patch: Partial<SelectedProduct>) {
    setSelected((current) =>
      current.map((entry) => (entry.product.id === id ? { ...entry, ...patch } : entry))
    );
  }

  function updateImageEdit(id: string, source: string, patch: Partial<CatalogBrochureImageEdit>) {
    setSelected((current) =>
      current.map((entry) => {
        if (entry.product.id !== id) return entry;
        const currentEdit = entry.imageEdits[source] ?? {
          source,
          fit: "cover" as const,
          focusX: 50,
          focusY: 50,
          zoom: 1,
        };
        return {
          ...entry,
          imageEdits: {
            ...entry.imageEdits,
            [source]: { ...currentEdit, ...patch, source },
          },
        };
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

  function catalogPayload() {
    return {
      title,
      subtitle,
      language,
      currency,
      layout,
      photoMode,
      descriptionMode,
      branding,
      brandName: branding === "brand" ? brandName : null,
      showPrice,
      clientName: clientName || null,
      clientCompany: clientCompany || null,
      managerName: managerName || null,
      managerPhone: managerPhone || null,
      managerEmail: managerEmail || null,
      personalNote: personalNote || null,
      validUntil: validUntil || null,
      showContactPage,
      items: selected.map((entry) => ({
        productId: entry.product.id,
        imageSource: entry.imageSources[0] ?? entry.imageSource,
        imageSources: entry.imageSources.length ? entry.imageSources : undefined,
        galleryLayout: entry.galleryLayout,
        pageTemplate: entry.pageTemplate,
        descriptionMode: entry.descriptionMode,
        titleOverride: entry.titleOverride || null,
        descriptionOverride: entry.descriptionOverride || null,
        showSku: entry.showSku,
        showBrand: entry.showBrand,
        showPrice: entry.showPrice,
        imageEdits: entry.imageSources.map(
          (source) =>
            entry.imageEdits[source] ?? {
              source,
              fit: "cover" as const,
              focusX: 50,
              focusY: 50,
              zoom: 1,
            }
        ),
        priceOverride: entry.prices[currency].trim() === "" ? null : Number(entry.prices[currency]),
      })),
    };
  }

  async function generatePdf() {
    setGenerating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/pdf/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalogPayload()),
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

  async function publishPresentation() {
    setPublishing(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/catalog-presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalogPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Не вдалося опублікувати презентацію.");
      setPublishedUrl(data.url);
      await navigator.clipboard?.writeText(data.url).catch(() => undefined);
      setSuccess("Клієнтське посилання створено та скопійовано.");
    } catch (reason) {
      setError((reason as Error).message || "Не вдалося опублікувати презентацію.");
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedUrl() {
    if (!publishedUrl) return;
    await navigator.clipboard?.writeText(publishedUrl);
    setSuccess("Посилання скопійовано.");
  }

  const firstEntry = selected[0];
  const firstProduct = firstEntry?.product;
  const firstPreviewImages = firstEntry ? selectedProductImages(firstEntry) : [];
  const firstPreviewImage = firstPreviewImages[0] || firstProduct?.imageUrl || null;
  const editorPreviewEntry =
    activeEditorPage === "cover"
      ? firstEntry
      : (selected.find((entry) => entry.product.id === activeEditorPage) ?? firstEntry);
  const editorPreviewSourceImages = editorPreviewEntry
    ? selectedProductImages(editorPreviewEntry)
    : [];
  const editorPreviewImages = (
    photoMode === "gallery" ? editorPreviewSourceImages : editorPreviewSourceImages.slice(0, 1)
  ).slice(0, 4);
  const previewUsesFeatureLayout =
    photoMode === "gallery" &&
    editorPreviewImages.length > 1 &&
    (editorPreviewEntry?.galleryLayout === "feature" ||
      (editorPreviewEntry?.galleryLayout === "auto" && editorPreviewImages.length === 3));
  const productPages = catalogBrochureProductPageCount(selected.length, layout);
  const summaryPages = selected.length ? Math.ceil(selected.length / 8) : 0;
  const documentPages = selected.length
    ? productPages +
      summaryPages +
      1 +
      (showContactPage && (managerName || managerPhone || managerEmail || personalNote) ? 1 : 0)
    : "—";
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
                <span className={styles.fieldHint}>
                  Відсутні ціни автоматично перераховуються за курсом НБУ
                  {ratesLoading ? " · оновлюємо курс…" : ""}.
                </span>
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
                Фотографії товару
                <select
                  value={photoMode}
                  onChange={(event) => setPhotoMode(event.target.value as CatalogBrochurePhotoMode)}
                >
                  <option value="gallery">Всі доступні фото</option>
                  <option value="hero">Тільки головне фото</option>
                </select>
                <span className={styles.fieldHint}>
                  Галерея покаже всі фото, які є в Catalog V2.
                </span>
              </label>
              <label className={styles.field}>
                Опис у PDF
                <select
                  value={descriptionMode}
                  onChange={(event) =>
                    setDescriptionMode(event.target.value as CatalogBrochureDescriptionMode)
                  }
                >
                  <option value="short">Короткий</option>
                  <option value="full">Розгорнутий</option>
                  <option value="none">Без опису</option>
                </select>
                <span className={styles.fieldHint}>
                  Короткий режим залишає лише найважливіше для швидкого читання.
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
                <div className={styles.eyebrow}>02 / Персоналізація</div>
                <h2>Підготуйте для клієнта</h2>
              </div>
              <Send size={20} color="#79a9ff" aria-hidden="true" />
            </div>
            <div className={styles.fields}>
              <label className={styles.field}>
                Ім’я клієнта
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  maxLength={120}
                />
              </label>
              <label className={styles.field}>
                Компанія клієнта
                <input
                  value={clientCompany}
                  onChange={(event) => setClientCompany(event.target.value)}
                  maxLength={160}
                />
              </label>
              <label className={styles.field}>
                Менеджер
                <input
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                  maxLength={120}
                />
              </label>
              <label className={styles.field}>
                Пропозиція дійсна до
                <input
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Телефон менеджера
                <input
                  value={managerPhone}
                  onChange={(event) => setManagerPhone(event.target.value)}
                  maxLength={80}
                />
              </label>
              <label className={styles.field}>
                Email менеджера
                <input
                  type="email"
                  value={managerEmail}
                  onChange={(event) => setManagerEmail(event.target.value)}
                  maxLength={180}
                />
              </label>
              <label className={`${styles.field} ${styles.full}`}>
                Персональне повідомлення
                <textarea
                  value={personalNote}
                  onChange={(event) => setPersonalNote(event.target.value)}
                  maxLength={700}
                  rows={3}
                  placeholder="Коротке звернення або важлива умова для клієнта"
                />
              </label>
            </div>
            <div className={styles.toggles}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={showContactPage}
                  onChange={(event) => setShowContactPage(event.target.checked)}
                />
                Додати фінальну сторінку з контактами
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>03 / Каталог V2</div>
                <h2>Додайте товари</h2>
              </div>
              <Images size={20} color="#79a9ff" aria-hidden="true" />
            </div>
            <label className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setProductPage(1);
                }}
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
                            money(catalogBrochurePrice(product, currency, rates), currency)
                          )}
                        </span>
                      </button>
                    );
                  })
                : null}
            </div>
            <div className={styles.resultFooter}>
              <div className={styles.resultCount}>
                <span>
                  Пошук через Catalog V2 ·{" "}
                  {productTotal > 0 ? `знайдено ${productTotal}` : "0 товарів"}
                </span>
                <div className={styles.resultPagination} aria-label="Сторінки результатів каталогу">
                  <button
                    type="button"
                    aria-label="Попередня сторінка товарів"
                    disabled={loading || productPage <= 1}
                    onClick={() => setProductPage((value) => value - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    {productPage} / {resultPages}
                  </span>
                  <button
                    type="button"
                    aria-label="Наступна сторінка товарів"
                    disabled={loading || productPage >= resultPages}
                    onClick={() => setProductPage((value) => value + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              <span>{selected.length} вибрано</span>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>04 / Комплектація</div>
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
                  <div className={styles.bulkHint}>
                    Від поточних цін у {currency} · конвертація відсутніх цін за курсом НБУ
                  </div>
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
              <div
                className={`${styles.paperHero} ${
                  photoMode === "gallery" && firstPreviewImages.length > 1
                    ? styles.paperGallery
                    : ""
                }`}
              >
                {firstPreviewImages.length ? (
                  photoMode === "gallery" && firstPreviewImages.length > 1 ? (
                    <>
                      {firstPreviewImages.slice(0, 6).map((source, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={`${source}-${index}`} src={source} alt="" />
                      ))}
                      {firstPreviewImages.length > 6 ? (
                        <span className={styles.galleryCount}>
                          +{firstPreviewImages.length - 6}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstPreviewImage ?? undefined} alt="Перше фото для обкладинки" />
                  )
                ) : (
                  <span>Додайте товар — фото з’явиться тут</span>
                )}
              </div>
              <div className={styles.paperBody}>
                <span className={styles.paperAccent} />
                <strong>{subtitle || "Презентаційний каталог"}</strong>
                <p>
                  {selected.length || 0} позицій · {currency} · {languageLabel} ·{" "}
                  {descriptionMode === "short"
                    ? "короткі описи"
                    : descriptionMode === "none"
                      ? "без описів"
                      : "повні описи"}
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
                <strong>
                  {firstProduct
                    ? `${firstPreviewImages.length || 1} · ${photoMode === "gallery" ? "галерея" : "головне"}`
                    : "—"}
                </strong>
              </div>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.editorButton}
                onClick={() => setEditorOpen(true)}
                disabled={selected.length === 0}
              >
                <Pencil size={15} />
                Фінальна редакція
              </button>
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
                className={styles.publishButton}
                onClick={publishPresentation}
                disabled={publishing || selected.length === 0 || !title.trim() || !subtitle.trim()}
              >
                <Send size={16} />
                {publishing ? "Публікуємо…" : "Створити посилання"}
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
            {publishedUrl ? (
              <div className={styles.publishedLink}>
                <span>{publishedUrl}</span>
                <button type="button" onClick={copyPublishedUrl} title="Скопіювати посилання">
                  <Copy size={15} />
                </button>
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Відкрити презентацію"
                >
                  <ExternalLink size={15} />
                </a>
              </div>
            ) : null}
          </section>
        </aside>
      </div>

      {editorOpen ? (
        <div
          className={styles.editorBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditorOpen(false);
          }}
        >
          <section
            className={styles.editorDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.editorHeader}>
              <div>
                <div className={styles.eyebrow}>05 / Перед генерацією</div>
                <h2 id="catalog-editor-title">Фінальна редакція каталогу</h2>
                <p>Перевірте обкладинку, фото та порядок позицій прямо в браузері.</p>
              </div>
              <button
                type="button"
                className={styles.editorClose}
                onClick={() => setEditorOpen(false)}
                aria-label="Закрити редактор"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.editorToolbar}>
              <label className={styles.editorField}>
                Назва
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                />
              </label>
              <label className={styles.editorField}>
                Підзаголовок
                <input
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  maxLength={220}
                />
              </label>
              <label className={styles.editorField}>
                Фото
                <select
                  value={photoMode}
                  onChange={(event) => setPhotoMode(event.target.value as CatalogBrochurePhotoMode)}
                >
                  <option value="gallery">Всі доступні</option>
                  <option value="hero">Тільки головне</option>
                </select>
              </label>
              <label className={styles.editorField}>
                Текст
                <select
                  value={descriptionMode}
                  onChange={(event) =>
                    setDescriptionMode(event.target.value as CatalogBrochureDescriptionMode)
                  }
                >
                  <option value="short">Короткий</option>
                  <option value="full">Розгорнутий</option>
                  <option value="none">Без опису</option>
                </select>
              </label>
              <label className={styles.editorToggle}>
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(event) => setShowPrice(event.target.checked)}
                />
                Ціни
              </label>
            </div>
            <div className={styles.editorBody}>
              <aside className={styles.pageRail} aria-label="Сторінки каталогу">
                <div className={styles.pageRailLabel}>Сторінки</div>
                <button
                  type="button"
                  className={activeEditorPage === "cover" ? styles.pageThumbActive : undefined}
                  onClick={() => setActiveEditorPage("cover")}
                >
                  <span className={styles.pageThumbPreview}>01</span>
                  <strong>Обкладинка</strong>
                </button>
                {selected.map((entry, index) => (
                  <button
                    type="button"
                    key={entry.product.id}
                    className={
                      activeEditorPage === entry.product.id ? styles.pageThumbActive : undefined
                    }
                    onClick={() => setActiveEditorPage(entry.product.id)}
                  >
                    <span className={styles.pageThumbImage}>
                      {entry.imageSources[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.imageSources[0]} alt="" />
                      ) : (
                        String(index + 2).padStart(2, "0")
                      )}
                    </span>
                    <strong>
                      {String(index + 2).padStart(2, "0")} · {productName(entry.product)}
                    </strong>
                  </button>
                ))}
              </aside>
              <div className={styles.editorCanvas}>
                <div className={styles.editorCanvasLabel}>Попередній перегляд</div>
                <div className={styles.editorPaper}>
                  <div className={styles.editorPaperTop}>
                    {selectedLogoSrc ? (
                      <div
                        className={`${styles.editorPaperLogo} ${
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
                          src={selectedLogoSrc}
                          alt={branding === "brand" ? brandName : "OneCompany"}
                        />
                      </div>
                    ) : null}
                    <span>
                      {activeEditorPage === "cover"
                        ? "ПРЕЗЕНТАЦІЙНИЙ КАТАЛОГ"
                        : `СТОРІНКА · ${(editorPreviewEntry?.pageTemplate ?? "editorial").toUpperCase()}`}
                    </span>
                    <strong>
                      {activeEditorPage === "cover"
                        ? title || "Нова конфігурація"
                        : editorPreviewEntry?.titleOverride ||
                          (editorPreviewEntry ? productName(editorPreviewEntry.product) : title)}
                    </strong>
                  </div>
                  <div
                    className={`${styles.editorPaperGallery} ${
                      editorPreviewImages.length === 1
                        ? styles.editorPaperGallerySingle
                        : previewUsesFeatureLayout
                          ? styles.editorPaperGalleryFeature
                          : editorPreviewImages.length === 3
                            ? styles.editorPaperGalleryTriple
                            : ""
                    }`}
                  >
                    {editorPreviewImages.length ? (
                      editorPreviewImages.map((source, index) => {
                        const edit = editorPreviewEntry?.imageEdits[source];
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${source}-${index}`}
                            src={source}
                            alt=""
                            style={{
                              objectFit: edit?.fit ?? "cover",
                              objectPosition: `${edit?.focusX ?? 50}% ${edit?.focusY ?? 50}%`,
                              transform: `scale(${edit?.zoom ?? 1})`,
                              transformOrigin: `${edit?.focusX ?? 50}% ${edit?.focusY ?? 50}%`,
                            }}
                          />
                        );
                      })
                    ) : (
                      <span>ФОТО ТОВАРУ</span>
                    )}
                  </div>
                  <div className={styles.editorPaperBottom}>
                    <span className={styles.paperAccent} />
                    <strong>
                      {activeEditorPage === "cover"
                        ? subtitle || "Презентаційний каталог"
                        : editorPreviewEntry?.descriptionOverride || subtitle}
                    </strong>
                    <span>
                      {selected.length} позицій · {currency} · {languageLabel}
                    </span>
                  </div>
                </div>
                <div className={styles.editorCanvasHint}>
                  {activeEditorPage === "cover"
                    ? "Живий перегляд обкладинки. Виберіть сторінку зліва, щоб редагувати конкретний товар."
                    : "Попередній перегляд вибраної сторінки. Кадрування, порядок фото й тексти повторяться у PDF."}
                </div>
              </div>
              <div className={styles.editorProducts}>
                <div className={styles.editorProductsHeading}>
                  <div>
                    <div className={styles.eyebrow}>Вміст PDF</div>
                    <h3>Позиції каталогу</h3>
                  </div>
                  <span>{selected.length} товарів</span>
                </div>
                <div className={styles.editorProductList}>
                  {selected.map((entry, index) => {
                    const images = selectedProductImages(entry);
                    const allImages = productImages(entry.product).slice(0, 8);
                    const editingSource =
                      activePhoto?.productId === entry.product.id &&
                      images.includes(activePhoto.source)
                        ? activePhoto.source
                        : images[0];
                    const editingImage = editingSource
                      ? (entry.imageEdits[editingSource] ?? {
                          source: editingSource,
                          fit: "cover" as const,
                          focusX: 50,
                          focusY: 50,
                          zoom: 1,
                        })
                      : null;
                    return (
                      <article
                        className={styles.editorProductCard}
                        key={entry.product.id}
                        onFocus={() => setActiveEditorPage(entry.product.id)}
                      >
                        <div className={styles.editorProductTop}>
                          <span className={styles.editorProductIndex}>
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className={styles.editorProductPhotoSummary}>
                            <Images size={14} />
                            {images.length} з {allImages.length} фото у PDF
                          </div>
                          <div className={styles.editorProductActions}>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => moveProduct(index, -1)}
                              disabled={index === 0}
                              aria-label="Перемістити вище"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => moveProduct(index, 1)}
                              disabled={index === selected.length - 1}
                              aria-label="Перемістити нижче"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.removeButton}
                              onClick={() => removeProduct(entry.product.id)}
                              aria-label={`Видалити ${productName(entry.product)}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <div className={styles.editorProductInfo}>
                          <strong>{productName(entry.product)}</strong>
                          <span>
                            {entry.product.sku || "Артикул не вказаний"} · {images.length || 0} фото
                          </span>
                        </div>
                        <div className={styles.pageTemplatePanel}>
                          <div>
                            <strong>Шаблон сторінки</strong>
                            <span>Окрема композиція для цієї позиції.</span>
                          </div>
                          <div className={styles.templateGrid}>
                            {(
                              [
                                ["editorial", "Редакційний"],
                                ["gallery", "Галерея"],
                                ["technical", "Технічний"],
                                ["minimal", "Мінімальний"],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                type="button"
                                key={value}
                                className={
                                  entry.pageTemplate === value ? styles.templateActive : undefined
                                }
                                onClick={() => {
                                  updateProductPresentation(entry.product.id, {
                                    pageTemplate: value,
                                  });
                                  setActiveEditorPage(entry.product.id);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.copyEditor}>
                          <label>
                            Назва на сторінці
                            <input
                              value={entry.titleOverride}
                              onChange={(event) =>
                                updateProductPresentation(entry.product.id, {
                                  titleOverride: event.target.value,
                                })
                              }
                              onFocus={() => setActiveEditorPage(entry.product.id)}
                              placeholder={productName(entry.product)}
                              maxLength={180}
                            />
                          </label>
                          <label>
                            Режим опису
                            <select
                              value={entry.descriptionMode}
                              onChange={(event) =>
                                updateProductPresentation(entry.product.id, {
                                  descriptionMode: event.target
                                    .value as CatalogBrochureItemDescriptionMode,
                                })
                              }
                            >
                              <option value="inherit">Як у каталозі</option>
                              <option value="short">Короткий</option>
                              <option value="full">Повний</option>
                              <option value="technical">Технічний</option>
                              <option value="custom">Власний текст</option>
                              <option value="none">Без опису</option>
                            </select>
                          </label>
                          {entry.descriptionMode === "custom" ? (
                            <label className={styles.copyEditorFull}>
                              Власний опис
                              <textarea
                                value={entry.descriptionOverride}
                                onChange={(event) =>
                                  updateProductPresentation(entry.product.id, {
                                    descriptionOverride: event.target.value,
                                  })
                                }
                                onFocus={() => setActiveEditorPage(entry.product.id)}
                                rows={4}
                                maxLength={1200}
                              />
                            </label>
                          ) : null}
                          <div className={styles.itemToggles}>
                            {(
                              [
                                ["showSku", "Артикул"],
                                ["showBrand", "Бренд"],
                                ["showPrice", "Ціна"],
                              ] as const
                            ).map(([field, label]) => (
                              <label key={field}>
                                <input
                                  type="checkbox"
                                  checked={entry[field]}
                                  onChange={(event) =>
                                    updateProductPresentation(entry.product.id, {
                                      [field]: event.target.checked,
                                    })
                                  }
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                        {images.length ? (
                          <div className={styles.photoManager}>
                            <div className={styles.photoManagerHeader}>
                              <div>
                                <strong>Фото товару</strong>
                                <span>Перше фото буде головним та акцентним.</span>
                              </div>
                              {images.length < allImages.length ? (
                                <button
                                  type="button"
                                  className={styles.photoRestoreButton}
                                  onClick={() => restoreProductImages(entry.product.id)}
                                >
                                  <RotateCcw size={13} />
                                  Відновити всі
                                </button>
                              ) : null}
                            </div>
                            <div className={styles.photoManagerGrid}>
                              {images.map((source, imageIndex) => (
                                <div
                                  className={`${styles.photoTile} ${editingSource === source ? styles.photoTileSelected : ""}`}
                                  key={`${source}-${imageIndex}`}
                                  onClick={() => {
                                    setActivePhoto({ productId: entry.product.id, source });
                                    setActiveEditorPage(entry.product.id);
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={source}
                                    alt={`Фото ${imageIndex + 1}`}
                                    style={{
                                      objectFit: entry.imageEdits[source]?.fit ?? "cover",
                                      objectPosition: `${entry.imageEdits[source]?.focusX ?? 50}% ${entry.imageEdits[source]?.focusY ?? 50}%`,
                                      transform: `scale(${entry.imageEdits[source]?.zoom ?? 1})`,
                                      transformOrigin: `${entry.imageEdits[source]?.focusX ?? 50}% ${entry.imageEdits[source]?.focusY ?? 50}%`,
                                    }}
                                  />
                                  <span className={styles.photoOrderBadge}>{imageIndex + 1}</span>
                                  {imageIndex === 0 ? (
                                    <span className={styles.photoPrimaryBadge}>Головне</span>
                                  ) : null}
                                  <div className={styles.photoTileActions}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProductImage(entry.product.id, imageIndex, -1)
                                      }
                                      disabled={imageIndex === 0}
                                      aria-label={`Перемістити фото ${imageIndex + 1} ліворуч`}
                                      title="Перемістити ліворуч"
                                    >
                                      <ArrowLeft size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveProductImage(entry.product.id, imageIndex, 1)
                                      }
                                      disabled={imageIndex === images.length - 1}
                                      aria-label={`Перемістити фото ${imageIndex + 1} праворуч`}
                                      title="Перемістити праворуч"
                                    >
                                      <ArrowRight size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.photoRemoveButton}
                                      onClick={() =>
                                        removeProductImage(entry.product.id, imageIndex)
                                      }
                                      disabled={images.length <= 1}
                                      aria-label={`Прибрати фото ${imageIndex + 1} з PDF`}
                                      title={
                                        images.length <= 1
                                          ? "У PDF має залишитися хоча б одне фото"
                                          : "Прибрати лише з цього PDF"
                                      }
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {editingSource && editingImage ? (
                              <div className={styles.cropPanel}>
                                <div className={styles.cropPanelTitle}>
                                  <Crop size={14} /> Кадрування фото
                                </div>
                                <div className={styles.cropFitControl}>
                                  {(["cover", "contain"] as const).map((fit) => (
                                    <button
                                      type="button"
                                      key={fit}
                                      className={
                                        editingImage.fit === fit ? styles.cropFitActive : undefined
                                      }
                                      onClick={() =>
                                        updateImageEdit(entry.product.id, editingSource, { fit })
                                      }
                                    >
                                      {fit === "cover" ? "Заповнити" : "Вмістити"}
                                    </button>
                                  ))}
                                </div>
                                <label>
                                  Масштаб <span>{editingImage.zoom.toFixed(2)}×</span>
                                  <input
                                    type="range"
                                    min="1"
                                    max="2"
                                    step="0.05"
                                    value={editingImage.zoom}
                                    onChange={(event) =>
                                      updateImageEdit(entry.product.id, editingSource, {
                                        zoom: Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  По горизонталі <span>{editingImage.focusX}%</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={editingImage.focusX}
                                    onChange={(event) =>
                                      updateImageEdit(entry.product.id, editingSource, {
                                        focusX: Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  По вертикалі <span>{editingImage.focusY}%</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={editingImage.focusY}
                                    onChange={(event) =>
                                      updateImageEdit(entry.product.id, editingSource, {
                                        focusY: Number(event.target.value),
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            ) : null}
                            {photoMode === "gallery" && images.length > 1 ? (
                              <div className={styles.photoLayoutRow}>
                                <div>
                                  <strong>Композиція</strong>
                                  <span>
                                    «Авто» прибирає пусті місця для будь-якої кількості фото.
                                  </span>
                                </div>
                                <div className={styles.photoLayoutControl}>
                                  {(
                                    [
                                      ["auto", "Авто"],
                                      ["feature", "Акцент"],
                                      ["grid", "Сітка"],
                                    ] as const
                                  ).map(([value, label]) => (
                                    <button
                                      type="button"
                                      key={value}
                                      className={
                                        entry.galleryLayout === value
                                          ? styles.photoLayoutActive
                                          : undefined
                                      }
                                      onClick={() => updateGalleryLayout(entry.product.id, value)}
                                      aria-pressed={entry.galleryLayout === value}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <label className={styles.editorPriceField}>
                          <span>Ціна · {currency}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={entry.prices[currency]}
                            onChange={(event) => updatePrice(entry.product.id, event.target.value)}
                          />
                        </label>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className={styles.editorFooter}>
              <span>Ціни та редагування діють лише для цього PDF.</span>
              <div>
                <button
                  type="button"
                  className={styles.editorSecondary}
                  onClick={() => setEditorOpen(false)}
                >
                  Готово
                </button>
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
                  {generating ? "Генеруємо…" : "Завантажити фінальний PDF"}
                </button>
                <button
                  type="button"
                  className={styles.publishButton}
                  onClick={publishPresentation}
                  disabled={
                    publishing || selected.length === 0 || !title.trim() || !subtitle.trim()
                  }
                >
                  <Send size={16} />
                  {publishing ? "Публікуємо…" : "Посилання клієнту"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminPage>
  );
}
