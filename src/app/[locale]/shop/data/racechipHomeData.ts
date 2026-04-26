/* ─────────────────────────────────────────────────────
   RaceChip Home Data — bilingual content (single flagship: GTS 5 Black)
───────────────────────────────────────────────────── */

export const RACECHIP_HERO = {
  eyebrow: 'One Company × RaceChip',
  eyebrowUk: 'One Company × RaceChip',
  subtitle:
    'German-engineered chip tuning, trusted by 500,000+ drivers worldwide. Up to 30% more power, instant smartphone control, plug & drive in 15 minutes.',
  subtitleUk:
    'Німецький чіп-тюнінг, якому довіряють понад 500 000 водіїв у світі. До 30% більше потужності, миттєве керування зі смартфону, встановлення Plug & Drive за 15 хвилин.',
  primaryButtonLabel: 'Find Your Tuning',
  primaryButtonLabelUk: 'Підібрати тюнінг',
  primaryButtonLink: '#rc-finder',
  // Real RaceChip product photography (host whitelisted in next.config)
  heroImage: 'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-black-three-quarter.png',
};

/* GTS 5 Black flagship — single product showcased on the brand home.
   Copy reflects the official RaceChip positioning of the GTS Black /
   GTS 5 Black tier (7-channel mapping, App Control included). */
export const RACECHIP_FLAGSHIP = {
  badge: 'Flagship',
  badgeUk: 'Флагман',
  title: 'RaceChip GTS 5 Black',
  titleUk: 'RaceChip GTS 5 Black',
  tagline: 'The most advanced chip tuning module RaceChip has ever built.',
  taglineUk: 'Найдосконаліший чіп-тюнінг модуль, який коли-небудь випускав RaceChip.',
  description:
    'GTS 5 Black is the new flagship of the RaceChip line-up. A 7-channel piggyback computer that reads live data from your engine\'s sensors, calculates a safer fuel-and-boost map than the factory ECU, and feeds it back without overwriting any original software. Optimised in real-world test drives at the RaceChip headquarters in Göppingen, Germany — and shipped with App Control already included.',
  descriptionUk:
    'GTS 5 Black — новий флагман модельного ряду RaceChip. 7-канальний piggyback-комп\'ютер зчитує живі дані з датчиків двигуна, формує безпечніший паливо-наддувний мапу, ніж заводський ECU, та повертає їх назад, не перезаписуючи оригінальне ПЗ. Налаштовано у реальних тестових поїздках у штаб-квартирі RaceChip у Гьоппінгені, Німеччина, і поставляється з App Control у комплекті.',
  imageUrl: 'https://www.racechip.eu/media/wysiwyg/product_overlay/gts-black-three-quarter.png',
  // Highlight bullets (official-style spec list)
  highlights: [
    {
      en: '7-channel ECU mapping',
      uk: '7-канальне мапування ECU',
      detailEn: 'Reads RPM, boost, rail pressure, intake & exhaust temps, MAF and lambda — vs. 3 channels on entry-level chips.',
      detailUk: 'Зчитує оберти, наддув, тиск у рейці, температуру впуску й випуску, MAF і lambda — проти 3 каналів у базових чіпах.',
    },
    {
      en: 'Up to +30% horsepower & torque',
      uk: 'До +30% потужності та крутного моменту',
      detailEn: 'Verified gains across 4,900+ vehicle variants, with calibrations specific to your exact engine code.',
      detailUk: 'Перевірений приріст на 4 900+ модифікаціях авто, з калібровками під ваш конкретний код двигуна.',
    },
    {
      en: 'App Control included',
      uk: 'App Control у комплекті',
      detailEn: 'Switch between Efficiency, Sport and Race modes from your phone. Schedule warm-up timers. Receive OTA updates for life.',
      detailUk: 'Перемикайте режими Efficiency, Sport, Race зі смартфона. Налаштовуйте таймер прогріву. Отримуйте OTA-оновлення довічно.',
    },
    {
      en: '15-minute Plug & Drive install',
      uk: 'Встановлення Plug & Drive за 15 хвилин',
      detailEn: 'Routes through the OEM sensor harness — no cutting, no soldering, no ECU re-flash. Removable in minutes.',
      detailUk: 'Підключається через штатну OEM-косу датчиків — без різання, паяння чи перепрошивки ECU. Знімається за хвилини.',
    },
    {
      en: 'Built-in safety package',
      uk: 'Вбудований пакет безпеки',
      detailEn: 'Multi-layer protection prevents over-boost, over-heating and excess injector duty cycle. Manufacturer warranty cover available.',
      detailUk: 'Багаторівневий захист запобігає over-boost, перегріву та надмірному навантаженню форсунок. Доступна гарантія виробника.',
    },
    {
      en: 'Made in Germany',
      uk: 'Зроблено в Німеччині',
      detailEn: 'Designed, manufactured and quality-controlled at RaceChip\'s Göppingen facility since 2008.',
      detailUk: 'Розроблено, виготовлено та проконтрольовано на якість на заводі RaceChip у Гьоппінгені з 2008 року.',
    },
  ],
  catalogLink: '/shop/racechip/catalog',
};

export const RACECHIP_APP = {
  label: 'See It In Action',
  labelUk: 'Дивіться у дії',
  title: 'Built In Germany. Driven Everywhere.',
  titleUk: 'Збудовано в Німеччині. Їде всюди.',
  description:
    'Engineered in Göppingen. Calibrated for 4,900+ specific engines. Plug & drive in 15 minutes — every driving mode at your fingertips.',
  descriptionUk:
    'Інженерія з Гьоппінгена. Каліброване під 4 900+ конкретних двигунів. Plug & drive за 15 хвилин — усі режими у вашому смартфоні.',
  features: [
    { en: 'Switch Efficiency / Sport / Race from your phone', uk: 'Перемикання Efficiency / Sport / Race зі смартфона' },
    { en: 'Lifetime over-the-air software updates', uk: 'Довічні OTA-оновлення ПЗ' },
    { en: 'Compatible with 60+ vehicle brands worldwide', uk: 'Сумісність з 60+ марками авто у світі' },
  ],
  // Official RaceChip YouTube short: GTS 5 & GTS 5 Black reveal
  youtubeId: 'xK74ZwMhVeg',
  youtubeTitle: 'RaceChip GTS 5 & GTS 5 Black',
};

export const RACECHIP_ENGINEERING = {
  label: 'German Engineering',
  labelUk: 'Німецька інженерія',
  title: 'Power Meets Precision.',
  titleUk: 'Абсолютна точність та динаміка.',
  description:
    "Precision engineered in Germany. The RaceChip GTS 5 Black interfaces seamlessly with your engine's sensors via a high-grade, plug-and-play wiring harness, safely unlocking hidden power reserves without permanently altering the factory ECU.",
  descriptionUk:
    'Справжня німецька інженерія. RaceChip GTS 5 Black підключається безпосередньо до датчиків двигуна через професійну систему Plug & Drive. Він безпечно розкриває прихований потенціал автомобіля, не залишаючи жодних слідів у заводському блоці управління (ECU).',
  features: [
    { en: 'Plug & Drive installation in 15 minutes', uk: 'Встановлення Plug & Drive за 15 хвилин' },
    { en: 'Preserves factory engine warranty limits', uk: 'Зберігає ліміти заводської гарантії' },
    { en: 'Invisible to official dealership diagnostics', uk: 'Невидимий для офіційної діагностики' },
  ],
  imageUrl: 'https://www.racechip.eu/media/wysiwyg/pdp_images/product-gts-connect_shop.png',
};

