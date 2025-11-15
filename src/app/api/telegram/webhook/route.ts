import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const prisma = new PrismaClient();

interface TelegramUpdate {
  message?: {
    chat: {
      id: number;
      first_name?: string;
      username?: string;
    };
    text?: string;
    from?: {
      id: number;
      first_name?: string;
      username?: string;
    };
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name?: string;
      username?: string;
    };
    message?: {
      chat: {
        id: number;
      };
      message_id: number;
    };
    data?: string;
  };
}

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  web_app?: {
    url: string;
  };
  url?: string;
}

// Мовні переклади
const translations = {
  uk: {
    welcome: (name: string) => `Вітаємо, ${name}!`,
    company: 'OneCompany',
    tagline: 'Преміум автомобільні та мотоциклетні запчастини',
    benefits: [
      'Понад 200 світових брендів',
      'Швидка доставка по Україні',
      'Професійна консультація'
    ],
    selectAction: 'Оберіть дію:',
    brands: 'Наші бренди',
    contact: 'Контакти',
    dashboard: 'Dashboard',
    help: 'Допомога',
    auto: 'Автомобільні',
    moto: 'Мотоциклетні',
    back: 'Назад',
    mainMenu: 'Головне меню',
    selectBrand: 'Наші преміум бренди',
    selectCategory: 'Оберіть категорію:',
    autoBrands: 'Авто бренди',
    motoBrands: 'Мото бренди',
    allBrands: 'Всі 200+ брендів',
    topBrandsDescription: 'Найкращі світові виробники автомобільних компонентів',
    autoBrandsDescription: 'Преміум бренди для вашого автомобіля',
    motoBrandsDescription: 'Преміум бренди для вашого мотоцикла',
    requestConsultation: 'Запитати консультацію',
    leaveRequest: 'Залишити заявку',
    allBrandsTitle: 'Всі наші бренди',
    viewFullCatalog: 'Переглянути повний каталог преміум брендів',
    catalogLink: 'https://onecompany.com.ua/brands',
    onSiteYouWillFind: 'На сайті ви знайдете',
    catalogFeatures: [
      'Детальну інформацію про кожен бренд',
      'Фото та характеристики',
      'Наявність на складі',
      'Можливість замовлення online'
    ],
    email: 'Email',
    phone: 'Телефон',
    location: 'Київ, Україна',
    messageUs: 'Або напишіть нам безпосередньо - відповімо протягом 15 хвилин',
    dashboardTitle: 'Web3 Dashboard',
    dashboardPanel: 'Панель управління повідомленнями',
    helpSteps: [
      'Підібрати деталі для вашого авто/мото',
      'Проконсультувати по наявності та цінам',
      'Організувати доставку та встановлення',
      'Технічна підтримка та консультації'
    ],
    quickRequest: 'Натисніть кнопку для швидкої заявки',
    orWriteWhat: 'Або просто напишіть що вам потрібно',
    autoRequestButton: 'Заявка для авто',
    motoRequestButton: 'Заявка для мото',
    autoRequestTitle: 'Заявка на автомобільні запчастини',
    motoRequestTitle: 'Заявка на мотоциклетні запчастини',
    hello: (name: string) => `Вітаємо, ${name}!`,
    pleaseProvide: 'Будь ласка, надайте',
    makeModel: 'Марка та модель',
    autoExample: 'BMW M3 F80',
    motoExample: 'Ducati Panigale V4',
    whatNeed: 'Що саме шукаєте',
    exhaustExample: 'випускна система Akrapovic',
    motoExhaustExample: 'випуск SC-Project',
    budgetOptional: 'Бюджет (необов\'язково)',
    writeOneMessage: 'Просто напишіть все одним повідомленням, наш менеджер зв\'яжеться з вами',
    premiumAutoBrands: 'Преміум автомобільні бренди',
    premiumMotoBrands: 'Преміум мотоциклетні бренди',
    viewCatalog: 'Перегляньте повний каталог преміум брендів на сайті',
    contactInfo: 'Контактна інформація',
    workSchedule: 'Графік роботи',
    workDays: 'Понеділок - П\'ятниця: 9:00 - 18:00',
    saturday: 'Субота: 10:00 - 16:00',
    sunday: 'Неділя: вихідний',
    writeUs: 'Або напишіть нам безпосередньо',
    dashboardAccess: 'Доступ до панелі управління',
    authorization: 'Авторізація',
    adminOnly: 'Доступ обмежено для адміністраторів',
    features: 'Функціонал',
    featuresList: [
      'Перегляд всіх повідомлень',
      'Фільтри за категоріями',
      'Пошук та управління статусами',
      'Архівування',
      'Оновлення в реальному часі'
    ],
    howWeHelp: 'Як ми можемо допомогти',
    services: [
      'Підбір деталей для вашого транспорту',
      'Консультації щодо наявності та цін',
      'Організація доставки та встановлення',
      'Технічна підтримка'
    ],
    howToOrder: 'Як замовити',
    orderInstructions: 'Використовуйте кнопку швидкої заявки або опишіть що вам потрібно',
    responseTime: 'Відповідь протягом 15 хвилин',
    autoRequest: 'Заявка на автомобільні запчастини',
    motoRequest: 'Заявка на мотоциклетні запчастини',
    provideInfo: 'Будь ласка, надайте наступну інформацію',
    modelInfo: 'Марка та модель',
    whatLooking: 'Що саме шукаєте',
    budget: 'Бюджет (необов\'язково)',
    sendMessage: 'Надішліть всю інформацію одним повідомленням',
    thankYou: (name: string) => `Дякуємо за ваше звернення, ${name}`,
    requestReceived: 'Ваш запит отримано та передано менеджеру',
    expectResponse: 'Очікуйте відповіді',
    meanwhile: 'Тим часом ви можете',
    openDashboard: 'Відкрити Dashboard',
    changeLanguage: 'Змінити мову'
  },
  en: {
    welcome: (name: string) => `Welcome, ${name}!`,
    company: 'OneCompany',
    tagline: 'Premium automotive and motorcycle parts',
    benefits: [
      'Over 200 global brands',
      'Fast delivery across Ukraine',
      'Professional consultation'
    ],
    selectAction: 'Select action:',
    brands: 'Our Brands',
    contact: 'Contact',
    dashboard: 'Dashboard',
    help: 'Help',
    auto: 'Automotive',
    moto: 'Motorcycle',
    back: 'Back',
    mainMenu: 'Main Menu',
    selectBrand: 'Our Premium Brands',
    selectCategory: 'Select category:',
    autoBrands: 'Auto Brands',
    motoBrands: 'Moto Brands',
    allBrands: 'All 200+ Brands',
    topBrandsDescription: 'World\'s leading automotive component manufacturers',
    autoBrandsDescription: 'Premium brands for your car',
    motoBrandsDescription: 'Premium brands for your motorcycle',
    requestConsultation: 'Request Consultation',
    leaveRequest: 'Leave Request',
    allBrandsTitle: 'All Our Brands',
    viewFullCatalog: 'View the complete catalog of premium brands',
    catalogLink: 'https://onecompany.com.ua/brands',
    onSiteYouWillFind: 'On the website you will find',
    catalogFeatures: [
      'Detailed information about each brand',
      'Photos and specifications',
      'Stock availability',
      'Online ordering capability'
    ],
    email: 'Email',
    phone: 'Phone',
    location: 'Kyiv, Ukraine',
    messageUs: 'Or message us directly - we respond within 15 minutes',
    dashboardTitle: 'Web3 Dashboard',
    dashboardPanel: 'Message Management Panel',
    helpSteps: [
      'Select parts for your vehicle',
      'Consult on availability and pricing',
      'Arrange delivery and installation',
      'Technical support and consultations'
    ],
    quickRequest: 'Click the button for quick request',
    orWriteWhat: 'Or simply write what you need',
    autoRequestButton: 'Auto Request',
    motoRequestButton: 'Moto Request',
    autoRequestTitle: 'Automotive Parts Request',
    motoRequestTitle: 'Motorcycle Parts Request',
    hello: (name: string) => `Hello, ${name}!`,
    pleaseProvide: 'Please provide',
    makeModel: 'Make and model',
    autoExample: 'BMW M3 F80',
    motoExample: 'Ducati Panigale V4',
    whatNeed: 'What exactly do you need',
    exhaustExample: 'Akrapovic exhaust system',
    motoExhaustExample: 'SC-Project exhaust',
    budgetOptional: 'Budget (optional)',
    writeOneMessage: 'Simply write everything in one message, our manager will contact you',
    premiumAutoBrands: 'Premium Automotive Brands',
    premiumMotoBrands: 'Premium Motorcycle Brands',
    viewCatalog: 'View the complete catalog of premium brands on our website',
    contactInfo: 'Contact Information',
    workSchedule: 'Working Hours',
    workDays: 'Monday - Friday: 9:00 AM - 6:00 PM',
    saturday: 'Saturday: 10:00 AM - 4:00 PM',
    sunday: 'Sunday: Closed',
    writeUs: 'Or message us directly',
    dashboardAccess: 'Dashboard Access',
    authorization: 'Authorization',
    adminOnly: 'Access restricted to administrators',
    features: 'Features',
    featuresList: [
      'View all messages',
      'Category filters',
      'Search and status management',
      'Archiving',
      'Real-time updates'
    ],
    howWeHelp: 'How We Can Help',
    services: [
      'Parts selection for your vehicle',
      'Availability and pricing consultation',
      'Delivery and installation arrangement',
      'Technical support'
    ],
    howToOrder: 'How to Order',
    orderInstructions: 'Use the quick request button or describe what you need',
    responseTime: 'Response within 15 minutes',
    autoRequest: 'Automotive Parts Request',
    motoRequest: 'Motorcycle Parts Request',
    provideInfo: 'Please provide the following information',
    modelInfo: 'Make and model',
    whatLooking: 'What exactly are you looking for',
    budget: 'Budget (optional)',
    sendMessage: 'Send all information in one message',
    thankYou: (name: string) => `Thank you for your request, ${name}`,
    requestReceived: 'Your request has been received and forwarded to our manager',
    expectResponse: 'Expect a response',
    meanwhile: 'Meanwhile, you can',
    openDashboard: 'Open Dashboard',
    changeLanguage: 'Change Language'
  }
};

