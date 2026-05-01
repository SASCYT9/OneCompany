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
    badge: 'Widestar',
    badgeUk: 'Widestar',
    name: 'Widestar\nBody Kit',
    nameUk: 'Обвіс\nWidestar',
    subtitle: 'Widestar widebody programme for the G-Class W465 — widened front bumper, fender flares, side skirts and rear apron, finished in body colour. TÜV-approved fitment, made to order.',
    subtitleUk: 'Програма Widestar для G-Class W465 — розширений передній бампер, розширювачі арок, бічні пороги та задній фартух, фарбовані в колір кузова. Сертифіковане встановлення TÜV, виготовлення на замовлення.',
    exploreLink: '/shop/brabus/collections/g-class',
    shopLink: '/shop/brabus/collections/g-class',
    avail: 'Made to order',
    availUk: 'Виготовлення на замовлення',
    /** Brabus 800 Deep Blue W465 — painted Widestar body kit (cars-for-sale C4S271), floor whitened */
    imageUrl: '/images/shop/brabus/hq/brabus-gclass-w465-widestar.jpg',
    imageAlt: 'Brabus W465 Widestar painted body kit',
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
