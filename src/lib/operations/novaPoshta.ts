import { formatPriceWatchMoney } from "@/lib/operations/priceWatchReport";

/**
 * What Nova Poshta charges for our parcels, for the team in the ops bot; the
 * site shows customers no delivery prices. Nova Poshta's public API prices
 * without a key (NOVA_POSHTA_API_KEY is sent when set). Parcels leave Kyiv.
 * Ukrposhta, Meest and DHL price only with contract keys: not connected yet.
 */

const NP_URL = "https://api.novaposhta.ua/v2.0/json/";
const NP_TIMEOUT_MS = 6_000;
/** Kyiv: where parcels leave from. */
export const NP_SENDER_CITY_REF = "8d5a980d-391c-11dd-90d9-001a92567626";
/** Lviv stands for «across Ukraine»: one tariff between any two regional centres. */
export const NP_COUNTRYWIDE_CITY_REF = "db5c88f5-391c-11dd-90d9-001a92567626";
/** A seat heavier than this goes as cargo, not as a parcel. */
const NP_PARCEL_MAX_KG = 30;
/** Nova Poshta's own declared value when none is given: the price with no extra insurance. */
const NP_BASE_DECLARED_UAH = 200;
/** A big order is priced by its first seats. */
const NP_MAX_SEATS = 20;

export const NP_OTHER_CARRIERS_NOTE = "Укрпошту, Meest и DHL посчитаю, когда будут ключи их API.";

/** One box: weight in kg, sides in cm when known. */
export type NovaPoshtaSeat = { weightKg: number; box: readonly [number, number, number] | null };

export type NovaPoshtaQuote = {
  /** To a branch, with no extra insurance. */
  warehouse: number;
  /** To the door, when asked for. */
  doors: number | null;
  /** To a branch insured for the declared value (our price). */
  insured: number | null;
  declaredUah: number | null;
  /** «2026-10-23»: when it arrives if sent today. */
  deliveryDate: string | null;
};

type Measures = {
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  isDimensionsEstimated: boolean;
};

/** A seat from a card's own measures; an estimate prices nothing. */
export function exactSeat(entry: Measures | null | undefined): NovaPoshtaSeat | null {
  if (!entry || entry.isDimensionsEstimated || !(Number(entry.weight) > 0)) return null;
  const sides = [entry.length, entry.width, entry.height].map(Number);
  return {
    weightKg: Number(entry.weight),
    box: sides.every((side) => side > 0) ? [sides[0], sides[1], sides[2]] : null,
  };
}

type Envelope<T> = { success?: boolean; data?: T[]; errors?: string[] };

async function call<T>(
  fetchImpl: typeof fetch,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>
): Promise<T[]> {
  const response = await fetchImpl(NP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey: process.env.NOVA_POSHTA_API_KEY?.trim() ?? "",
      modelName,
      calledMethod,
      methodProperties,
    }),
    signal: AbortSignal.timeout(NP_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`NOVA_POSHTA_HTTP_${response.status}`);
  const body = (await response.json()) as Envelope<T>;
  if (!body.success) {
    throw new Error(`NOVA_POSHTA_FAILED: ${(body.errors ?? []).join("; ").slice(0, 160)}`);
  }
  return body.data ?? [];
}

/** A city of Ukraine by name, Ukrainian or Russian («Одесса» finds «м. Одеса»). */
export async function findNovaPoshtaCity(name: string, fetchImpl: typeof fetch = fetch) {
  const [found] = await call<{
    Addresses?: Array<{ Present?: string; DeliveryCity?: string }>;
  }>(fetchImpl, "Address", "searchSettlements", {
    CityName: name.trim().slice(0, 60),
    Limit: "5",
    Page: "1",
  });
  const address = found?.Addresses?.find((entry) => entry.DeliveryCity);
  return address?.DeliveryCity
    ? { ref: address.DeliveryCity, name: address.Present?.trim() || name.trim() }
    : null;
}