// Збереження мови користувача (в production використовуйте БД)
const userLanguages = new Map<number, 'uk' | 'en'>();

function getUserLanguage(userId: number): 'uk' | 'en' {
  return userLanguages.get(userId) || 'uk';
}

function setUserLanguage(userId: number, lang: 'uk' | 'en') {
  userLanguages.set(userId, lang);
}

/**
 * Handles incoming webhook updates from Telegram.
 * https://core.telegram.org/bots/api#update
 */
export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram Webhook:', JSON.stringify(update, null, 2));

    // Обробка callback queries (натискання кнопок)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message?.chat.id || 0;
      const data = callbackQuery.data || '';
      const userName = callbackQuery.from.first_name || callbackQuery.from.username || 'Гість';
      const userId = callbackQuery.from.id || 0;

      // Підтверджуємо отримання callback
      await answerCallbackQuery(callbackQuery.id);

      // Обробляємо натискання кнопки
      await handleButtonCallback(chatId, data, userName, userId);

      return NextResponse.json({ ok: true });
    }

    // Перевіряємо чи є повідомлення
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;
      const userName = update.message.from?.first_name || update.message.from?.username || 'Гість';
      const userId = update.message.from?.id || 0;
      const userUsername = update.message.from?.username;

      // Зберігаємо повідомлення в store
      const messageType = messageText.startsWith('/') ? 'command' : 'incoming';
      await prisma.message.create({
        data: {
          userName: userName,
          userEmail: userUsername ? `${userUsername}@telegram` : `${userId}@telegram`, // Placeholder email
          messageText: messageText,
          status: 'NEW',
          category: 'GENERAL',
          metadata: {
            type: messageType,
            chatId,
            userId,
            userUsername,
          }
        }
      });

      // Обробка команд
      if (messageText === '/start') {
        const lang = getUserLanguage(userId);
        const t = translations[lang];
        
        // Перевіряємо чи користувач вже обрав мову
        if (!userLanguages.has(userId)) {
          // Перший візит - показуємо вибір мови
          await sendTelegramMessageWithButtons(
            chatId,
            'Please select your language / Будь ласка, оберіть мову:',
            [
              [
                { text: 'Українська 🇺🇦', callback_data: 'lang_uk' },
                { text: 'English 🇬🇧', callback_data: 'lang_en' }
              ]
            ]
          );
        } else {
          // Показуємо головне меню
          await sendMainMenu(chatId, userName, lang);
        }
      } else {
        // Будь-яке інше повідомлення - переслати менеджеру
        const lang = getUserLanguage(userId);
        const t = translations[lang];
        
        if (TELEGRAM_CHAT_ID) {
          const userInfo = update.message.from?.username 
            ? `@${update.message.from.username}` 
            : `${userName} (ID: ${update.message.from?.id})`;

          await sendTelegramMessage(
            parseInt(TELEGRAM_CHAT_ID),
            lang === 'uk' 
              ? `<b>Нове повідомлення від клієнта</b>\n\n` +
                `Від: ${userInfo}\n` +
                `Повідомлення:\n${messageText}\n\n` +
                `Chat ID: ${chatId}`
              : `<b>New Customer Message</b>\n\n` +
                `From: ${userInfo}\n` +
                `Message:\n${messageText}\n\n` +
                `Chat ID: ${chatId}`
          );
        }
        
        await sendTelegramMessageWithButtons(
          chatId,
          `${t.thankYou(userName)}\n\n` +
          `${t.requestReceived}\n\n` +
          `${t.expectResponse}\n\n` +
          `${t.meanwhile}:`,
          [
            [
              { text: `🏆 ${t.brands}`, callback_data: 'btn_brands' },
              { text: `📱 ${t.contact}`, callback_data: 'btn_contact' }
            ],
            [
              { text: `◀️ ${t.mainMenu}`, callback_data: 'btn_back' }
            ]
          ]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Error processing Telegram webhook:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unhandled Telegram webhook error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Функція для відправки повідомлення в Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    throw error;
  }
}

