// Interactive Menus with @grammyjs/menu
import { Menu } from '@grammyjs/menu';
import type { BotContext } from './types';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';

// Main menu - redesigned with more options
export const mainMenu = new Menu<BotContext>('main-menu')
  // Products row
  .text(
    (ctx) => ctx.t('autoProducts'),
    async (ctx) => {
      ctx.session.lastCategory = 'auto';
      await ctx.conversation.enter('contact');
    }
  )
  .text(
    (ctx) => ctx.t('motoProducts'),
    async (ctx) => {
      ctx.session.lastCategory = 'moto';
      await ctx.conversation.enter('contact');
    }
  )
  .row()
  // Partnership & Catalog row
  .text(
    (ctx) => ctx.t('partnership'),
    async (ctx) => {
      await ctx.conversation.enter('partnership');
    }
  )
  .text(
    (ctx) => ctx.t('catalog'),
    async (ctx) => {
      await ctx.reply(ctx.t('catalogIntro'), {
        parse_mode: 'HTML',
        reply_markup: catalogMenu,
      });
    }
  )
  .row()
  // General request
  .text(
    (ctx) => ctx.t('sendRequest'),
    async (ctx) => {
      ctx.session.lastCategory = 'general';
      await ctx.conversation.enter('contact');
    }
  )
  .row()
  // Language & Admin
  .text(
    '🌐 Language',
    async (ctx) => {
      await ctx.reply(ctx.t('selectLanguage'), { reply_markup: languageMenu });
    }
  )
  .text(
    (ctx) => ctx.isAdmin ? '🔐 Admin' : '',
    async (ctx) => {
      if (ctx.isAdmin) {
        await ctx.reply(ctx.t('adminPanel'), {
          parse_mode: 'HTML',
          reply_markup: adminMenu,
        });
      }
    }
  )
  .row()
  // Website button
  .webApp(
    '🌐 Відкрити сайт',
    siteUrl
  );

// Language selection menu
export const languageMenu = new Menu<BotContext>('language-menu')
  .text('🇺🇦 Українська', async (ctx) => {
    ctx.session.language = 'uk';
    await ctx.editMessageText('✅ Мову змінено на українську');
    await ctx.reply(ctx.t('welcome'), { parse_mode: 'HTML', reply_markup: mainMenu });
  })
  .text('🇬🇧 English', async (ctx) => {
    ctx.session.language = 'en';
    await ctx.editMessageText('✅ Language changed to English');
    await ctx.reply(ctx.t('welcome'), { parse_mode: 'HTML', reply_markup: mainMenu });
  })
  .text('🇷🇺 Русский', async (ctx) => {
    ctx.session.language = 'ru';
    await ctx.editMessageText('✅ Язык изменён на русский');
    await ctx.reply(ctx.t('welcome'), { parse_mode: 'HTML', reply_markup: mainMenu });
  })
  .row()
  .text(
    (ctx) => ctx.t('back'),
    async (ctx) => {
      await ctx.deleteMessage();
    }
  );

// Category selection menu (for general requests)
export const categoryMenu = new Menu<BotContext>('category-menu')
  .text(
    (ctx) => ctx.t('categories.auto'),
    async (ctx) => {
      ctx.session.lastCategory = 'auto';
      await ctx.deleteMessage();
      await ctx.conversation.enter('contact');
    }
  )
  .text(
    (ctx) => ctx.t('categories.moto'),
    async (ctx) => {
      ctx.session.lastCategory = 'moto';
      await ctx.deleteMessage();
      await ctx.conversation.enter('contact');
    }
  )
  .row()
  .text(
    (ctx) => ctx.t('categories.general'),
    async (ctx) => {
      ctx.session.lastCategory = 'general';
      await ctx.deleteMessage();
      await ctx.conversation.enter('contact');
    }
  )
  .text(
    (ctx) => ctx.t('categories.partnership'),
    async (ctx) => {
      await ctx.deleteMessage();
      await ctx.conversation.enter('partnership');
    }
  )
  .row()
  .text(
    (ctx) => ctx.t('back'),
    async (ctx) => {
      await ctx.deleteMessage();
    }
  );

