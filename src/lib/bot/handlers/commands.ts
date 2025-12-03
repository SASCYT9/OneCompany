// Command handlers
import type { Bot } from 'grammy';
import type { BotContext } from '../types';
import { mainMenu, languageMenu, adminMenu, catalogMenu } from '../menus';

// Web App URL
const WEBAPP_URL = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/ua/tg`
  : 'https://one-company.vercel.app/ua/tg';

export function registerCommands(bot: Bot<BotContext>) {
  // /start command - opens Web App
  bot.command('start', async (ctx) => {
    // Check for deeplink (e.g., /start admin)
    const payload = ctx.match;
    
    if (payload === 'admin' && ctx.isAdmin) {
      await ctx.reply(ctx.t('adminPanel'), { 
        reply_markup: adminMenu,
        parse_mode: 'HTML',
      });
      return;
    }
    
    if (payload === 'partnership') {
      await ctx.conversation.enter('partnership');
      return;
    }
    
    if (payload === 'catalog') {
      await ctx.reply(ctx.t('catalogIntro'), {
        parse_mode: 'HTML',
        reply_markup: catalogMenu,
      });
      return;
    }
    
    // Main welcome with Web App button
    const welcomeText = `
<b>OneCompany</b> · B2B Wholesale

Premium importer для СТО, детейлінг-студій та тюнінг-ательє.

• 18 років на ринку
• 200+ performance брендів
• VIP expert programs

Натисніть кнопку нижче 👇
    `.trim();
    
    await ctx.reply(welcomeText, { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Відкрити OneCompany',
            web_app: { url: WEBAPP_URL }
          }],
          [
            { text: 'Сайт', url: 'https://one-company.vercel.app/ua' }
          ]
        ]
      }
    });
  });
  
  // /help command
  bot.command('help', async (ctx) => {
    const helpText = `
<b>📚 Допомога</b>

<b>Команди:</b>
/start - Головне меню
/language - Змінити мову
/contact - Надіслати запит
/auto - Продукти для авто
/moto - Продукти для мото
/partnership - Стати партнером
/catalog - Каталог брендів
${ctx.isAdmin ? '/admin - Панель адміністратора\n/admins - Список адмінів\n/addadmin - Додати адміна\n/stats - Статистика' : ''}

<b>Що ми пропонуємо:</b>
🚗 Впускні системи, вихлопи, охолодження для авто
🏍️ Шоломи, захист, аксесуари для мото
🤝 Партнерська програма для СТО, дилерів, тюнінг-ательє

<b>Контакти:</b>
🌐 onecompany.global
📧 info@onecompany.global
    `.trim();
    
    await ctx.reply(helpText, { 
      parse_mode: 'HTML',
      reply_markup: mainMenu,
    });
  });
  
  // /language command
  bot.command('language', async (ctx) => {
    await ctx.reply(ctx.t('selectLanguage'), { reply_markup: languageMenu });
  });
  
  // /contact command - starts contact conversation
  bot.command('contact', async (ctx) => {
    ctx.session.lastCategory = 'general';
    await ctx.conversation.enter('contact');
  });
  
  // /auto command
  bot.command('auto', async (ctx) => {
    ctx.session.lastCategory = 'auto';
    await ctx.conversation.enter('contact');
  });
  
  // /moto command
  bot.command('moto', async (ctx) => {
    ctx.session.lastCategory = 'moto';
    await ctx.conversation.enter('contact');
  });
  
  // /partnership command - starts partnership conversation
  bot.command('partnership', async (ctx) => {
    await ctx.conversation.enter('partnership');
  });
  
  // /catalog command - shows catalog menu
  bot.command('catalog', async (ctx) => {
    await ctx.reply(ctx.t('catalogIntro'), {
      parse_mode: 'HTML',
      reply_markup: catalogMenu,
    });
  });
  
  // /admin command
  bot.command('admin', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    await ctx.reply(ctx.t('adminPanel'), { 
      reply_markup: adminMenu,
      parse_mode: 'HTML',
    });
  });
  
  // /cancel command - exits current conversation
  bot.command('cancel', async (ctx) => {
    await ctx.conversation.exit('contact');
    await ctx.reply('❌ Операцію скасовано.', { reply_markup: mainMenu });
  });
  
  // /skip command - used in conversations
  bot.command('skip', async (ctx) => {
    // This is handled within conversations
    await ctx.reply('⏭️ Пропущено');
  });
  
  // /menu command - shows main menu
  bot.command('menu', async (ctx) => {
    await ctx.reply(ctx.t('mainMenu'), { 
      reply_markup: mainMenu,
      parse_mode: 'HTML',
    });
  });
  
  // /webapp command - opens web app
  bot.command('webapp', async (ctx) => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
    
    await ctx.reply('🌐 Відкрийте наш сайт:', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🌐 Відкрити сайт',
            web_app: { url: siteUrl }
          }
        ]]
      }
    });
  });
  
  // /addadmin command (superadmin only)
  bot.command('addadmin', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    // Check if replying to a message
    const replyTo = ctx.message?.reply_to_message;
    if (replyTo?.from) {
      const targetId = BigInt(replyTo.from.id);
      const targetName = replyTo.from.first_name || replyTo.from.username || 'Admin';
      const targetUsername = replyTo.from.username;
      
      const { addAdmin } = await import('../storage');
      await addAdmin(targetId, targetName, { username: targetUsername });
      
      await ctx.reply(`✅ <b>${targetName}</b> тепер адміністратор!`, { parse_mode: 'HTML' });
      return;
    }
    
    // Check command argument: /addadmin 123456789
    const arg = ctx.match?.toString().trim();
    if (arg && /^\d+$/.test(arg)) {
      const targetId = BigInt(arg);
      const { addAdmin } = await import('../storage');
      await addAdmin(targetId, `Admin ${arg}`);
      
      await ctx.reply(`✅ Користувач <code>${arg}</code> тепер адміністратор!`, { parse_mode: 'HTML' });
      return;
    }
    
    await ctx.reply(`
