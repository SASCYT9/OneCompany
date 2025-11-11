// src/lib/categoryData.ts

import { Brand } from './brands';

export interface CategoryData {
  slug: string;
  title: {
    en: string;
    ua: string;
  };
  description: {
    en: string;
    ua: string;
  };
  brands: Brand[];
}

export const categoryData: CategoryData[] = [
  {
    slug: 'exhaust',
    title: {
      en: 'Exhaust Systems',
      ua: 'Системи випуску',
    },
    description: {
      en: 'An exhaust system is not just a set of pipes; it is a critical component that dictates your vehicle\'s performance, sound, and efficiency. Upgrading to a high-performance exhaust system can unlock significant horsepower and torque gains, provide a more aggressive and satisfying exhaust note, and often reduce overall vehicle weight. From full cat-back systems to performance headers and mufflers, we offer solutions from the world\'s top manufacturers.',
      ua: 'Вихлопна система - це не просто набір труб; це критично важливий компонент, який визначає продуктивність, звук та ефективність вашого автомобіля. Оновлення до високопродуктивної вихлопної системи може розблокувати значний приріст кінських сил і крутного моменту, забезпечити більш агресивний і приємний звук вихлопу, а також часто зменшити загальну вагу автомобіля. Від повних систем кат-бек до спортивних колекторів і глушників, ми пропонуємо рішення від провідних світових виробників.',
    },
    brands: [
      { name: 'Akrapovic' },
      { name: 'FI Exhaust' },
      { name: 'Capristo' },
      { name: 'Armytrix' },
      { name: 'IPE Exhaust' },
      { name: 'Milltek' },
      { name: 'Remus' },
      { name: 'Supersprint' },
      { name: 'Tubi Style' },
      { name: 'Borla' },
      { name: 'Fabspeed' },
      { name: 'SC-Project' },
      { name: 'Austin Racing' },
      { name: 'Termignoni' },
    ],
  },
  // Add other categories here...
];
