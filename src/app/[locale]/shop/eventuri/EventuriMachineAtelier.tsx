"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, CircleDot, Loader2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";

const EventuriAirflowScene = dynamic(() => import("./EventuriAirflowScene"), {
  ssr: false,
});

type EventuriMoney = {
  eur: number;
  usd: number;
  uah: number;
};

export type EventuriLandingProduct = {
  slug: string;
  href: string;
  image: string;
  title: string;
  type: string;
  price: EventuriMoney;
};

export type EventuriLandingHero = {
  href: string;
  image: string;
  mobileImage: string;
  detailImage: string;
  alt: string;
};

export type EventuriLandingCategory = {
  id: string;
  href: string;
  image: string;
  title: {
    ua: string;
    en: string;
  };
  description: {
    ua: string;
    en: string;
  };
  count: number;
};

type FitmentResponse = {
  data?: string[];
  error?: string;
};

type MatchCountResponse = {
  meta?: {
    totalItems?: number;
  };
};

type Props = {
  locale: SupportedLocale;
  productCount: number;
  catalogHref: string;
  contactHref: string;
  hero: EventuriLandingHero;
  categories: EventuriLandingCategory[];
  featuredProducts: EventuriLandingProduct[];
};

const selectClassName =
  "h-12 min-w-0 max-w-full w-full appearance-none rounded-[3px] border border-black/12 bg-white px-3.5 pr-10 text-[13px] text-[#171717] outline-none transition duration-200 hover:border-black/30 focus:border-[#e31b2d] dark:border-white/14 dark:bg-[#121212] dark:text-white dark:hover:border-white/34 dark:disabled:text-white/28 dark:disabled:hover:border-white/14 disabled:cursor-not-allowed disabled:text-black/35";

function localized(locale: SupportedLocale, ua: string, en: string) {
  return locale === "ua" ? ua : en;
}

