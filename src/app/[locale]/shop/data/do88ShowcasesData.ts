export type Do88Showcase = {
  num: string;
  imageUrl: string;
  imageAlt: string;
  vimeoUrl: string; // If left empty, the script will just not load a video
  badge: string;
  badgeUk: string;
  name: string;
  nameUk: string;
  subtitle: string;
  subtitleUk: string;
  exploreLink: string;
  shopLink: string;
  avail: string;
  availUk: string;
};

export const DO88_SHOWCASES: Do88Showcase[] = [
  {
    num: '01',
    imageUrl: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?q=80&w=900&auto=format&fit=crop',
    imageAlt: 'DO88 Performance Intercooler',
    vimeoUrl: '', // Add vimeo link later
    badge: 'Flagship',
    badgeUk: 'Флагман',
    name: 'Performance\nIntercoolers',
    nameUk: 'Продуктивні\nІнтеркулери',
    subtitle:
      "Engineered in Sweden. Massive core volume increases, CAD-designed cast end tanks, and drop-in fitment.",
    subtitleUk:
      'Розроблено у Швеції. Значне збільшення об\'єму ядра, литі бачки спроектовані в CAD, та встановлення на штатні місця.',
    exploreLink: '/shop/stock?distributor=DO88&q=Intercooler',
    shopLink: '/shop/stock?distributor=DO88&q=Intercooler',
    avail: 'Available to Order',
    availUk: 'Доступно під замовлення',
  },
  {
    num: '02',
    imageUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=900&auto=format&fit=crop',
    imageAlt: 'DO88 Silicone Hoses',
    vimeoUrl: '',
    badge: 'Essential',
    badgeUk: 'Необхідність',
    name: 'Silicone\nHose Kits',
    nameUk: 'Набори\nСиліконових Патрубків',
    subtitle:
      "Multi-layer reinforced silicone hoses. Withstands higher temperatures and pressures than OEM rubber hoses.",
    subtitleUk:
      'Багатошарові армовані силіконові патрубки. Витримують вищі температури та тиск, ніж заводські гумові.',
    exploreLink: '/shop/stock?distributor=DO88&q=Hose',
    shopLink: '/shop/stock?distributor=DO88&q=Hose',
    avail: 'In Stock',
    availUk: 'В наявності',
  },
  {
    num: '03',
    imageUrl: 'https://images.unsplash.com/photo-1596489366629-9e235e1008f1?q=80&w=900&auto=format&fit=crop',
    imageAlt: 'DO88 Aluminum Radiators',
    vimeoUrl: '',
    badge: 'Track Proven',
    badgeUk: 'Перевірено на треку',
    name: 'Aluminum\nRadiators',
    nameUk: 'Алюмінієві\nРадіатори',
    subtitle:
      "High-efficiency core design. Keeps temperatures down on the street and dominant on the track.",
    subtitleUk:
      'Високоефективний дизайн ядра. Знижує температуру як під час щоденних поїздок, так і на трек-днях.',
    exploreLink: '/shop/stock?distributor=DO88&q=Radiator',
    shopLink: '/shop/stock?distributor=DO88&q=Radiator',
    avail: 'Available to Order',
    availUk: 'Доступно під замовлення',
  },
];
