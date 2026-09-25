/**
 * Build local Burger PDP examples from the read-only supplier snapshot.
 * Writes only the ignored local catalog fallback; never touches PostgreSQL.
 * Run: npx tsx scripts/prepare-burger-local-preview.ts --preview
 */
import fs from "node:fs";
import path from "node:path";
import { calculateBurgerVariantPrice } from "../src/lib/burgerRepricing";
import { DEFAULT_CURRENCY_RATES } from "../src/lib/shopAdminSettings";
import { expandShopPrices } from "../src/lib/shopPriceConversion";
import batch1Copy from "./burger-seo-drafts/batch-1.mjs";
import batch2Copy from "./burger-seo-drafts/batch-2.mjs";
import batch3Copy from "./burger-seo-drafts/batch-3.mjs";
import batch4Copy from "./burger-seo-drafts/batch-4.mjs";
import batch5Copy from "./burger-seo-drafts/batch-5.mjs";
import batch6Copy from "./burger-seo-drafts/batch-6.mjs";
import batch7Copy from "./burger-seo-drafts/batch-7.mjs";
import batch8Copy from "./burger-seo-drafts/batch-8.mjs";
import batch9Copy from "./burger-seo-drafts/batch-9.mjs";
import batch10Copy from "./burger-seo-drafts/batch-10.mjs";
import batch11Copy from "./burger-seo-drafts/batch-11.mjs";
import batch12Copy from "./burger-seo-drafts/batch-12.mjs";
import batch13Copy from "./burger-seo-drafts/batch-13.mjs";
import batch14Copy from "./burger-seo-drafts/batch-14.mjs";
import batch15Copy from "./burger-seo-drafts/batch-15.mjs";
import batch16Copy from "./burger-seo-drafts/batch-16.mjs";
import batch17Copy from "./burger-seo-drafts/batch-17.mjs";
import batch18Copy from "./burger-seo-drafts/batch-18.mjs";
import batch19Copy from "./burger-seo-drafts/batch-19.mjs";
import batch20Copy from "./burger-seo-drafts/batch-20.mjs";
import batch21Copy from "./burger-seo-drafts/batch-21.mjs";
import batch22Copy from "./burger-seo-drafts/batch-22.mjs";
import batch23Copy from "./burger-seo-drafts/batch-23.mjs";
import batch24Copy from "./burger-seo-drafts/batch-24.mjs";
import batch25Copy from "./burger-seo-drafts/batch-25.mjs";
import batch26Copy from "./burger-seo-drafts/batch-26.mjs";
import batch27Copy from "./burger-seo-drafts/batch-27.mjs";
import batch28Copy from "./burger-seo-drafts/batch-28.mjs";
import batch29Copy from "./burger-seo-drafts/batch-29.mjs";
import batch30Copy from "./burger-seo-drafts/batch-30.mjs";
import batch31Copy from "./burger-seo-drafts/batch-31.mjs";
import batch32Copy from "./burger-seo-drafts/batch-32.mjs";
import batch33Copy from "./burger-seo-drafts/batch-33.mjs";
import batch34Copy from "./burger-seo-drafts/batch-34.mjs";
import batch35Copy from "./burger-seo-drafts/batch-35.mjs";
import batch36Copy from "./burger-seo-drafts/batch-36.mjs";
import batch37Copy from "./burger-seo-drafts/batch-37.mjs";
import batch38Copy from "./burger-seo-drafts/batch-38.mjs";
import batch39Copy from "./burger-seo-drafts/batch-39.mjs";
import batch40Copy from "./burger-seo-drafts/batch-40.mjs";
import batch41Copy from "./burger-seo-drafts/batch-41.mjs";
import batch42Copy from "./burger-seo-drafts/batch-42.mjs";
import batch43Copy from "./burger-seo-drafts/batch-43.mjs";
import batch44Copy from "./burger-seo-drafts/batch-44.mjs";
import batch45Copy from "./burger-seo-drafts/batch-45.mjs";
import batch46Copy from "./burger-seo-drafts/batch-46.mjs";
import batch47Copy from "./burger-seo-drafts/batch-47.mjs";
import batch48Copy from "./burger-seo-drafts/batch-48.mjs";
import batch49Copy from "./burger-seo-drafts/batch-49.mjs";
import batch50Copy from "./burger-seo-drafts/batch-50.mjs";
import batch51Copy from "./burger-seo-drafts/batch-51.mjs";
import batch52Copy from "./burger-seo-drafts/batch-52.mjs";
import batch53Copy from "./burger-seo-drafts/batch-53.mjs";
import batch54Copy from "./burger-seo-drafts/batch-54.mjs";
import batch55Copy from "./burger-seo-drafts/batch-55.mjs";
import batch56Copy from "./burger-seo-drafts/batch-56.mjs";
import batch57Copy from "./burger-seo-drafts/batch-57.mjs";
import batch58Copy from "./burger-seo-drafts/batch-58.mjs";
import batch59Copy from "./burger-seo-drafts/batch-59.mjs";
import batch60Copy from "./burger-seo-drafts/batch-60.mjs";
import batch61Copy from "./burger-seo-drafts/batch-61.mjs";
import batch62Copy from "./burger-seo-drafts/batch-62.mjs";
import batch63Copy from "./burger-seo-drafts/batch-63.mjs";
import batch64Copy from "./burger-seo-drafts/batch-64.mjs";
import batch65Copy from "./burger-seo-drafts/batch-65.mjs";
import batch66Copy from "./burger-seo-drafts/batch-66.mjs";
import batch67Copy from "./burger-seo-drafts/batch-67.mjs";
import batch68Copy from "./burger-seo-drafts/batch-68.mjs";
import batch69Copy from "./burger-seo-drafts/batch-69.mjs";
import batch70Copy from "./burger-seo-drafts/batch-70.mjs";
import batch71Copy from "./burger-seo-drafts/batch-71.mjs";
import batch72Copy from "./burger-seo-drafts/batch-72.mjs";
import batch73Copy from "./burger-seo-drafts/batch-73.mjs";
import batch74Copy from "./burger-seo-drafts/batch-74.mjs";
import batch75Copy from "./burger-seo-drafts/batch-75.mjs";
import batch76Copy from "./burger-seo-drafts/batch-76.mjs";
import batch77Copy from "./burger-seo-drafts/batch-77.mjs";
import batch78Copy from "./burger-seo-drafts/batch-78.mjs";
import batch79Copy from "./burger-seo-drafts/batch-79.mjs";
import batch80Copy from "./burger-seo-drafts/batch-80.mjs";
import batch81Copy from "./burger-seo-drafts/batch-81.mjs";
import batch82Copy from "./burger-seo-drafts/batch-82.mjs";
import batch83Copy from "./burger-seo-drafts/batch-83.mjs";
import batch84Copy from "./burger-seo-drafts/batch-84.mjs";
import batch85Copy from "./burger-seo-drafts/batch-85.mjs";
import batch86Copy from "./burger-seo-drafts/batch-86.mjs";
import batch87Copy from "./burger-seo-drafts/batch-87.mjs";
import batch88Copy from "./burger-seo-drafts/batch-88.mjs";
import batch89Copy from "./burger-seo-drafts/batch-89.mjs";
import batch90Copy from "./burger-seo-drafts/batch-90.mjs";
import batch91Copy from "./burger-seo-drafts/batch-91.mjs";
import batch92Copy from "./burger-seo-drafts/batch-92.mjs";

