"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { stockTelegramText, splitTelegramText } from "@/lib/admin/stockTelegram";
import { Field, Thumbnail, productTitle, type Product } from "./shared";
import styles from "./proforma.module.css";

export function StockExportPanel({
  active,
  onAdd,
  addDisabled,
}: {
  active: boolean;
  onAdd: (product: Product) => Promise<void>;
  addDisabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Product[]>([]);
  const [language, setLanguage] = useState<"en" | "ua">("en");
  const [copied, setCopied] = useState<number | null>(null);
  const [copyError, setCopyError] = useState("");
  const [part, setPart] = useState(0);
  const text = stockTelegramText(selected, language);
  const chunks = splitTelegramText(text);
  const currentPart = Math.min(part, Math.max(0, chunks.length - 1));

  useEffect(() => {
    setCopied(null);
    setCopyError("");
  }, [text, currentPart]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setProducts([]);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/shop/products?availability=confirmed&status=ACTIVE&search=${encodeURIComponent(search.trim())}&page=${page}&limit=20`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? "Немає доступу до каталогу."
              : "Не вдалося завантажити наявність. Повторіть запит."
          );
        const data = await response.json();
        if (controller.signal.aborted) return;
        setProducts(data.products);
        setTotal(data.metadata.totalCount);
        setPages(Math.max(1, data.metadata.totalPages));
        // Reconcile selected records when their page is revisited; preserve selection across pages.
        setSelected((current) =>
          current.map(
            (entry) => data.products.find((item: Product) => item.id === entry.id) ?? entry
          )
        );
      } catch (err) {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Помилка завантаження.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [active, search, page, reload]);

  function toggle(product: Product) {
    setSelected((current) =>
      current.some((entry) => entry.id === product.id)
        ? current.filter((entry) => entry.id !== product.id)
        : [...current, product]
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(chunks[currentPart]);
      setCopied(currentPart);
      setCopyError("");
    } catch {
      setCopyError(
        "Браузер не дозволив копіювання. Виділіть текст у полі нижче та скопіюйте вручну або завантажте TXT."
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "onecompany-in-stock.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={styles.stockLayout}>
      <section className={styles.card}>
        <div className={styles.row}>
          <div>
            <span className={styles.eyebrow}>Каталог · наявність</span>
            <h2 className={styles.stockHeading}>Готові до пропозиції</h2>
          </div>
          <button
            className={styles.secondary}
            type="button"
            disabled={loading}
            onClick={() => {
              setSelected([]);
              setReload((value) => value + 1);
            }}
            title="Оновити каталог і скинути попередній вибір"
          >
            <RefreshCw size={15} /> Оновити
          </button>
        </div>
        <p className={styles.hint}>
          Підтверджена наявність із того самого джерела, що й на вітрині, включно з цифровими
          товарами. Кількість і потрібний варіант уточнюйте перед відправкою. Оновлення — до 1
          хвилини.
        </p>
        <label className={`${styles.search} ${styles.stockSearch}`}>
          <Search size={18} />
          <input
            aria-label="Пошук товарів у наявності"
            placeholder="Наприклад, Eventuri або EVE-G9X…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className={styles.selectionBar}>
          <span>
            {loading ? "Шукаємо…" : `Знайдено: ${total}`} · вибрано {selected.length}
          </span>
          <button
            type="button"
            disabled={loading || !products.length}
            onClick={() =>
              setSelected((current) => [
                ...new Map([...current, ...products].map((p) => [p.id, p])).values(),
              ])
            }
          >
            Обрати сторінку
          </button>
          <button type="button" disabled={!selected.length} onClick={() => setSelected([])}>
            Зняти вибір
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className={styles.catalogState} role="status">
            <Loader2 size={20} className={styles.spin} /> Завантажуємо наявність…
          </div>
        ) : !products.length && !error ? (
          <div className={styles.empty}>
            <Package size={28} />
            <strong>Немає товарів за цим запитом</strong>
            <span>Спробуйте інший бренд або артикул.</span>
          </div>
        ) : (
          <div className={styles.stockProducts}>
            {products.map((product) => (
              <div key={product.id} className={styles.stockProduct}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`Обрати для Telegram: ${productTitle(product)}`}
                    checked={selected.some((entry) => entry.id === product.id)}
                    onChange={() => toggle(product)}
                  />
                  <Thumbnail src={product.imageUrl} sources={product.imageSources} />
                  <span className={styles.productInfo}>
                    <strong>{productTitle(product)}</strong>
                    <small>{[product.brand, product.sku].filter(Boolean).join(" · ")}</small>
                    <span className={styles.stockBadge}>Підтверджена наявність</span>
                  </span>
                </label>
                <button
                  className={styles.iconButton}
                  type="button"
                  disabled={addDisabled}
                  aria-label={`До проформи: ${productTitle(product)}`}
                  title="Додати до проформи"
                  onClick={() => void onAdd(product)}
                >
                  <Plus size={19} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={styles.pagination}>
          <button
            className={styles.secondary}
            type="button"
            aria-label="Попередня сторінка"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Сторінка {page} з {pages}
          </span>
          <button
            className={styles.secondary}
            type="button"
            aria-label="Наступна сторінка"
            disabled={loading || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </section>
      <aside className={`${styles.summary} ${styles.telegram}`}>
        <div className={styles.documentIcon}>
          <Send size={22} />
        </div>
        <span className={styles.eyebrow}>Текст для клієнтів</span>
        <h2>Готово для Telegram</h2>
        <p className={styles.hint}>
          Бренди, назви та артикули. Без цін, службових даних і зайвого форматування.
        </p>
        <Field label="Мова назв товарів">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as "en" | "ua")}
          >
            <option value="en">Оригінальні назви · English</option>
            <option value="ua">Українські назви</option>
          </select>
        </Field>
        <div className={styles.messagePreview}>
          {selected.length ? (
            <textarea
              aria-label="Текст для Telegram"
              readOnly
              value={chunks[currentPart] ?? ""}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : (
            <div className={styles.empty}>
              <Send size={27} />
              <strong>Ваш список з’явиться тут</strong>
              <span>Позначте товари ліворуч, які хочете запропонувати клієнтам.</span>
            </div>
          )}
        </div>
        {chunks.length > 1 && (
          <Field
            label={`Повідомлення · ${chunks.length} частини`}
            hint="Великий список розділено на короткі повідомлення."
          >
            <select value={currentPart} onChange={(event) => setPart(Number(event.target.value))}>
              {chunks.map((_, i) => (
                <option key={i} value={i}>
                  Частина {i + 1} з {chunks.length}
                </option>
              ))}
            </select>
          </Field>
        )}
        {copyError && (
          <p className={styles.error} role="alert">
            {copyError}
          </p>
        )}
        <button
          type="button"
          className={styles.primary}
          disabled={!text}
          onClick={() => void copy()}
        >
          {copied === currentPart ? <Check size={17} /> : <Copy size={17} />}
          {copied === currentPart
            ? "Скопійовано"
            : chunks.length > 1
              ? `Копіювати частину ${currentPart + 1}`
              : "Копіювати для Telegram"}
        </button>
        <button type="button" className={styles.secondary} disabled={!text} onClick={download}>
          <Download size={16} /> Завантажити весь список .txt
        </button>
        <p className={styles.hint} role="status">
          {copied === currentPart
            ? "Текст у буфері обміну. Вставте його в потрібний чат."
            : "Лише копіювання. Нічого не публікуємо й не відправляємо."}
        </p>
      </aside>
    </div>
  );
}