// Catalog menu - browse brands
export const catalogMenu = new Menu<BotContext>('catalog-menu')
  .text(
    (ctx) => ctx.t('autoBrands'),
    async (ctx) => {
      await ctx.reply(`
🚗 <b>Популярні авто бренди:</b>

<b>Впускні системи:</b>
• Eventuri — Carbon air intakes
• BMC — Performance filters
• K&N — Filters & intakes

<b>Вихлопні системи:</b>
• Akrapovič — Titanium exhausts
• Remus — Sport exhausts  
• Eisenmann — Racing systems

<b>Підвіска:</b>
• KW — Coilovers & dampers
• Bilstein — OEM & sport
• Öhlins — Racing suspension

<b>Диски:</b>
• BBS — Forged wheels
• HRE — Custom forged
• Vossen — Luxury wheels

📍 Для замовлення натисніть /auto
      `.trim(), { parse_mode: 'HTML' });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t('motoBrands'),
    async (ctx) => {
      await ctx.reply(`
🏍️ <b>Популярні мото бренди:</b>

<b>Вихлопні системи:</b>
• Akrapovič — MotoGP partner
• SC-Project — Racing exhausts
• Arrow — Street & race

<b>Захист:</b>
• Alpinestars — Full protection
• Dainese — D-air technology
• Rev'It — Premium gear

<b>Шоломи:</b>
• AGV — MotoGP heritage
• Shoei — Japanese precision
• Arai — Handcrafted safety

<b>Підвіска:</b>
• Öhlins — Racing suspension
• Mupo — Italian engineering
• WP — KTM partner

📍 Для замовлення натисніть /moto
      `.trim(), { parse_mode: 'HTML' });
    }
  )
  .row()
  .webApp('🔍 Пошук на сайті', `${siteUrl}/search`)
  .row()
  .text(
    (ctx) => ctx.t('back'),
    async (ctx) => {
      await ctx.deleteMessage();
    }
  );

// Admin menu - enhanced
export const adminMenu = new Menu<BotContext>('admin-menu')
  .text(
    (ctx) => `📬 Нові (${ctx.session.isAdmin ? '?' : '0'})`,
    async (ctx) => {
      if (!ctx.isAdmin) {
        await ctx.answerCallbackQuery(ctx.t('noAccess'));
        return;
      }
      await ctx.reply('📬 Нові повідомлення:', {
        reply_markup: {
          inline_keyboard: [[
            {
              // The Telegram mini panel was removed (2026-05); messages live in the admin.
              text: '🖥 Відкрити в адмінці',
              url: `${siteUrl}/admin/messages`
            }
          ]]
        }
      });
    }
  )
  .text(
    '🤝 Партнери',
    async (ctx) => {
      if (!ctx.isAdmin) {
        await ctx.answerCallbackQuery(ctx.t('noAccess'));
        return;
      }
      await ctx.reply('🤝 Заявки на партнерство:', {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🖥 Відкрити в адмінці',
              url: `${siteUrl}/admin/messages`
            }
          ]]
        }
      });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t('allMessages'),
    async (ctx) => {
      if (!ctx.isAdmin) {
        await ctx.answerCallbackQuery(ctx.t('noAccess'));
        return;
      }
      await ctx.reply('📋 Всі повідомлення:', {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🖥 Відкрити в адмінці',
              url: `${siteUrl}/admin/messages`
            }
          ]]
        }
      });
    }
  )
  .row()
  .text(
    '📊 Статистика',
    async (ctx) => {
      if (!ctx.isAdmin) {
        await ctx.answerCallbackQuery(ctx.t('noAccess'));
        return;
      }
      // Get stats from database
      const { prisma } = await import('./storage');
      const [total, newCount, partnership, today] = await Promise.all([
        prisma.message.count(),
        prisma.message.count({ where: { status: 'NEW' } }),
        prisma.message.count({ where: { category: 'PARTNERSHIP' } }),
        prisma.message.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);
      
      await ctx.reply(`
📊 <b>Статистика</b>

📬 <b>Всього повідомлень:</b> ${total}
🆕 <b>Нових:</b> ${newCount}
🤝 <b>Заявок на партнерство:</b> ${partnership}
📅 <b>Сьогодні:</b> ${today}
      `.trim(), { parse_mode: 'HTML' });
    }
  )
  .row()
  .text(
    (ctx) => ctx.t('back'),
    async (ctx) => {
      await ctx.deleteMessage();
      await ctx.reply(ctx.t('mainMenu'), { reply_markup: mainMenu });
    }
  );
