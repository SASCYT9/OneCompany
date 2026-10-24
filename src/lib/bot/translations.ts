// Bot translations
import type { Translations } from './types';

export const translations: Translations = {
  uk: {
    welcome: `� <b>Вітаємо в OneCompany!</b>

Ми — ваш надійний партнер у світі преміум тюнінгу.

🏎️ <b>Авто:</b> Ексклюзивні обвіси, диски, вихлопні системи
🏍️ <b>Мото:</b> Професійне екіпірування та запчастини
🤝 <b>B2B:</b> Спеціальні умови для СТО та дилерів

👇 <b>Оберіть, що вас цікавить:</b>`,
    selectLanguage: '🌐 Оберіть мову інтерфейсу:',
    languageChanged: '🇺🇦 Мову змінено на українську',
    mainMenu: '📱 Головне меню',
    aboutUs: '🏢 Про компанію',
    services: '🛠️ Наші послуги',
    contact: '📝 Створити запит',
    autoProducts: '🏎️ Авто тюнінг',
    motoProducts: '🏍️ Мото світ',
    partnership: '🤝 Стати партнером',
    sendRequest: '✨ Надіслати запит',
    enterName: '👤 Як до вас звертатися?',
    enterEmail: '📧 Ваш Email (для деталей замовлення):',
    enterPhone: '📱 Ваш номер телефону:',
    enterMessage: '💬 <b>Опишіть ваш запит:</b>\n<i>Наприклад: цікавить вихлоп Akrapovic для BMW M5 F90</i>',
    selectCategory: '📂 Оберіть категорію запиту:',
    requestSent: `✅ <b>Запит успішно прийнято!</b>

Номер заявки: <b>#%ID%</b>
Наш менеджер вже отримав сповіщення і зв'яжеться з вами найближчим часом.

Дякуємо, що обрали OneCompany! 🏁`,
    requestFailed: '❌ Виникла помилка. Будь ласка, спробуйте пізніше або напишіть нам на пошту.',
    invalidEmail: '⚠️ Некоректний Email. Спробуйте ще раз:',
    adminPanel: '🔐 Адмін-панель',
    noAccess: '🚫 У вас немає доступу до цієї функції.',
    newMessages: '📬 Нові повідомлення',
    allMessages: '📋 Всі повідомлення',
    settings: '⚙️ Налаштування',
    back: '◀️ Назад',
    cancel: '❌ Скасувати',
    confirm: '✅ Підтвердити',
    catalog: '📚 Каталог брендів',
    priceList: '💰 Прайс-лист',
    website: '🌐 Сайт',
    
    // Partnership
    partnershipWelcome: `🤝 <b>Програма партнерства OneCompany</b>

Ми шукаємо надійних партнерів для розширення мережі дистрибуції.

<b>Ваші переваги:</b>
• Дилерські знижки до 40%
• Пріоритетна доставка
• Технічна підтримка
• Маркетингові матеріали
• Навчання персоналу

Оберіть тип партнерства:`,
    partnershipTypes: {
      sto: '🔧 СТО',
      dealer: '🏪 Дилер',
      detailing: '✨ Детейлінг',
      tuning: '⚡ Тюнінг ательє',
      other: '📋 Інше',
    },
    enterCompanyName: '🏢 Введіть назву компанії:',
    enterWebsite: '🌐 Введіть сайт компанії (або /skip):',
    enterContactPerson: '👤 Введіть контактну особу:',
    partnershipSent: `✅ <b>Заявку на партнерство надіслано!</b>

Наш менеджер з розвитку партнерства зв'яжеться з вами протягом 24 годин.

Дякуємо за інтерес до співпраці! 🤝`,
    
    categories: {
      auto: '🚗 Автомобілі',
      moto: '🏍️ Мотоцикли',
      general: '📦 Загальне',
      partnership: '🤝 Партнерство',
    },
    
    // Catalog
    catalogIntro: `📚 <b>Каталог брендів OneCompany</b>

Оригінальна продукція 200+ преміум брендів — з наявності або під замовлення.`,
    autoBrands: '🚗 Бренди для авто',
    motoBrands: '🏍️ Бренди для мото',
    searchBrand: '🔍 Пошук бренду',
    popularBrands: '⭐ Популярні бренди',
  },
  en: {
    welcome: `🚗 <b>Welcome to OneCompany!</b>

We are a leading supplier of premium automotive and motorcycle parts.

🏎️ <b>Auto:</b> Intake systems, exhausts, cooling
🏍️ <b>Moto:</b> Helmets, protection, accessories
🤝 <b>Partnership:</b> Workshops, dealers, tuning

Choose an action from the menu below:`,
    selectLanguage: '🌐 Select language:',
    languageChanged: '✅ Language changed to English',
    mainMenu: '📋 Main Menu',
    aboutUs: 'ℹ️ About Us',
    services: '🛠️ Services',
    contact: '📞 Contact',
    autoProducts: '🚗 Auto',
    motoProducts: '🏍️ Moto',
    partnership: '🤝 Partnership',
    sendRequest: '✉️ Send Request',
    enterName: '👤 Enter your name:',
    enterEmail: '📧 Enter email (or /skip to skip):',
    enterPhone: '📱 Enter phone (or /skip to skip):',
    enterMessage: '💬 Describe your request:',
    selectCategory: '📂 Select category:',
    requestSent: `✅ <b>Request sent!</b>

Our managers will contact you shortly.

Thank you for reaching out! 🙏`,
    requestFailed: '❌ Failed to send. Please try again later.',
    invalidEmail: '❌ Invalid email format. Try again:',
    adminPanel: '🔐 Admin Panel',
    noAccess: '🚫 You don\'t have access to this feature.',
    newMessages: '📬 New Messages',
    allMessages: '📋 All Messages',
    settings: '⚙️ Settings',
    back: '◀️ Back',
    cancel: '❌ Cancel',
    confirm: '✅ Confirm',
    catalog: '📚 Brand Catalog',
    priceList: '💰 Price List',
    website: '🌐 Website',
    
    // Partnership
    partnershipWelcome: `🤝 <b>OneCompany Partnership Program</b>

We are looking for reliable partners to expand our distribution network.

<b>Your benefits:</b>
• Dealer discounts up to 40%
• Priority delivery
• Technical support
• Marketing materials
• Staff training

Select partnership type:`,
    partnershipTypes: {
      sto: '🔧 Service Station',
      dealer: '🏪 Dealer',
      detailing: '✨ Detailing',
      tuning: '⚡ Tuning Shop',
      other: '📋 Other',
    },
    enterCompanyName: '🏢 Enter company name:',
    enterWebsite: '🌐 Enter company website (or /skip):',
    enterContactPerson: '👤 Enter contact person:',
    partnershipSent: `✅ <b>Partnership application sent!</b>

Our partnership manager will contact you within 24 hours.

Thank you for your interest in cooperation! 🤝`,
    
    categories: {
      auto: '🚗 Automotive',
      moto: '🏍️ Motorcycle',
      general: '📦 General',
      partnership: '🤝 Partnership',
    },
    
    // Catalog
    catalogIntro: `📚 <b>OneCompany Brand Catalog</b>

Genuine parts from 200+ premium brands, in stock or to order.`,
    autoBrands: '🚗 Auto Brands',
    motoBrands: '🏍️ Moto Brands',
    searchBrand: '🔍 Search Brand',
    popularBrands: '⭐ Popular Brands',
  },
  ru: {
    welcome: `🚗 <b>Добро пожаловать в OneCompany!</b>

Мы — ведущий поставщик комплектующих для автомобилей и мотоциклов премиум-класса.

🏎️ <b>Авто:</b> Впускные системы, выхлопы, охлаждение
🏍️ <b>Мото:</b> Шлемы, защита, аксессуары
🤝 <b>Партнёрство:</b> СТО, дилеры, тюнинг

Выберите действие из меню ниже:`,
    selectLanguage: '🌐 Выберите язык:',
    languageChanged: '✅ Язык изменён на русский',
    mainMenu: '📋 Главное меню',
    aboutUs: 'ℹ️ О нас',
    services: '🛠️ Услуги',
    contact: '📞 Связаться',
    autoProducts: '🚗 Авто',
    motoProducts: '🏍️ Мото',
    partnership: '🤝 Партнёрство',
    sendRequest: '✉️ Отправить запрос',
    enterName: '👤 Введите ваше имя:',
    enterEmail: '📧 Введите email (или /skip чтобы пропустить):',
    enterPhone: '📱 Введите телефон (или /skip чтобы пропустить):',
    enterMessage: '💬 Опишите ваш запрос:',
    selectCategory: '📂 Выберите категорию:',
    requestSent: `✅ <b>Запрос отправлен!</b>

Наши менеджеры свяжутся с вами в ближайшее время.

Спасибо за обращение! 🙏`,
    requestFailed: '❌ Ошибка отправки. Попробуйте позже.',
    invalidEmail: '❌ Неверный формат email. Попробуйте ещё раз:',
    adminPanel: '🔐 Панель администратора',
    noAccess: '🚫 У вас нет доступа к этой функции.',
    newMessages: '📬 Новые сообщения',
    allMessages: '📋 Все сообщения',
    settings: '⚙️ Настройки',
    back: '◀️ Назад',
    cancel: '❌ Отмена',
    confirm: '✅ Подтвердить',
    catalog: '📚 Каталог брендов',
    priceList: '💰 Прайс-лист',
    website: '🌐 Сайт',
    
    // Partnership
    partnershipWelcome: `🤝 <b>Партнёрская программа OneCompany</b>

Мы ищем надёжных партнёров для расширения сети дистрибуции.

<b>Ваши преимущества:</b>
• Дилерские скидки до 40%
• Приоритетная доставка
• Техническая поддержка
• Маркетинговые материалы
• Обучение персонала

Выберите тип партнёрства:`,
    partnershipTypes: {
      sto: '🔧 СТО',
      dealer: '🏪 Дилер',
      detailing: '✨ Детейлинг',
      tuning: '⚡ Тюнинг ателье',
      other: '📋 Другое',
    },
    enterCompanyName: '🏢 Введите название компании:',
    enterWebsite: '🌐 Введите сайт компании (или /skip):',
    enterContactPerson: '👤 Введите контактное лицо:',
    partnershipSent: `✅ <b>Заявка на партнёрство отправлена!</b>

Наш менеджер по развитию партнёрства свяжется с вами в течение 24 часов.

Спасибо за интерес к сотрудничеству! 🤝`,
    
    categories: {
      auto: '🚗 Автомобили',
      moto: '🏍️ Мотоциклы',
      general: '📦 Общее',
      partnership: '🤝 Партнёрство',
    },
    
    // Catalog
    catalogIntro: `📚 <b>Каталог брендов OneCompany</b>

Мы являемся официальным дистрибьютором 200+ премиум брендов.`,
    autoBrands: '🚗 Бренды для авто',
    motoBrands: '🏍️ Бренды для мото',
    searchBrand: '🔍 Поиск бренда',
    popularBrands: '⭐ Популярные бренды',
  },
};

// Get translation by key with optional params
export function getTranslation(
  lang: 'uk' | 'en' | 'ru',
  key: string,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      // Fallback to Ukrainian
      value = translations.uk;
      for (const fallbackKey of keys) {
        value = value?.[fallbackKey];
      }
      break;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // Replace params
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
    }
  }
  
  return value;
}