function seatProperties(seats: readonly NovaPoshtaSeat[]) {
  const priced = seats.slice(0, NP_MAX_SEATS);
  const weight = priced.reduce((sum, seat) => sum + seat.weightKg, 0);
  return {
    Weight: String(Math.round(weight * 100) / 100),
    SeatsAmount: String(priced.length),
    CargoType: priced.some((seat) => seat.weightKg > NP_PARCEL_MAX_KG) ? "Cargo" : "Parcel",
    // Nova Poshta charges the volumetric weight when the box is bigger than heavy.
    ...(priced.every((seat) => seat.box)
      ? {
          OptionsSeat: priced.map((seat) => ({
            weight: String(seat.weightKg),
            volumetricLength: String(seat.box![0]),
            volumetricWidth: String(seat.box![1]),
            volumetricHeight: String(seat.box![2]),
          })),
        }
      : {}),
  };
}

/** Kyiv → the city: to a branch (and to the door), insured for our price, and when. */
export async function quoteNovaPoshta(input: {
  cityRef: string;
  seats: readonly NovaPoshtaSeat[];
  declaredUah: number | null;
  doors?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<NovaPoshtaQuote> {
  if (!input.seats.length) throw new Error("NOVA_POSHTA_NO_SEATS");
  const fetchImpl = input.fetchImpl ?? fetch;
  const seats = seatProperties(input.seats);
  const price = async (ServiceType: string, declared: number) => {
    const [row] = await call<{ Cost?: number }>(fetchImpl, "InternetDocument", "getDocumentPrice", {
      CitySender: NP_SENDER_CITY_REF,
      CityRecipient: input.cityRef,
      ServiceType,
      Cost: String(declared),
      ...seats,
    });
    const cost = Number(row?.Cost);
    if (!(cost > 0)) throw new Error("NOVA_POSHTA_NO_PRICE");
    return cost;
  };
  const declared =
    input.declaredUah && input.declaredUah > NP_BASE_DECLARED_UAH
      ? Math.round(input.declaredUah)
      : null;
  const [warehouse, doors, insured, deliveryDate] = await Promise.all([
    price("WarehouseWarehouse", NP_BASE_DECLARED_UAH),
    input.doors ? price("WarehouseDoors", NP_BASE_DECLARED_UAH) : null,
    declared ? price("WarehouseWarehouse", declared) : null,
    call<{ DeliveryDate?: { date?: string } }>(
      fetchImpl,
      "InternetDocument",
      "getDocumentDeliveryDate",
      {
        CitySender: NP_SENDER_CITY_REF,
        CityRecipient: input.cityRef,
        ServiceType: "WarehouseWarehouse",
      }
    )
      .then(([row]) => row?.DeliveryDate?.date?.slice(0, 10) || null)
      // A missing date never hides the price.
      .catch(() => null),
  ]);
  return { warehouse, doors, insured, declaredUah: declared, deliveryDate };
}

const uah = (amount: number) => formatPriceWatchMoney(amount, "UAH");

export function novaPoshtaDeliveryDay(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}

/** «200 ₴ до отделения, со страховкой на 60 000 ₴ — 500 ₴». */
export function novaPoshtaPriceText(quote: NovaPoshtaQuote) {
  return `${uah(quote.warehouse)} до отделения${
    quote.insured && quote.declaredUah
      ? `, со страховкой на ${uah(quote.declaredUah)} — ${uah(quote.insured)}`
      : ""
  }`;
}

/** The product card's line: Kyiv → any regional centre. */
export function novaPoshtaCardLine(quote: NovaPoshtaQuote) {
  return `🚚 Новая почта по Украине: ${novaPoshtaPriceText(quote)}${
    quote.deliveryDate ? `; доставка ${novaPoshtaDeliveryDay(quote.deliveryDate)}` : ""
  }`;
}