📋 <b>Як додати адміна:</b>

1️⃣ Перешліть повідомлення від користувача і дайте відповідь командою /addadmin

2️⃣ Або вкажіть Telegram ID:
<code>/addadmin 123456789</code>
    `.trim(), { parse_mode: 'HTML' });
  });
  
  // /removeadmin command
  bot.command('removeadmin', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    const arg = ctx.match?.toString().trim();
    if (arg && /^\d+$/.test(arg)) {
      const { prisma } = await import('../storage');
      await prisma.telegramAdmin.updateMany({
        where: { telegramId: BigInt(arg) },
        data: { isActive: false },
      });
      
      await ctx.reply(`✅ Адміна <code>${arg}</code> видалено`, { parse_mode: 'HTML' });
      return;
    }
    
    await ctx.reply('Використання: <code>/removeadmin 123456789</code>', { parse_mode: 'HTML' });
  });
  
  // /admins command - list all admins
  bot.command('admins', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    const { getAllAdmins } = await import('../storage');
    const admins = await getAllAdmins();
    
    if (admins.length === 0) {
      await ctx.reply('📋 Немає адміністраторів');
      return;
    }
    
    const list = admins.map((a, i) => 
      `${i + 1}. <b>${a.name}</b>${a.username ? ` (@${a.username})` : ''}
   ID: <code>${a.telegramId}</code>`
    ).join('\n\n');
    
    await ctx.reply(`👥 <b>Адміністратори:</b>\n\n${list}`, { parse_mode: 'HTML' });
  });
  
  // /stats command (admin only) - basic stats
  bot.command('stats', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    // Import prisma here to avoid circular imports
    const { prisma } = await import('../storage');
    
    const [totalMessages, newMessages, completedMessages] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { status: 'NEW' } }),
      prisma.message.count({ where: { status: 'COMPLETED' } }),
    ]);
    
    const statsText = `
📊 <b>Статистика</b>

📬 <b>Повідомлення:</b>
• Всього: ${totalMessages}
• Нових: ${newMessages}
• Оброблено: ${completedMessages}

💡 Для детальної аналітики: /analytics
    `.trim();
    
    await ctx.reply(statsText, { parse_mode: 'HTML' });
  });
  
  // /analytics command (admin only) - full analytics
  bot.command('analytics', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    // Parse period from command
    const arg = ctx.match?.toString().trim().toLowerCase();
    const period = (['day', 'week', 'month', 'all'].includes(arg || '') 
      ? arg 
      : 'week') as 'day' | 'week' | 'month' | 'all';
    
    await ctx.reply('⏳ Генерую звіт...');
    
    const { getBotStats, getConversionStats, getResponseTimeStats, formatStatsMessage } = 
      await import('../analytics');
    
    const [stats, conversion, responseTime] = await Promise.all([
      getBotStats(period),
      getConversionStats(),
      getResponseTimeStats(),
    ]);
    
    const text = formatStatsMessage(stats, conversion, responseTime);
    
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📅 День', callback_data: 'analytics:day' },
            { text: '📆 Тиждень', callback_data: 'analytics:week' },
            { text: '🗓️ Місяць', callback_data: 'analytics:month' },
          ],
          [
            { text: '📊 Експорт', callback_data: 'analytics:export' },
          ],
        ],
      },
    });
  });
  
  // /digest command - send daily digest now
  bot.command('digest', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    await ctx.reply('📤 Відправляю денний звіт...');
    
    const { sendDailyDigest } = await import('../reminders');
    const result = await sendDailyDigest();
    
    if (result.sent) {
      await ctx.reply(`✅ Звіт надіслано: ${result.sentTo?.join(', ')}`);
    } else {
      await ctx.reply(`ℹ️ ${result.reason}`);
    }
  });
  
  // /remind command - send reminders now
  bot.command('remind', async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.reply(ctx.t('noAccess'));
      return;
    }
    
    await ctx.reply('📤 Перевіряю невідповідані запити...');
    
    const { sendAdminReminders, getMessagesNeedingFollowUp } = await import('../reminders');
    const needFollowUp = await getMessagesNeedingFollowUp();
    
    const total = needFollowUp.urgentNewMessages.length + 
                  needFollowUp.staleInProgressMessages.length + 
                  needFollowUp.oldPartnershipRequests.length;
    
    if (total === 0) {
      await ctx.reply('✅ Всі запити оброблені вчасно!');
      return;
    }
    
    const result = await sendAdminReminders();
    
    if (result.sent) {
      await ctx.reply(`✅ Нагадування надіслано: ${result.sentTo?.join(', ')}`);
    } else {
      await ctx.reply(`ℹ️ ${result.reason}`);
    }
  });
}