// Функція для відправки повідомлення з inline кнопками
async function sendTelegramMessageWithButtons(
  chatId: number,
  text: string,
  buttons: InlineKeyboardButton[][]
) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Telegram API error:', JSON.stringify(errorData, null, 2));
      console.error('📝 Message text:', text);
      console.error('🔘 Buttons:', JSON.stringify(buttons, null, 2));
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    throw error;
  }
}

// Функція для підтвердження callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '✅',
        show_alert: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to answer callback query:', error);
    throw error;
  }
}

// Функція для відправки головного меню
async function sendMainMenu(chatId: number, userName: string, lang: 'uk' | 'en') {
  const t = translations[lang];
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.com.ua';
  
  const message = 
    `${t.welcome(userName)}\n\n` +
    `<b>${t.company}</b>\n` +
    `${t.tagline}\n\n` +
    `${t.benefits.map(b => `• ${b}`).join('\n')}\n\n` +
    `${t.selectAction}`;
  
  await sendTelegramMessageWithButtons(
    chatId,
    message,
    [
      [
        { text: `🏆 ${t.brands}`, callback_data: 'btn_brands' },
        { text: `📱 ${t.contact}`, callback_data: 'btn_contact' }
      ],
      [
        { 
          text: `💼 ${t.openDashboard}`,
          web_app: { url: `${dashboardUrl}/messages` }
        },
        { text: `❓ ${t.help}`, callback_data: 'btn_help' }
      ],
      [
        { text: `🚗 ${t.auto}`, callback_data: 'btn_auto' },
        { text: `🏍️ ${t.moto}`, callback_data: 'btn_moto' }
      ],
      [
        { text: `🌐 ${t.changeLanguage}`, callback_data: 'btn_change_lang' }
      ]
    ]
  );
}