function EventuriAmbient({
  darkSrc,
  lightSrc = "/images/eventuri/eventuri-airflow-light.png",
  className = "",
  overlayClassName = "bg-gradient-to-b from-[#f7f6f3]/20 via-[#f7f6f3]/70 to-[#f7f6f3] dark:from-[#070707]/20 dark:via-[#070707]/72 dark:to-[#070707]",
}: {
  darkSrc: string;
  lightSrc?: string;
  className?: string;
  overlayClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden ${className}`}
    >
      <Image
        src={lightSrc}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center opacity-[0.24] dark:hidden"
      />
      <Image
        src={darkSrc}
        alt=""
        fill
        sizes="100vw"
        className="hidden object-cover object-center opacity-[0.28] dark:block"
      />
      <div className={`absolute inset-0 ${overlayClassName}`} />
    </div>
  );
}

function buildFitmentUrl(input: { make?: string; model?: string; chassis?: string }) {
  const params = new URLSearchParams({ scope: "auto", brand: "Eventuri" });
  if (input.make) params.set("make", input.make);
  if (input.model) params.set("model", input.model);
  if (input.chassis) params.set("chassis", input.chassis);
  return `/api/shop/stock/fitment?${params.toString()}`;
}

function FitmentSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 max-w-full overflow-hidden">
      <span className="mb-2 block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-black/48 dark:text-white/48">
        {label}
      </span>
      <span className="relative block min-w-0 max-w-full overflow-hidden">
        <select {...props} className={selectClassName}>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
        />
      </span>
    </label>
  );
}

function EventuriVehicleFinder({
  locale,
  catalogHref,
  contactHref,
}: Pick<Props, "locale" | "catalogHref" | "contactHref">) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isUa = locale === "ua";
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [chassis, setChassis] = useState("");
  const [engine, setEngine] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [chassisLoading, setChassisLoading] = useState(false);
  const [enginesLoading, setEnginesLoading] = useState(false);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setMakesLoading(true);
    setError("");

    fetch(buildFitmentUrl({}), { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as FitmentResponse;
        if (!response.ok) throw new Error(payload.error || "Fitment request failed");
        return payload;
      })
      .then((payload) => setMakes(payload.data ?? []))
      .catch(() => {
        if (!controller.signal.aborted) {
          setMakes([]);
          setError(
            isUa
              ? "Не вдалося завантажити марки автомобілів. Спробуйте ще раз."
              : "Vehicle makes could not be loaded. Please try again."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setMakesLoading(false);
      });

    return () => controller.abort();
  }, [isUa]);

  useEffect(() => {
    setModel("");
    setChassis("");
    setEngine("");
    setModels([]);
    setChassisCodes([]);
    setEngines([]);
    if (!make) return;

    const controller = new AbortController();
    setModelsLoading(true);
    setError("");

    fetch(buildFitmentUrl({ make }), { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as FitmentResponse;
        if (!response.ok) throw new Error(payload.error || "Fitment request failed");
        return payload;
      })
      .then((payload) => setModels(payload.data ?? []))
      .catch(() => {
        if (!controller.signal.aborted) {
          setModels([]);
          setError(
            isUa
              ? "Не вдалося завантажити моделі для цієї марки."
              : "Models for this make could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });

    return () => controller.abort();
  }, [isUa, make]);

  useEffect(() => {
    setChassis("");
    setEngine("");
    setChassisCodes([]);
    setEngines([]);
    if (!make || !model) return;

    const controller = new AbortController();
    setChassisLoading(true);
    setError("");

    fetch(buildFitmentUrl({ make, model }), { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as FitmentResponse;
        if (!response.ok) throw new Error(payload.error || "Fitment request failed");
        return payload;
      })
      .then((payload) => setChassisCodes(payload.data ?? []))
      .catch(() => {
        if (!controller.signal.aborted) {
          setChassisCodes([]);
          setError(
            isUa
              ? "Не вдалося завантажити кузови для цієї моделі."
              : "Chassis options for this model could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setChassisLoading(false);
      });

    return () => controller.abort();
  }, [isUa, make, model]);

  useEffect(() => {
    setEngine("");
    setEngines([]);
    if (!make || !model || !chassis) return;

    const controller = new AbortController();
    setEnginesLoading(true);

    fetch(buildFitmentUrl({ make, model, chassis }), { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as FitmentResponse;
        if (!response.ok) throw new Error(payload.error || "Fitment request failed");
        return payload;
      })
      .then((payload) => setEngines(payload.data ?? []))
      .catch(() => {
        if (!controller.signal.aborted) {
          setEngines([]);
          setError(
            isUa
              ? "Не вдалося завантажити двигуни для цього авто."
              : "Engines for this vehicle could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEnginesLoading(false);
      });

    return () => controller.abort();
  }, [chassis, isUa, make, model]);

  useEffect(() => {
    setMatchCount(null);
    if (!make || !model || !chassis) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      scope: "auto",
      brand: "Eventuri",
      make,
      model,
      chassis,
      locale,
      page: "1",
      limit: "1",
    });
    if (engine) params.set("engine", engine);

    setMatchesLoading(true);
    fetch(`/api/shop/stock/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as MatchCountResponse;
        if (!response.ok) throw new Error("Product match request failed");
        return payload;
      })
      .then((payload) => setMatchCount(payload.meta?.totalItems ?? 0))
      .catch(() => {
        if (!controller.signal.aborted) setMatchCount(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMatchesLoading(false);
      });

    return () => controller.abort();
  }, [chassis, engine, locale, make, model]);

  const selection = useMemo(
    () => [make, model, chassis, engine].filter(Boolean).join(" · "),
    [chassis, engine, make, model]
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!make || !model || !chassis) return;

    const params = new URLSearchParams({
      scope: "auto",
      brand: "Eventuri",
      make,
      model,
      chassis,
    });
    if (engine) params.set("engine", engine);
    router.push(`/${locale}/shop/catalog?${params.toString()}`);
  };

  return (
    <motion.form
      id="eventuri-finder"
      onSubmit={submit}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="min-w-0 max-w-full overflow-hidden border border-black/10 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.12)] dark:border-white/12 dark:bg-[#0d0d0e] dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:p-7 lg:p-8"
      aria-label={isUa ? "Підбір Eventuri за автомобілем" : "Find Eventuri products by vehicle"}
    >
      <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(15rem,0.82fr)_minmax(0,1.7fr)] xl:gap-10">
        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#e31b2d]/55 text-[#e31b2d] dark:text-[#ff5966]">
                <CircleDot className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d7192a] dark:text-[#ff6571]">
                {isUa ? "Підбір за автомобілем" : "Vehicle finder"}
              </p>
            </div>
            <h2 className="mt-5 max-w-xs break-words font-display text-2xl leading-[1] tracking-[-0.035em] text-[#171717] dark:text-white sm:text-[1.9rem]">
              {isUa ? "Вкажіть своє авто." : "Tell us your vehicle."}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-black/58 dark:text-white/58">
              {isUa
                ? "Дані авто звужують каталог. Остаточну сумісність ми підтверджуємо перед замовленням."
                : "Vehicle data narrows the catalogue. We confirm final compatibility before order."}
            </p>
          </div>
          <Link
            href={catalogHref}
            className="mt-6 inline-flex w-fit items-center gap-2 border-b border-black/20 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/65 transition hover:border-[#e31b2d] hover:text-black dark:border-white/25 dark:text-white/72 dark:hover:text-white"
          >
            {isUa ? "Переглянути весь каталог" : "Browse the full catalogue"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="min-w-0 max-w-full">
          <div className="grid min-w-0 grid-cols-1 gap-3 min-[1200px]:grid-cols-[repeat(2,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]">
            <FitmentSelect
              label={isUa ? "Марка" : "Make"}
              value={make}
              disabled={makesLoading}
              onChange={(event) => setMake(event.target.value)}
            >
              <option value="">
                {makesLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : isUa
                    ? "Оберіть марку"
                    : "Select make"}
              </option>
              {makes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </FitmentSelect>

            <FitmentSelect
              label={isUa ? "Модель" : "Model"}
              value={model}
              disabled={!make || modelsLoading}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">
                {modelsLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : !make
                    ? isUa
                      ? "Спочатку марка"
                      : "Choose make first"
                    : isUa
                      ? "Оберіть модель"
                      : "Select model"}
              </option>
              {models.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </FitmentSelect>

            <FitmentSelect
              label={isUa ? "Кузов" : "Chassis"}
              value={chassis}
              disabled={!model || chassisLoading}
              onChange={(event) => setChassis(event.target.value)}
            >
              <option value="">
                {chassisLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : !model
                    ? isUa
                      ? "Спочатку модель"
                      : "Choose model first"
                    : isUa
                      ? "Оберіть кузов"
                      : "Select chassis"}
              </option>
              {chassisCodes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </FitmentSelect>

            <FitmentSelect
              label={isUa ? "Двигун · за потреби" : "Engine · optional"}
              value={engine}
              disabled={!chassis || enginesLoading || engines.length === 0}
              onChange={(event) => setEngine(event.target.value)}
            >
              <option value="">
                {enginesLoading
                  ? isUa
                    ? "Завантаження…"
                    : "Loading…"
                  : engines.length === 0
                    ? isUa
                      ? "Немає даних"
                      : "No data available"
                    : isUa
                      ? "Не обирати"
                      : "Do not select"}
              </option>
              {engines.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </FitmentSelect>
          </div>

          <div className="mt-5 flex min-w-0 flex-col gap-4 border-t border-black/10 pt-5 dark:border-white/10 min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between">
            <div
              className="min-h-5 min-w-0 max-w-full text-xs leading-5 text-black/58 dark:text-white/58"
              aria-live="polite"
            >
              {matchesLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ff6571]" aria-hidden="true" />
                  {isUa ? "Шукаємо товари для цього авто…" : "Finding products for this vehicle…"}
                </span>
              ) : matchCount !== null ? (
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#ff6571]" aria-hidden="true" />
                  {matchCount > 0
                    ? isUa
                      ? `${matchCount} товарів-кандидатів · сумісність підтвердимо за VIN`
                      : `${matchCount} candidate products · fitment confirmed by VIN`
                    : isUa
                      ? "Не знайшли товарів-кандидатів · надішліть VIN, і ми перевіримо"
                      : "No candidate products found · send a VIN and we will check"}
                </span>
              ) : selection ? (
                <span className="inline-flex max-w-full min-w-0 items-center gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#ff6571]" aria-hidden="true" />
                  <span className="truncate">{selection}</span>
                </span>
              ) : (
                <span className="break-words">
                  {isUa
                    ? "Оберіть марку, модель і кузов для точнішого добору."
                    : "Choose make, model and chassis for a narrower selection."}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!make || !model || !chassis}
              className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-[3px] bg-[#d9192b] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#ed3041] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6571] disabled:cursor-not-allowed disabled:bg-black/8 disabled:text-black/35 dark:disabled:bg-white/10 dark:disabled:text-white/35 min-[1200px]:w-auto min-[1200px]:shrink-0"
            >
              {isUa ? "Показати товари" : "Show products"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex min-w-0 flex-col gap-2 border-t border-black/10 pt-4 text-xs text-black/48 dark:border-white/10 dark:text-white/48 min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between">
        <span>
          {isUa
            ? "Потрібна точна перевірка комплектації? Надішліть VIN."
            : "Need a precise configuration check? Send us the VIN."}
        </span>
        <Link
          href={contactHref}
          className="inline-flex w-fit items-center gap-2 font-medium text-black/65 transition hover:text-[#d7192a] dark:text-white/72 dark:hover:text-[#ff6571]"
        >
          {isUa ? "Підтвердити сумісність" : "Confirm fitment"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {error ? <p className="mt-3 text-xs text-[#d7192a] dark:text-[#ff8992]">{error}</p> : null}
    </motion.form>
  );
}

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatted = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function EventuriProductPrice({ locale, price }: Pick<Props, "locale"> & { price: EventuriMoney }) {
  const { currency, rates } = useShopCurrency();
  const requested = currency as "EUR" | "USD" | "UAH";
  let amount = requested === "EUR" ? price.eur : requested === "USD" ? price.usd : price.uah;

  if (amount <= 0 && price.uah > 0 && rates) {
    if (requested === "EUR") amount = price.uah / rates.UAH;
    if (requested === "USD") amount = (price.uah / rates.UAH) * rates.USD;
  }
  if (amount <= 0 && price.eur > 0 && rates) {
    if (requested === "UAH") amount = price.eur * rates.UAH;
    if (requested === "USD") amount = price.eur * rates.USD;
  }
  if (amount <= 0 && price.usd > 0 && rates) {
    if (requested === "EUR") amount = price.usd / rates.USD;
    if (requested === "UAH") amount = (price.usd / rates.USD) * rates.UAH;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return <span>{locale === "ua" ? "Ціну уточнюйте" : "Price on request"}</span>;
  }

  return <span>{formatPrice(locale, Math.round(amount), requested)}</span>;
}

export default function EventuriMachineAtelier({
  locale,
  productCount,
  catalogHref,
  contactHref,
  hero,
  categories,
  featuredProducts,
}: Props) {
  const isUa = locale === "ua";
  const reduceMotion = useReducedMotion();

  return (
    <main className="relative isolate min-h-screen min-w-0 max-w-full overflow-x-clip bg-[#f7f6f3] pb-20 text-[#171717] dark:bg-[#070707] dark:text-white lg:pb-0">
      <EventuriAmbient
        darkSrc="/images/eventuri/eventuri-airflow-dark.png"
        className="h-[48rem] sm:h-[54rem]"
      />
      <EventuriAirflowScene reducedMotion={Boolean(reduceMotion)} />

      <section className="relative z-10 border-b border-black/10 pt-24 dark:border-white/10 sm:pt-28 lg:pt-32">
        <div className="mx-auto min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid min-w-0 overflow-hidden border border-black/10 bg-white dark:border-white/12 dark:bg-[#0c0c0d] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
              className="order-2 flex min-w-0 min-h-[390px] flex-col justify-between p-7 sm:min-h-[420px] sm:p-10 lg:order-1 lg:min-h-[610px] lg:p-12 xl:p-14"
            >
              <div className="min-w-0">
                <Image
                  src="/brands/eventuri-logo-email.png"
                  alt="Eventuri"
                  width={4090}
                  height={452}
                  priority
                  className="h-auto w-[185px] dark:hidden sm:w-[225px]"
                />
                <Image
                  src="/brands/eventuri-logo-dark.png"
                  alt="Eventuri"
                  width={4090}
                  height={452}
                  priority
                  className="hidden h-auto w-[185px] dark:block sm:w-[225px]"
                />
                <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.19em] text-[#d7192a] dark:text-[#ff6571]">
                  {isUa ? "Карбонові системи впуску" : "Carbon intake systems"}
                </p>
                <h1 className="mt-5 max-w-full break-words font-display text-[2rem] leading-[0.98] tracking-[-0.045em] text-[#171717] dark:text-white sm:max-w-xl sm:text-4xl lg:text-[clamp(2.75rem,3.8vw,4.2rem)]">
                  {isUa ? "Підберіть Eventuri для свого авто." : "Find Eventuri for your vehicle."}
                </h1>
                <p className="mt-6 hidden max-w-md text-sm leading-6 text-black/62 dark:text-white/62 sm:block sm:text-base">
                  {isUa
                    ? "Впуски, турбоінлети та карбонові компоненти. Спочатку оберіть авто — перед замовленням ми підтвердимо сумісність."
                    : "Intakes, turbo inlets and carbon components. Select your vehicle first; we confirm final fitment before ordering."}
                </p>
              </div>

              <div className="mt-8 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
                <a
                  href="#eventuri-finder"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-[3px] bg-[#d9192b] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#ed3041]"
                >
                  {isUa ? "Підібрати для мого авто" : "Find parts for my vehicle"}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
                <Link
                  href={catalogHref}
                  className="inline-flex w-fit items-center gap-2 border-b border-black/20 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/65 transition hover:border-[#e31b2d] hover:text-black dark:border-white/25 dark:text-white/74 dark:hover:text-white"
                >
                  {isUa ? `Усі ${productCount} товарів` : `Browse all ${productCount} products`}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 1.02 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              className="order-1 min-w-0 lg:order-2"
            >
              <Link
                href={hero.href}
                className="group relative block min-h-[285px] min-w-0 overflow-hidden bg-[#ecebe7] dark:bg-[#151515] sm:min-h-[300px] lg:min-h-[610px]"
                aria-label={
                  isUa ? "Впуск Eventuri для BMW M5 G90/G99" : "Eventuri intake for BMW M5 G90/G99"
                }
              >
                <Image
                  src={hero.mobileImage}
                  alt={hero.alt}
                  fill
                  priority
                  sizes="(max-width: 639px) 100vw, 1px"
                  className="object-cover object-center transition duration-700 group-hover:scale-[1.025] sm:hidden"
                />
                <Image
                  src={hero.image}
                  alt={hero.alt}
                  fill
                  priority
                  sizes="(max-width: 1023px) 100vw, 58vw"
                  className="hidden object-cover object-[58%_center] transition duration-700 group-hover:scale-[1.025] sm:block"
                />
                <div className="absolute inset-x-0 bottom-0 flex min-w-0 items-center justify-between gap-2 border-t border-black/10 bg-white/92 px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/70 dark:border-white/12 dark:bg-[#080808]/94 dark:text-white/70 sm:gap-4 sm:px-6 sm:tracking-[0.14em]">
                  <span className="shrink-0">BMW M5 G90/G99</span>
                  <span className="inline-flex min-w-0 max-w-[58%] shrink-0 items-center justify-end gap-1.5 text-right text-black dark:text-white sm:gap-2 sm:max-w-[52%]">
                    <span className="min-w-0 truncate">
                      {isUa ? "Система впуску" : "Intake system"}
                    </span>
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </motion.div>
          </div>

          <div className="relative z-10 pb-14 pt-5 sm:pb-20 lg:-mt-10 lg:pb-24">
            <EventuriVehicleFinder
              locale={locale}
              catalogHref={catalogHref}
              contactHref={contactHref}
            />
          </div>
        </div>
      </section>

      <section
        id="eventuri-catalog"
        className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24"
      >
        <div className="flex min-w-0 flex-col gap-5 border-b border-black/10 pb-8 dark:border-white/12 sm:flex-row sm:items-end sm:justify-between lg:pb-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#ff6571]">
              {isUa ? "Каталог Eventuri" : "Eventuri catalogue"}
            </p>
            <h2 className="mt-4 max-w-2xl break-words font-display text-2xl leading-[1] tracking-[-0.035em] text-[#171717] dark:text-white sm:text-3xl lg:text-4xl">
              {isUa ? "Оберіть тип компонента." : "Choose a component type."}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-black/56 dark:text-white/54 sm:text-right">
            {isUa
              ? "П’ять практичних груп каталогу — без випадкових підбірок і повторів."
              : "Five practical catalogue groups — no arbitrary collections or duplicate routes."}
          </p>
        </div>

        <div className="mt-8 grid min-w-0 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
          {categories.map((category) => (
            <motion.div
              key={category.id}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.16 }}
              transition={{
                duration: 0.5,
                delay: reduceMotion ? 0 : Math.min(category.count / 1000, 0.2),
                ease: "easeOut",
              }}
              className="min-w-0 h-full sm:last:col-span-2 xl:last:col-span-1"
            >
              <Link
                href={category.href}
                className="group flex h-full min-w-0 flex-col overflow-hidden border border-black/10 bg-white transition duration-300 hover:-translate-y-1 hover:border-[#e31b2d]/80 hover:shadow-[0_18px_46px_rgba(0,0,0,0.16)] dark:border-white/12 dark:bg-[#0d0d0e] dark:hover:shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eeece8] p-5 sm:p-6">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 20vw"
                    className="object-contain p-5 transition duration-500 group-hover:scale-[1.045]"
                  />
                  <span
                    className="absolute left-0 top-0 h-[3px] w-0 bg-[#e31b2d] transition-all duration-300 group-hover:w-full"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/45 dark:text-white/46">
                      Eventuri
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] text-[#ff6571]">
                      {category.count}
                    </span>
                  </div>
                  <h3 className="mt-4 break-words font-display text-lg leading-[1.08] tracking-[-0.03em] text-[#171717] dark:text-white">
                    {localized(locale, category.title.ua, category.title.en)}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-black/56 dark:text-white/54">
                    {localized(locale, category.description.ua, category.description.en)}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/65 transition group-hover:text-black dark:text-white/74 dark:group-hover:text-white">
                    {isUa ? "Відкрити каталог" : "Open catalogue"}
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section
        id="eventuri-approach"
        className="relative isolate overflow-hidden border-y border-black/10 bg-[#efeeeb] dark:border-white/10 dark:bg-[#0c0c0d]"
      >
        <EventuriAmbient
          darkSrc="/images/eventuri/eventuri-technical-dark.png"
          className="inset-0"
          overlayClassName="bg-gradient-to-b from-[#efeeeb]/22 via-[#efeeeb]/78 to-[#efeeeb] dark:from-[#0c0c0d]/20 dark:via-[#0c0c0d]/74 dark:to-[#0c0c0d]"
        />
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#ff6571]">
                {isUa ? "Підхід до вибору" : "Selection approach"}
              </p>
              <h2 className="mt-4 max-w-md break-words font-display text-2xl leading-[1] tracking-[-0.035em] text-[#171717] dark:text-white sm:text-3xl lg:text-4xl">
                {isUa ? "Точність важливіша за гучні обіцянки." : "Precision over broad promises."}
              </h2>
            </div>
            <div className="grid gap-px border border-black/10 bg-black/10 dark:border-white/12 dark:bg-white/12 sm:grid-cols-3">
              {[
                {
                  number: "01",
                  title: isUa ? "Під конкретний автомобіль" : "For a specific vehicle",
                  body: isUa
                    ? "Починаємо з марки, моделі та кузова, а не з універсальної поради."
                    : "Start with make, model and chassis — not a universal recommendation.",
                },
                {
                  number: "02",
                  title: isUa ? "Карбонові компоненти" : "Carbon components",
                  body: isUa
                    ? "Впуски, турбоінлети й деталі, що працюють як частина однієї конфігурації."
                    : "Intakes, turbo inlets and details selected as part of one configuration.",
                },
                {
                  number: "03",
                  title: isUa ? "Перевірка перед замовленням" : "Review before order",
                  body: isUa
                    ? "Для остаточного рішення звіряємо специфікацію та VIN."
                    : "We review the specification and VIN before a final decision.",
                },
              ].map((item, index) => (
                <motion.article
                  key={item.number}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.45,
                    delay: reduceMotion ? 0 : index * 0.08,
                    ease: "easeOut",
                  }}
                  className="bg-white p-6 dark:bg-[#0c0c0d] sm:min-h-[218px]"
                >
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-[#ff6571]">
                    {item.number}
                  </p>
                  <h3 className="mt-8 break-words font-display text-lg leading-tight tracking-[-0.025em] text-[#171717] dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-black/56 dark:text-white/54">
                    {item.body}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="eventuri-detail"
        className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24"
      >
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.16 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid min-w-0 overflow-hidden border border-black/10 dark:border-white/12 lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]"
        >
          <figure className="relative min-h-[340px] bg-[#ecebe7] dark:bg-[#141414] sm:min-h-[440px] lg:min-h-[560px]">
            <Image
              src={hero.detailImage}
              alt={hero.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 58vw"
              className="object-cover object-center"
            />
            <figcaption className="absolute inset-x-0 bottom-0 border-t border-white/12 bg-[#080808]/94 px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:px-6">
              BMW M5 G90/G99 · Eventuri intake system
            </figcaption>
          </figure>
          <div className="flex flex-col justify-between bg-[#ebe8e2] p-7 text-[#111111] dark:bg-[#151515] dark:text-white sm:p-10 lg:p-12">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ca1828]">
                {isUa ? "Реальний компонент · реальне авто" : "Real component · real vehicle"}
              </p>
              <h2 className="mt-5 max-w-md break-words font-display text-2xl leading-[1] tracking-[-0.04em] sm:text-3xl lg:text-4xl">
                {isUa
                  ? "Дивіться на систему, а не на ілюстрацію."
                  : "See the system, not an illustration."}
              </h2>
              <p className="mt-6 max-w-md text-sm leading-6 text-black/64 dark:text-white/62">
                {isUa
                  ? "На цій сторінці використовуємо справжні фото компонентів Eventuri з каталогу. Для вашого авто перевіримо конфігурацію перед оформленням."
                  : "This page uses actual Eventuri component photography from the catalogue. We review the configuration for your vehicle before you order."}
              </p>
            </div>
            <Link
              href={hero.href}
              className="mt-8 inline-flex w-fit items-center gap-2 border-b border-black/35 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black transition hover:border-[#d9192b] hover:text-[#c81727] dark:border-white/30 dark:text-white dark:hover:text-white"
            >
              {isUa ? "Переглянути систему для M5" : "View the M5 system"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </motion.div>
      </section>

      <section
        id="eventuri-products"
        className="relative z-10 border-y border-black/10 bg-[#efeeeb] dark:border-white/10 dark:bg-[#0c0c0d]"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="flex min-w-0 flex-col gap-6 border-b border-black/10 pb-8 dark:border-white/12 sm:flex-row sm:items-end sm:justify-between lg:pb-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#ff6571]">
                {isUa ? "Вибрані товари" : "Selected products"}
              </p>
              <h2 className="mt-4 break-words font-display text-2xl leading-[1] tracking-[-0.035em] text-[#171717] dark:text-white sm:text-3xl lg:text-4xl">
                {isUa ? "Вибрані конфігурації." : "Selected configurations."}
              </h2>
            </div>
            <Link
              href={catalogHref}
              className="inline-flex w-fit items-center gap-2 border-b border-black/20 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-black/65 transition hover:border-[#e31b2d] hover:text-black dark:border-white/25 dark:text-white/72 dark:hover:text-white"
            >
              {isUa ? `Усі ${productCount} товарів` : `All ${productCount} products`}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="mt-8 grid min-w-0 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
              {featuredProducts.map((product, index) => (
                <motion.div
                  key={product.slug}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.16 }}
                  transition={{
                    duration: 0.5,
                    delay: reduceMotion ? 0 : index * 0.08,
                    ease: "easeOut",
                  }}
                  className="min-w-0 h-full"
                >
                  <Link
                    href={product.href}
                    className="group flex h-full min-w-0 flex-col overflow-hidden border border-black/10 bg-white transition duration-300 hover:-translate-y-1 hover:border-[#e31b2d]/80 hover:shadow-[0_18px_46px_rgba(0,0,0,0.16)] dark:border-white/12 dark:bg-[#101011] dark:hover:shadow-[0_18px_46px_rgba(0,0,0,0.34)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#eeece8] p-6">
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 25vw"
                        className="object-contain p-6 mix-blend-multiply dark:mix-blend-normal transition duration-500 group-hover:scale-[1.045]"
                      />
                      <span
                        className="absolute left-0 top-0 h-[3px] w-0 bg-[#e31b2d] transition-all duration-300 group-hover:w-full"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex min-h-[2.25rem] items-start justify-between gap-3">
                        <p className="min-w-0 leading-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 dark:text-white/48">
                          {product.type}
                        </p>
                        <span className="h-fit shrink-0 whitespace-nowrap border border-[#e31b2d]/45 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ff6571]">
                          {isUa ? "Під замовлення" : "Made to order"}
                        </span>
                      </div>
                      <h3 className="mt-4 min-h-[5.15rem] line-clamp-4 break-words font-display text-lg leading-[1.08] tracking-[-0.03em] text-[#171717] dark:text-white">
                        {product.title}
                      </h3>
                      <div className="mt-auto flex items-end justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                        <p className="text-base font-medium tracking-[-0.02em] text-[#171717] dark:text-white">
                          <EventuriProductPrice locale={locale} price={product.price} />
                        </p>
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-black/18 text-black transition group-hover:border-[#e31b2d] group-hover:bg-[#d9192b] group-hover:text-white dark:border-white/18 dark:text-white">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.16 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="grid min-w-0 border border-black/10 bg-white dark:border-white/12 dark:bg-[#101011] lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-end"
        >
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-[#ff6571]">
              {isUa ? "Потрібна перевірка" : "Need a confirmation"}
            </p>
            <h2 className="mt-4 max-w-2xl break-words font-display text-2xl leading-[1] tracking-[-0.035em] text-[#171717] dark:text-white sm:text-3xl lg:text-4xl">
              {isUa
                ? "Перевіримо комплектацію за VIN перед замовленням."
                : "We will check the configuration by VIN before ordering."}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-6 text-black/58 dark:text-white/58">
              {isUa
                ? "Якщо комплектація нестандартна або ви вагаєтесь між версіями, надішліть VIN і специфікацію автомобіля."
                : "If the specification is non-standard or you are choosing between versions, send the VIN and vehicle specification."}
            </p>
          </div>
          <div className="border-t border-black/10 p-7 dark:border-white/12 lg:border-l lg:border-t-0 lg:p-10">
            <Link
              href={contactHref}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-[#d9192b] px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#ed3041] lg:w-auto"
            >
              {isUa ? "Підтвердити сумісність" : "Confirm fitment"}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
