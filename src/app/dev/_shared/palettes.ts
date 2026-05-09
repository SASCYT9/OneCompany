export type PaletteId =
  | "warm-cream"
  | "apple-minimal"
  | "soft-bronze"
  | "porsche-editorial"
  | "hermes-cream"
  | "stealth-wealth"
  | "editorial-bone";

export type Palette = {
  id: PaletteId;
  name: string;
  short: string;
  description: string;
  inspiration: string;
};

export const PALETTES: readonly Palette[] = [
  {
    id: "warm-cream",
    name: "Warm Cream",
    short: "теплий cream + бронза",
    description:
      "Тепла кремова основа з тим самим бронзовим акцентом, що й у dark — максимальна бренд-консистентність.",
    inspiration: "Hermès × Akrapovic premium catalog",
  },
  {
    id: "apple-minimal",
    name: "Apple Minimal",
    short: "білий + графіт + sapphire",
    description:
      "Чистий білий, графітовий primary, синій accent. Без бронзи. Tech-luxury, ідеальна читабельність.",
    inspiration: "apple.com / linear.app / vercel.com",
  },
  {
    id: "soft-bronze",
    name: "Soft Bronze",
    short: "off-white + приглушена бронза",
    description:
      "М'який off-white з приглушеною бронзою. Компроміс між теплом і нейтральністю — read-friendly.",
    inspiration: "raycast.com / arc.net light themes",
  },
  {
    id: "porsche-editorial",
    name: "Porsche Editorial",
    short: "білий + чорний + carmine red",
    description:
      "Pure white, near-black типографіка, карміновий червоний як signature accent. Найенергійніший варіант.",
    inspiration: "porsche.com / mclaren.com",
  },
  {
    id: "hermes-cream",
    name: "Hermès Cream",
    short: "saturated cream + orange",
    description:
      "Насичений теплий cream з фірмовим orange. Найпреміумніший feel, але вимагає світлих фотографій.",
    inspiration: "hermes.com flagship",
  },
  {
    id: "stealth-wealth",
    name: "Stealth Wealth",
    short: "холодний silver монохром",
    description:
      "Cool silver монохром з near-black primary. Бронза присутня тонко, лише як accent. Дуже стримано.",
    inspiration: "watchmaking + bottegaveneta.com",
  },
  {
    id: "editorial-bone",
    name: "Editorial Bone",
    short: "parchment + deep navy",
    description:
      "Bone/parchment основа з глибоким navy і теракотовим accent. Vintage-luxury feel, як старий каталог.",
    inspiration: "fashion magazines / vintage Porsche manuals",
  },
] as const;

export const DEFAULT_PALETTE: PaletteId = "warm-cream";