// Обробка натискання кнопок
async function handleButtonCallback(chatId: number, data: string, userName: string, userId: number = 0) {
  const lang = getUserLanguage(userId);
  const t = translations[lang];
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.com.ua';
  
  switch (data) {
    case 'lang_uk':
      setUserLanguage(userId, 'uk');
      await sendMainMenu(chatId, userName, 'uk');
      break;
      
    case 'lang_en':
      setUserLanguage(userId, 'en');
      await sendMainMenu(chatId, userName, 'en');
      break;
      
    case 'btn_change_lang':
      await sendTelegramMessageWithButtons(
        chatId,
        'Select language / Оберіть мову:',
        [
          [
            { text: 'Українська 🇺🇦', callback_data: 'lang_uk' },
            { text: 'English 🇬🇧', callback_data: 'lang_en' }
          ]
        ]
      );
      break;
    case 'btn_brands':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.selectBrand}</b>\n\n${t.selectCategory}`,
        [
          [
            { text: `🚗 ${t.autoBrands}`, callback_data: 'btn_auto_brands' },
            { text: `🏍️ ${t.motoBrands}`, callback_data: 'btn_moto_brands' }
          ],
          [
            { text: `🌐 ${t.allBrands}`, callback_data: 'btn_all_brands' }
          ],
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_back' }
          ]
        ]
      );
      break;

    case 'btn_auto_brands':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.premiumAutoBrands}</b>\n\n${t.autoBrandsDescription}\n\n` +
        `• KW Suspension - ${lang === 'uk' ? 'підвіска' : 'suspension'}\n` +
        `• Eventuri - ${lang === 'uk' ? 'впускні системи' : 'intake systems'}\n` +
        `• FI Exhaust - ${lang === 'uk' ? 'випускні системи' : 'exhaust systems'}\n` +
        `• Brembo - ${lang === 'uk' ? 'гальмівні системи' : 'brake systems'}\n` +
        `• Akrapovic - ${lang === 'uk' ? 'випуски' : 'exhausts'}\n` +
        `• Mansory - ${lang === 'uk' ? 'тюнінг' : 'tuning'}\n` +
        `• Novitec - Ferrari/Lamborghini\n` +
        `• Brabus - Mercedes`,
        [
          [
            { text: `📝 ${t.leaveRequest}`, callback_data: 'btn_request_auto' }
          ],
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_brands' }
          ]
        ]
      );
      break;

    case 'btn_moto_brands':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.premiumMotoBrands}</b>\n\n${t.motoBrandsDescription}\n\n` +
        `• SC-Project - ${lang === 'uk' ? 'випускні системи' : 'exhaust systems'}\n` +
        `• Rizoma - ${lang === 'uk' ? 'аксесуари' : 'accessories'}\n` +
        `• Arrow - ${lang === 'uk' ? 'випуски' : 'exhausts'}\n` +
        `• Termignoni - ${lang === 'uk' ? 'випуски' : 'exhausts'}\n` +
        `• Yoshimura - ${lang === 'uk' ? 'тюнінг' : 'tuning'}\n` +
        `• Öhlins - ${lang === 'uk' ? 'підвіска' : 'suspension'}\n` +
        `• Brembo Racing - ${lang === 'uk' ? 'гальма' : 'brakes'}\n` +
        `• Akrapovic - ${lang === 'uk' ? 'випуски' : 'exhausts'}`,
        [
          [
            { text: `📝 ${t.leaveRequest}`, callback_data: 'btn_request_moto' }
          ],
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_brands' }
          ]
        ]
      );
      break;

    case 'btn_all_brands':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.allBrandsTitle}</b>\n\n` +
        `${t.viewFullCatalog}:\n\n` +
        `👉 ${t.catalogLink}\n\n` +
        `${t.onSiteYouWillFind}:\n` +
        t.catalogFeatures.map(feature => `• ${feature}`).join('\n'),
        [
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_brands' }
          ]
        ]
      );
      break;

    case 'btn_contact':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.contactInfo}</b>\n\n` +
        `📧 ${t.email}: info@onecompany.com\n` +
        `📱 ${t.phone}: +380 12 345 67 89\n` +
        `📍 ${t.location}\n\n` +
        `⏰ ${t.workSchedule}:\n` +
        `${t.workDays}\n` +
        `${t.saturday}\n` +
        `${t.sunday}\n\n` +
        `${t.messageUs}`,
        [
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_back' }
          ]
        ]
      );
      break;

    case 'btn_dashboard':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.dashboardTitle}</b>\n\n` +
        `${t.dashboardPanel}:\n\n` +
        `🔗 ${dashboardUrl}/messages\n\n` +
        `<b>${t.authorization}:</b>\n` +
        `${t.adminOnly}\n\n` +
        `<b>${t.features}:</b>\n` +
        t.featuresList.map(feature => `• ${feature}`).join('\n'),
        [
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_back' }
          ]
        ]
      );
      break;

    case 'btn_help':
      await sendTelegramMessageWithButtons(
        chatId,
        `<b>${t.howWeHelp}:</b>\n\n` +
        t.helpSteps.map((step, i) => `${i + 1}️⃣ ${step}`).join('\n') + '\n\n' +
        `<b>${t.howToOrder}:</b>\n\n` +
        `• ${t.quickRequest}\n` +
        `• ${t.orWriteWhat}\n\n` +
        `${t.responseTime}`,
        [
          [
            { text: `🚗 ${t.autoRequestButton}`, callback_data: 'btn_request_auto' },
            { text: `🏍️ ${t.motoRequestButton}`, callback_data: 'btn_request_moto' }
          ],
          [
            { text: `◀️ ${t.back}`, callback_data: 'btn_back' }
          ]
        ]
      );
      break;

    case 'btn_auto':
    case 'btn_request_auto':
      await sendTelegramMessage(
        chatId,
        `<b>${t.autoRequestTitle}</b>\n\n` +
        `${t.hello(userName)}\n\n` +
        `${t.pleaseProvide}:\n\n` +
        `1️⃣ ${t.makeModel} (${lang === 'uk' ? 'наприклад' : 'e.g.'}: ${t.autoExample})\n` +
        `2️⃣ ${t.whatNeed} (${lang === 'uk' ? 'наприклад' : 'e.g.'}: ${t.exhaustExample})\n` +
        `3️⃣ ${t.budgetOptional}\n\n` +
        `${t.writeOneMessage}`
      );
      break;

    case 'btn_moto':
    case 'btn_request_moto':
      await sendTelegramMessage(
        chatId,
        `<b>${t.motoRequestTitle}</b>\n\n` +
        `${t.hello(userName)}\n\n` +
        `${t.pleaseProvide}:\n\n` +
        `1️⃣ ${t.makeModel} (${lang === 'uk' ? 'наприклад' : 'e.g.'}: ${t.motoExample})\n` +
        `2️⃣ ${t.whatNeed} (${lang === 'uk' ? 'наприклад' : 'e.g.'}: ${t.motoExhaustExample})\n` +
        `3️⃣ ${t.budgetOptional}\n\n` +
        `${t.writeOneMessage}`
      );
      break;

    case 'btn_back':
    case 'btn_back_main':
      await sendMainMenu(chatId, userName, lang);
      break;

    default:
      await sendTelegramMessage(chatId, lang === 'uk' 
        ? 'Невідома команда. Використайте /start для перегляду меню.' 
        : 'Unknown command. Use /start to view the menu.'
      );
  }
}

// GET endpoint для перевірки статусу веб-хука
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    webhook: 'ready',
    bot_configured: !!TELEGRAM_BOT_TOKEN,
    chat_configured: !!TELEGRAM_CHAT_ID,
    timestamp: new Date().toISOString()
  });
}

export const runtime = 'nodejs';