if (!process.argv.includes("--preview")) {
  throw new Error("Pass --preview to write the ignored local catalog fixture");
}

const root = process.cwd();
const fallbackDir = path.join(root, "public", "catalog-fallback");
const manifestPath = path.join(fallbackDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const fallbackFile = manifest.stores?.burger?.file;
if (!/^burger\.[a-f0-9]+\.json$/.test(fallbackFile ?? "")) {
  throw new Error("Burger fallback shard missing from the local catalog manifest");
}
const fallbackPath = path.join(fallbackDir, fallbackFile);
if (!fs.existsSync(fallbackPath)) throw new Error("Manifest Burger fallback shard does not exist");
const backupPath = path.join(root, "tmp", "burger-local-preview-original.json");
if (!fs.existsSync(backupPath)) fs.copyFileSync(fallbackPath, backupPath);
const products = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const source = JSON.parse(fs.readFileSync(
  path.join(root, "tmp", "burger-configurations-2026-09-25.json"), "utf8"
));
const sourceProducts = [1, 2, 3].flatMap((page) => JSON.parse(fs.readFileSync(
  path.join(root, "tmp", `burger-products-2026-09-25-page${page}.json`), "utf8"
)).products ?? []);

function money(usd: number) {
  return expandShopPrices({ usd, eur: 0, uah: 0 }, DEFAULT_CURRENCY_RATES);
}

function demoPackage(handle: string, values: string[]) {
  if (handle === "bms-stage-1-bmw-performance-tuner") {
    return {
      domesticShippingUsd: 10,
      packageEstimate: {
        productKg: 0.907,
        optionAdditions: [],
        packagingKg: 0.3,
        lengthCm: 23,
        widthCm: 18,
        heightCm: 8,
      },
    };
  }
  if (handle === "kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner") {
    return {
      domesticShippingUsd: 10,
      packageEstimate: {
        productKg: 1.361,
        optionAdditions: [],
        packagingKg: 0.3,
        lengthCm: 25,
        widthCm: 20,
        heightCm: 8,
      },
    };
  }
  if (handle === "air-filters-for-kia-stinger-genesis-g70") {
    const v6 = /^3\.3L/.test(values[0] ?? "");
    return {
      domesticShippingUsd: 10,
      packageEstimate: {
        // Burger publishes 907 g for both variants. Reserve additional weight
        // for the larger V6 filter configuration before box/volume and +1 kg.
        productKg: 0.907,
        optionAdditions: v6 ? [{ name: "3.3L V6 filter configuration", kg: 0.5 }] : [],
        packagingKg: v6 ? 0.45 : 0.3,
        lengthCm: v6 ? 36 : 30,
        widthCm: v6 ? 30 : 25,
        heightCm: v6 ? 12 : 10,
      },
    };
  }
  if (handle === "48-extension-for-fuel-it-flex-fuel-analyzer") {
    const wire = values[1] ?? "";
    const productKg = /#6\s*=/.test(wire) ? 0.6 :
      /#5\s*=/.test(wire) ? 0.35 :
      /#4\s*=/.test(wire) ? 0.5 :
      /#3\s*=/.test(wire) ? 0.45 :
      /#2\s*=/.test(wire) ? 0.3 :
      /#1\s*=/.test(wire) ? 0.25 : 0.2;
    const eca = /add the fuel-it! bluetooth/i.test(values[0] ?? "");
    return {
      domesticShippingUsd: /#6\s*=/.test(wire) ? 7 : 10,
      packageEstimate: {
        productKg,
        optionAdditions: eca ? [{ name: "Bluetooth ECA", kg: 0.454 }] : [],
        packagingKg: 0.2,
        lengthCm: 30.48,
        widthCm: 20.32,
        heightCm: 7.62,
      },
    };
  }
  if (handle === "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5") {
    return {
      domesticShippingUsd: 24,
      packageEstimate: {
        productKg: 5,
        optionAdditions: [],
        packagingKg: 0.5,
        lengthCm: 45.72,
        widthCm: 25.4,
        heightCm: 25.4,
      },
    };
  }
  const hasController = /include fsb/i.test(values[2] ?? "");
  const has950 = /upgrade me to the 950cc/i.test(values[1] ?? "");
  return {
    domesticShippingUsd: 10,
    packageEstimate: {
      productKg: 0.907,
      optionAdditions: [
        ...(hasController ? [{ name: "FSB controller", kg: 0.181 }] : []),
        ...(has950 ? [{ name: "950cc injector upgrade difference", kg: 0.05 }] : []),
      ],
      packagingKg: 0.3,
      lengthCm: 27.94,
      widthCm: 22.86,
      heightCm: 15.24,
    },
  };
}

function previewVariantImage(handle: string, values: string[], gallery: string[]) {
  if (handle === "kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner") {
    const filename = /^JB4PRO$/i.test(values[0] ?? "")
      ? "JB4PRO-BOX-0000"
      : "Kia-Hyundai-Genesis-Turbo-JB4-Performance-Tuner-JB4";
    return gallery.find((image) => image.toLowerCase().includes(filename.toLowerCase())) ??
      gallery[0] ?? null;
  }
  if (handle === "air-filters-for-kia-stinger-genesis-g70") {
    const partNumber = /^3\.3L/.test(values[0] ?? "") ? "J5300" : "J5100";
    return gallery.find((image) => image.includes(partNumber)) ?? gallery[0] ?? null;
  }
  if (handle === "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5") {
    const filter = values[0] ?? "";
    const fragment = /dry/i.test(filter) ? "with-dry-filters" :
      /red/i.test(filter) ? "red-oiled-filters" : "blue-oiled-filters";
    return gallery.find((image) => image.toLowerCase().includes(fragment)) ?? gallery[0] ?? null;
  }
  if (handle === "fuel-it-charge-pipe-injection-cpi-starter-kit") {
    return gallery[0] ?? null;
  }
  if (handle !== "48-extension-for-fuel-it-flex-fuel-analyzer") return null;
  const wire = values[1] ?? "";
  const eca = /add the fuel-it! bluetooth/i.test(values[0] ?? "");
  const imageName = /#6\s*=/.test(wire)
    ? (eca ? "uni-bta-13ahe" : "156inchextension")
    : /#5\s*=/.test(wire)
      ? (eca ? "uni-bta-4ahe" : "48inchextension")
      : /#4\s*=/.test(wire)
        ? (eca ? "uni-bta-9ah" : "108inchharness")
        : /#3\s*=/.test(wire)
          ? (eca ? "uni-bta-90ah" : "90inchharness")
          : /#2\s*=/.test(wire)
            ? (eca ? "uni-bta-4ah" : "48inchharness")
            : /#1\s*=/.test(wire)
              ? (eca ? "uni-bta-2ah" : "24inchharness")
              : null;
  return imageName
    ? gallery.find((image) => image.toLowerCase().includes(imageName.toLowerCase())) ?? null
    : null;
}

const demoCopy: Record<string, {
  titleUa: string; titleEn: string;
  shortUa: string; shortEn: string;
  descUa: string; descEn: string;
}> = {
  "48-extension-for-fuel-it-flex-fuel-analyzer": {
    titleUa: "Fuel-It! Bluetooth ECA та проводка для датчиків етанолу GM / Continental",
    titleEn: "Fuel-It! Bluetooth ECA and wiring for GM / Continental ethanol sensors",
    shortUa: "Fuel-It! Bluetooth ECA показує вміст етанолу E85 для контролю суміші й тюнінгу. Оберіть аналізатор і проводку для датчиків GM / Continental.",
    shortEn: "Fuel-It! Bluetooth ECA reads ethanol content for E85 monitoring and tuning. Choose the analyzer and wiring for compatible GM / Continental sensors.",
    descUa: `<h3>Що дає Fuel-It! Bluetooth ECA</h3>
<p>Якщо вибрано аналізатор ECA, він зчитує вміст етанолу із сумісного датчика й показує його в додатку Fuel-It! на телефоні. Аналоговий і частотний сигнали можна використовувати для сумісного JB4 або flash-налаштування. Це допомагає контролювати паливну суміш E85, але сам модуль не додає потужності без відповідного налаштування автомобіля.</p>
<h3>Для чого потрібні джгути й подовжувачі</h3>
<p>Проводка з’єднує датчик етанолу та аналізатор у потрібному місці автомобіля. Подовжувач №6 завдовжки 156″ (396 см) дає додаткову довжину кабелю; сам по собі він не вимірює вміст етанолу.</p>
<h3>Що входить у вибрану версію</h3>
<p>Модуль ECA та тип проводки обираються окремо в опціях вище. Якщо вибрано «Без Bluetooth ECA», надсилається тільки обрана проводка. Датчик етанолу до опцій цієї картки не входить. Аналізатори Fuel-It! не сумісні з комплектами DSX flex fuel.</p>`,
    descEn: `<h3>What the Fuel-It! Bluetooth ECA does</h3>
<p>When selected, the ECA reads ethanol content from a compatible sensor and displays it in the Fuel-It! mobile app. Analog and frequency outputs support compatible JB4 or flash-tuning integrations. This helps you monitor an E85 blend; the analyzer alone does not add power without suitable vehicle tuning.</p>
<h3>Why choose a harness or extension</h3>
<p>The wiring connects the ethanol sensor and analyzer where they need to sit in the vehicle. No. 6 is a 156″ (396 cm) extension that adds cable length; on its own, it does not measure ethanol content.</p>
<h3>Contents of the selected configuration</h3>
<p>Choose the ECA and wiring separately above. Selecting “Do NOT add an ECA” supplies only the chosen wiring. No option on this page includes an ethanol sensor. Fuel-It! analyzers are not compatible with DSX flex-fuel kits.</p>`,
  },
  "fuel-it-charge-pipe-injection-cpi-starter-kit": {
    titleUa: "Fuel-It! CPI Starter Kit — додаткове впорскування палива у впуск",
    titleEn: "Fuel-It! CPI Starter Kit — charge pipe fuel injection",
    shortUa: "Fuel-It! CPI додає інжектор у впуск турбомотора для додаткової подачі палива під E85 і вищий наддув. Оберіть 550/950cc та контролер.",
    shortEn: "Fuel-It! CPI adds a charge-pipe injector for supplemental fuel in E85 and higher-boost builds. Choose a 550/950cc injector, adapter and controller.",
    descUa: `<h3>Що дає Fuel-It! CPI Starter Kit</h3>
<p>Charge Pipe Injection (CPI) додає окремий інжектор у пайп впуску турбомотора. За належного монтажу й налаштування він може забезпечити додаткову подачу палива там, де штатної системи вже недостатньо, зокрема в проєктах із вищим наддувом або сумішами E85. Комплект сам по собі не гарантує приросту потужності: результат залежить від паливної системи, контролера та калібрування.</p>
<h3>Як вибрати конфігурацію</h3>
<p>Стандартна версія містить інжектор 550cc, паливну лінію 12″ -4AN, базовий джгут та інструмент для встановлення. У конфігураторі обирається тип адаптера. Опція 950cc замінює стандартний інжектор; контролер FSB входить лише у варіант, де його явно вибрано.</p>
<h3>Що потрібно для роботи</h3>
<p>Інжектору потрібен сумісний запрограмований контролер. Якщо варіант «Без контролера» обрано вище, контролер потрібно придбати окремо. Перед купівлею перевірте місце для монтажу в пайпі впуску та сумісність паливного підключення з вашим автомобілем.</p>`,
    descEn: `<h3>What the Fuel-It! CPI Starter Kit does</h3>
<p>Charge Pipe Injection (CPI) adds a separate injector to a boosted engine's charge pipe. With proper installation and tuning, it can provide supplemental fuel where the factory system is limiting, including higher-boost or E85-blend builds. The kit alone does not guarantee a power gain; results depend on the fuel system, controller and calibration.</p>
<h3>Choose the right configuration</h3>
<p>The standard version includes a 550cc injector, 12″ -4AN fuel line, basic harness and installation tool. Select the adapter type above. The 950cc option replaces the standard injector; an FSB controller is included only when explicitly selected.</p>
<h3>What is required to run it</h3>
<p>The injector requires a compatible programmed controller. If “Do not add an injector controller” is selected, obtain a controller separately. Check charge-pipe installation clearance and fuel-connection fitment for your vehicle before ordering.</p>`,
  },
};

const contentOnlyCopy: typeof demoCopy = {
  "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5": {
    titleUa: "BMS Elite Dual Intake для BMW M5 G90/G99 S68 — продуктивний впуск",
    titleEn: "BMS Elite Dual Intake for BMW M5 G90/G99 S68 — performance intake",
    shortUa: "BMS Elite Dual Intake для BMW M5 G90/G99 S68 покращує потік повітря й звук впуску, зберігаючи штатні канали холодного повітря. Вибір фільтрів.",
    shortEn: "BMS Elite Dual Intake for BMW M5 G90/G99 S68 improves airflow and induction sound while retaining factory cold-air ducting. Choose oiled or dry filters.",
    descUa: `<h3>Що змінює подвійний впуск BMS</h3>
<p>Комплект замінює обмежувальну верхню частину штатного впуску BMW M5 G90/G99 на два повітроводи та конусні фільтри. Він дає турбінам менш обмежений шлях для повітря і виразніший звук наддуву. Вплив на потужність залежить від режиму наддуву, стану авто й налаштування; конкретний приріст без вимірювань не гарантується.</p>
<h3>Фільтри та монтаж</h3>
<p>У конфігураторі обираються масляні багаторазові або сухі фільтри. Масляні фільтри очищаються й обслуговуються відповідним набором; сухі можна очищати стисненим повітрям, але згодом їх потрібно замінити. Комплект зберігає штатні канали холодного повітря та нижні частини теплозахисних коробів. За даними Burger, різати чи свердлити штатні деталі для монтажу не потрібно.</p>
<h3>Сумісність і склад</h3>
<p>Для BMW M5 Sedan G90 і M5 Touring G99 з двигуном S68, модельні роки 2025+. Комплект включає два конусні фільтри, два алюмінієві повітроводи, силіконові перехідники, хомути та захисні прокладки. Тип фільтрів залежить від обраної опції.</p>`,
    descEn: `<h3>What the BMS dual intake changes</h3>
<p>This kit replaces the restrictive upper part of the BMW M5 G90/G99 factory intake with two ducts and inverted-cone filters. It gives the turbos a less restricted air path and makes induction sound more audible. Power results depend on boost, vehicle condition and calibration; no specific gain is guaranteed without testing.</p>
<h3>Filter choice and installation</h3>
<p>Choose reusable oiled or dry filters. The oiled filters can be cleaned with a suitable service kit; dry filters can be cleaned with compressed air but eventually need replacement. The kit retains factory cold-air ducting and lower heat-shielding airbox sections. Burger states that installation requires no cutting or drilling of factory parts.</p>
<h3>Fitment and contents</h3>
<p>Fits 2025+ BMW M5 Sedan G90 and M5 Touring G99 with the S68 engine. The kit includes two cone filters, two aluminum intake tubes, silicone couplers, clamps and protective foam. Filter type depends on the selected option.</p>`,
  },
  "b58-bms-oil-catch-can-oil-filler-cap-connection-kit": {
    titleUa: "BMS Dual Vent для BMW B58 / Toyota Supra — кришка та підключення oil catch can",
    titleEn: "BMS Dual Vent for BMW B58 / Toyota Supra — oil catch can connection kit",
    shortUa: "BMS Dual Vent для BMW B58 / Supra спрямовує додаткові картерні гази в сумісний oil catch can і допомагає зменшити потрапляння оливного туману у впуск.",
    shortEn: "BMS Dual Vent for BMW B58 / Supra routes an extra crankcase-breather path to a compatible oil catch can, helping keep oil vapor out of the intake.",
    descUa: `<h3>Що дає BMS Dual Vent</h3>
<p>Замість штатної кришки оливозаливної горловини встановлюється алюмінієва кришка з додатковим виходом вентиляції картера. Вона дозволяє спрямувати гази та оливний туман через сумісний BMS oil catch can. Це доповнення до вже встановленої системи уловлювання парів оливи, а не окремий уловлювач і не спосіб гарантовано збільшити потужність.</p>
<h3>Комплектація та сумісність</h3>
<p>До набору входять кришка BMS, AN-перехідники, термостійкий силіконовий шланг, трійник і хомути. Сам oil catch can до набору не входить. Виробник вказує сумісність із BMW на двигуні B58 Gen 2/Gen 3 та Toyota GR Supra B58; перед замовленням звірте покоління двигуна і тип вашого BMS catch can.</p>`,
    descEn: `<h3>What BMS Dual Vent does</h3>
<p>A billet oil-filler cap replaces the factory cap and adds another crankcase-breather outlet. It lets a compatible BMS oil catch can capture vapor from an additional path before that vapor returns to the intake. This kit complements an existing catch-can system; it is not a catch can on its own and does not guarantee a power gain.</p>
<h3>Contents and fitment</h3>
<p>Includes the BMS cap, AN fittings, high-temperature silicone hose, T-fitting and clamps. The oil catch can itself is not included. Burger lists fitment for Gen 2/Gen 3 B58 BMW applications and B58 Toyota GR Supra; confirm engine generation and your BMS catch-can setup before ordering.</p>`,
  },
  "quick-install-kia-stinger-genesis-g70-g80-3-3l-charge-pipe-injection-cpi-mount-kit": {
    titleUa: "Fuel-It! CPI Mount Kit для Kia Stinger / Genesis G70 G80 3.3T",
    titleEn: "Fuel-It! CPI Mount Kit for Kia Stinger / Genesis G70 G80 3.3T",
    shortUa: "Fuel-It! CPI Mount Kit для Kia Stinger / Genesis G70 G80 3.3T дає два порти для інжекторів або WMI-форсунок. Інжектори й контролер окремо.",
    shortEn: "Fuel-It! CPI Mount Kit for Kia Stinger / Genesis G70 G80 3.3T adds two ports for injectors or WMI nozzles. Injectors and controller are separate.",
    descUa: `<h3>Для чого потрібен CPI Mount Kit</h3>
<p>Цей комплект дає точку монтажу для додаткового впорскування палива або водно-метанольної суміші у впускному тракті Kia Stinger і Genesis G70/G80 3.3T. Алюмінієва муфта Fuel-It! має два різьбові порти 1/8″ NPT. Сам монтажний комплект не додає паливо й не збільшує потужність без інжекторів або форсунок, подачі рідини та відповідного керування.</p>
<h3>Що входить і що потрібно окремо</h3>
<p>У наборі: муфта Fuel-It! 2,5″, силіконова трубка та перехідник, дві заглушки портів із герметиком і монтажні хомути. Інжектори, водно-метанольні форсунки, паливні лінії та контролер у переліку комплекту постачальника не зазначені. Перед купівлею перевірте сумісність з вашим інтеркулером і запланованою системою CPI або WMI.</p>`,
    descEn: `<h3>What the CPI Mount Kit enables</h3>
<p>This hardware creates mounting points for supplemental fuel injection or water-methanol nozzles in the Kia Stinger and Genesis G70/G80 3.3T intake tract. The Fuel-It! billet coupler has two 1/8″ NPT ports. The mount alone does not add fuel or power without injectors or nozzles, fluid supply and appropriate control.</p>
<h3>Included hardware and separate requirements</h3>
<p>Includes a 2.5″ Fuel-It! coupler, silicone tube and reducer, two sealed port plugs and mounting clamps. The supplier's included-parts list does not include injectors, water-methanol nozzles, fuel lines or a controller. Confirm intercooler fitment and your planned CPI or WMI system before ordering.</p>`,
  },
};

const configuredHandles = [
  ...Object.keys(demoCopy),
  "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5",
  "air-filters-for-kia-stinger-genesis-g70",
  "kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner",
  "bms-stage-1-bmw-performance-tuner",
];
const allCopy = {
  ...demoCopy, ...contentOnlyCopy, ...batch1Copy, ...batch2Copy, ...batch3Copy,
  ...batch4Copy, ...batch5Copy, ...batch6Copy, ...batch7Copy, ...batch8Copy, ...batch9Copy, ...batch10Copy, ...batch11Copy, ...batch12Copy, ...batch13Copy, ...batch14Copy, ...batch15Copy, ...batch16Copy, ...batch17Copy, ...batch18Copy, ...batch19Copy, ...batch20Copy, ...batch21Copy, ...batch22Copy, ...batch23Copy, ...batch24Copy, ...batch25Copy, ...batch26Copy, ...batch27Copy, ...batch28Copy, ...batch29Copy, ...batch30Copy, ...batch31Copy, ...batch32Copy, ...batch33Copy, ...batch34Copy, ...batch35Copy, ...batch36Copy, ...batch37Copy, ...batch38Copy, ...batch39Copy, ...batch40Copy, ...batch41Copy, ...batch42Copy, ...batch43Copy, ...batch44Copy, ...batch45Copy, ...batch46Copy, ...batch47Copy, ...batch48Copy, ...batch49Copy, ...batch50Copy, ...batch51Copy, ...batch52Copy, ...batch53Copy, ...batch54Copy, ...batch55Copy, ...batch56Copy, ...batch57Copy, ...batch58Copy, ...batch59Copy, ...batch60Copy, ...batch61Copy, ...batch62Copy, ...batch63Copy, ...batch64Copy, ...batch65Copy, ...batch66Copy, ...batch67Copy, ...batch68Copy, ...batch69Copy, ...batch70Copy, ...batch71Copy, ...batch72Copy, ...batch73Copy, ...batch74Copy, ...batch75Copy, ...batch76Copy, ...batch77Copy, ...batch78Copy, ...batch79Copy, ...batch80Copy, ...batch81Copy, ...batch82Copy, ...batch83Copy, ...batch84Copy, ...batch85Copy, ...batch86Copy, ...batch87Copy, ...batch88Copy, ...batch89Copy, ...batch90Copy, ...batch91Copy, ...batch92Copy,
};
const selectedHandles = Object.keys(allCopy);
const previewHandles = [
  ...Object.keys(demoCopy),
  ...Object.keys(contentOnlyCopy),
  "air-filters-for-kia-stinger-genesis-g70",
  "kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner",
  "bms-stage-1-bmw-performance-tuner",
];
for (const handle of previewHandles) {
  const product = products.find((item: { slug: string }) => item.slug === `burger-${handle}`);
  const supplier = source.find((item: { handle: string }) => item.handle === handle);
  const supplierProduct = sourceProducts.find((item: { handle: string }) => item.handle === handle);
  if (!product || !supplier || !supplierProduct) {
    throw new Error(`Missing local or supplier product: ${handle}`);
  }
  const currentGallery = (supplierProduct.images ?? [])
    .map((image: { src?: string }) => image.src)
    .filter((image: string | undefined): image is string => Boolean(image));
  const copy = allCopy[handle];
  product.title = { ua: copy.titleUa, en: copy.titleEn };
  product.longDescription = { ua: copy.descUa, en: copy.descEn };
  product.shortDescription = {
    ua: copy.shortUa,
    en: copy.shortEn,
  };
  if (!configuredHandles.includes(handle)) continue;
  product.options = supplier.options;
  product.gallery = currentGallery;
  product.variants = supplier.variants.map((variant: {
    sourceVariantId: number; title: string; optionValues: string[];
    supplierSku: string | null; internalKey: string;
    regularSupplierUsd: number; available: boolean;
  }) => {
    const details = demoPackage(handle, variant.optionValues);
    const estimate = calculateBurgerVariantPrice({
      productType: supplier.productType,
      supplierUsd: variant.regularSupplierUsd,
      domesticShippingUsd: details.domesticShippingUsd,
      packageEstimate: details.packageEstimate,
    });
    const isDefault = handle === "48-extension-for-fuel-it-flex-fuel-analyzer"
      ? variant.supplierSku === "13AHE-3C-B"
      : handle === "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5"
        ? /^Blue Oiled/.test(variant.title)
      : handle === "air-filters-for-kia-stinger-genesis-g70"
          ? /^2\.0L/.test(variant.title)
        : handle === "kia-stinger-genesis-g70-3-3l-turbo-jb4-performance-tuner"
          ? /^JB4PRO$/i.test(variant.title)
        : handle === "bms-stage-1-bmw-performance-tuner"
          ? /^N20 \/ N26$/i.test(variant.title)
        : variant.optionValues[0] === '5/16" adapter' &&
          /do not include the 950cc/i.test(variant.optionValues[1] ?? "") &&
          /do not add an injector controller/i.test(variant.optionValues[2] ?? "");
    const supplierSku = handle === "bms-elite-dual-intake-for-2025-g90-g99-bmw-m5" &&
      variant.supplierSku?.startsWith("***") ? null : variant.supplierSku;
    return {
      id: `burger-preview-${variant.sourceVariantId}`,
      title: variant.title,
      sku: supplierSku || variant.internalKey,
      optionValues: variant.optionValues,
      image: previewVariantImage(handle, variant.optionValues, currentGallery),
      inventoryQty: variant.available ? 999 : 0,
      isDefault,
      price: money(estimate.priceUsd),
      weightKg: estimate.billableKg,
    };
  });
  const defaultVariant = product.variants.find((variant: { isDefault: boolean }) => variant.isDefault);
  if (!defaultVariant) throw new Error(`No default variant for ${handle}`);
  product.sku = defaultVariant.sku;
  product.price = defaultVariant.price;
  product.image = defaultVariant.image || currentGallery[0] || product.image;
}

fs.writeFileSync(fallbackPath, JSON.stringify(products), "utf8");
const copyReview = [
  "# Burger content preview — local draft",
  "",
  ...selectedHandles.flatMap((handle) => {
    const copy = allCopy[handle];
    return [
      `## ${handle}`,
      "",
      `Source: https://burgertuning.com/products/${handle}`,
      "",
      `### UA title: ${copy.titleUa}`,
      `Meta description: ${copy.shortUa}`,
      "",
      copy.descUa,
      "",
      `### EN title: ${copy.titleEn}`,
      `Meta description: ${copy.shortEn}`,
      "",
      copy.descEn,
      "",
    ];
  }),
].join("\n");
fs.writeFileSync(path.join(root, "tmp", "burger-content-review-2026-09-25.md"), copyReview);
fs.writeFileSync(
  path.join(root, "tmp", "burger-copy-drafts-2026-09-25.json"),
  JSON.stringify(Object.fromEntries(selectedHandles.map((handle) => [handle, {
    ...allCopy[handle],
    sourceUrl: `https://burgertuning.com/products/${handle}`,
    status: "local-draft",
  }])), null, 2) + "\n"
);
console.log(`Prepared local Burger preview: ${previewHandles.join(", ")}`);
console.log(`Source-backed copy drafts: ${selectedHandles.length}`);
console.log(`Original fallback backed up at ${backupPath}`);
