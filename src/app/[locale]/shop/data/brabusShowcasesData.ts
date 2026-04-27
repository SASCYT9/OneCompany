export type BrabusShowcase = {
  num: string;
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
  imageUrl: string;
  imageAlt: string;
  vimeoUrl: string;
};

/**
 * Engineering Perfection — Brabus retail parts that customers can actually
 * order standalone (not commission-only / complete-car packages).
 *
 * Excluded by the client: full carbon body kits and Masterpiece interior
 * programmes — these are commissioned together with a complete vehicle build,
 * not sold as parts.
 *
 * All photos are official Brabus product shots downloaded from brabus.com.
 */
export const BRABUS_SHOWCASES: BrabusShowcase[] = [
  {
    num: '01',
    badge: 'Signature',
    badgeUk: 'Signature',
    name: 'Forged\nWheels',
    nameUk: 'Ковані\nДиски',
    subtitle: 'Brabus Monoblock series — Z, F, Y, M. Forged in Germany, available in 19″, 20″, 21″ and 22″ for Mercedes, AMG and Porsche.',
    subtitleUk: 'Серія Brabus Monoblock — Z, F, Y, M. Куті в Німеччині, у розмірах 19″, 20″, 21″, 22″ для Mercedes, AMG та Porsche.',
    exploreLink: '/shop/brabus/collections/wheels',
    shopLink: '/shop/brabus/collections/wheels',
    avail: 'In stock',
    availUk: 'В наявності',
    /** Official Brabus Monoblock Z 20" press image — clean white background */
    imageUrl: '/images/shop/brabus/hq/brabus-wheels-monoz.jpg',
    imageAlt: 'Brabus Monoblock Z forged wheel',
    vimeoUrl: '',
  },
  {
    num: '02',
    badge: 'Performance',
    badgeUk: 'Performance',
    name: 'Sport\nExhaust',
    nameUk: 'Спорт\nВихлоп',
    subtitle: 'Stainless-steel sport exhaust with electrically actuated flaps, carbon-fibre tip surrounds and twin chrome or black-chrome outlets.',
    subtitleUk: 'Спортивний вихлоп з нержавійки з електроклапанами, карбоновим обрамленням наконечників та подвійними хром / чорний хром виходами.',
    exploreLink: '/shop/brabus/products',
    shopLink: '/shop/brabus/products',
    avail: 'Made to order',
    availUk: 'Виготовлення на замовлення',
    /** Official Brabus illuminated sport exhaust press image — close-up of carbon + twin tips */
    imageUrl: '/images/shop/brabus/hq/brabus-exhaust-bel.jpg',
    imageAlt: 'Brabus illuminated sport exhaust system',
    vimeoUrl: '',
  },
  {
    num: '03',
    badge: 'PowerXtra',
    badgeUk: 'PowerXtra',
    name: 'PowerXtra\nModule',
    nameUk: 'Модуль\nPowerXtra',
    subtitle: 'Plug-in ECU upgrade with TÜV approval. B40 raises G 63 W465 to 700 HP, B40s lifts it to 800 HP — installation in under an hour.',
    subtitleUk: 'Plug-in модуль ЕБУ з сертифікатом TÜV. B40 підіймає G 63 W465 до 700 к.с., B40s — до 800 к.с. Встановлення менше години.',
    exploreLink: '/shop/brabus/products',
    shopLink: '/shop/brabus/products',
    avail: 'Available for order',
    availUk: 'Доступно для замовлення',
    /** Official Brabus PowerXtra B40-700 module box (brabus.com) */
    imageUrl: '/images/shop/brabus/hq/brabus-powerxtra-b40.jpg',
    imageAlt: 'Brabus PowerXtra B40-700 power upgrade module',
    vimeoUrl: '',
  }
];
