// Callback query handlers
import type { Bot } from 'grammy';
import type { Status } from '@prisma/client';
import type { BotContext } from '../types';
import { mainMenu } from '../menus';
import { prisma } from '../storage';
import { notifyUserReply, notifyAdminsStatusChange } from '../notifications';

export function registerCallbacks(bot: Bot<BotContext>) {
  // Status change callback
  bot.callbackQuery(/^status:(.+):(.+)$/, async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.answerCallbackQuery(ctx.t('noAccess'));
      return;
    }
    
    const match = ctx.callbackQuery.data.match(/^status:(.+):(.+)$/);
    if (!match) {
      await ctx.answerCallbackQuery('❌ Помилка');
      return;
    }
    
    const [, messageId, newStatus] = match;
    
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: { status: newStatus as Status },
      });
      
      await ctx.answerCallbackQuery(`✅ Статус змінено на ${newStatus}`);
      
      // Update message text to show it's been processed
      await ctx.editMessageReplyMarkup({
        reply_markup: {
          inline_keyboard: [[
            { text: `✅ ${newStatus}`, callback_data: 'noop' }
          ]]
        }
      });
      
      // Notify other admins
      await notifyAdminsStatusChange(messageId, newStatus, ctx.from?.first_name);
      
    } catch (error) {
      console.error('Status update error:', error);
      await ctx.answerCallbackQuery('❌ Помилка оновлення');
    }
  });
  
  // Reply callback - shows reply interface
  bot.callbackQuery(/^reply:(.+)$/, async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.answerCallbackQuery(ctx.t('noAccess'));
      return;
    }
    
    const match = ctx.callbackQuery.data.match(/^reply:(.+)$/);
    if (!match) {
      await ctx.answerCallbackQuery('❌ Помилка');
      return;
    }
    
    const [, messageId] = match;
    
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });
      
      if (!message) {
        await ctx.answerCallbackQuery('❌ Повідомлення не знайдено');
        return;
      }
      
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.ua';
      
      await ctx.answerCallbackQuery();
      await ctx.reply(`✉️ Відповідь на повідомлення від ${message.userName}:`, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📱 Відповісти через Web App',
              web_app: { url: `${siteUrl}/telegram-app/admin/reply/${messageId}` }
            }
          ]]
        }
      });
      
    } catch (error) {
      console.error('Reply error:', error);
      await ctx.answerCallbackQuery('❌ Помилка');
    }
  });
  
  // Quick reply with template
  bot.callbackQuery(/^quick_reply:(.+):(.+)$/, async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.answerCallbackQuery(ctx.t('noAccess'));
      return;
    }
    
    const match = ctx.callbackQuery.data.match(/^quick_reply:(.+):(.+)$/);
    if (!match) {
      await ctx.answerCallbackQuery('❌ Помилка');
      return;
    }
    
    const [, messageId, templateType] = match;
    
    const templates: Record<string, string> = {
      received: 'Дякуємо за ваше звернення! Ми отримали ваш запит і зв\'яжемося з вами найближчим часом.',
      processing: 'Ваш запит обробляється. Наш менеджер зв\'яжеться з вами протягом робочого дня.',
      completed: 'Ваш запит оброблено. Дякуємо, що обрали OneCompany!',
    };
    
    const replyText = templates[templateType];
    if (!replyText) {
      await ctx.answerCallbackQuery('❌ Невідомий шаблон');
      return;
    }
    
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });
      
      if (!message) {
        await ctx.answerCallbackQuery('❌ Повідомлення не знайдено');
        return;
      }
      
      // Get telegram ID from metadata
      const metadata = message.metadata as { telegramId?: string } | null;
      const telegramId = metadata?.telegramId;
      
      if (telegramId) {
        // Send reply to user via Telegram
        await notifyUserReply(telegramId, replyText, message.messageText);
      }
      
      // Save reply to database
      await prisma.reply.create({
        data: {
          messageId: message.id,
          replyText: replyText,
        },
      });
      
      // Update message status
      await prisma.message.update({
        where: { id: messageId },
        data: { status: 'REPLIED' },
      });
      
      await ctx.answerCallbackQuery('✅ Відповідь надіслано');
      
    } catch (error) {
      console.error('Quick reply error:', error);
      await ctx.answerCallbackQuery('❌ Помилка надсилання');
    }
  });
  
  // New message callback - starts contact conversation
  bot.callbackQuery('new_message', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.lastCategory = 'general';
    await ctx.conversation.enter('contact');
  });
  
  // Noop callback - does nothing (for disabled buttons)
  bot.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });
  
  // View message details callback
  bot.callbackQuery(/^view:(.+)$/, async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.answerCallbackQuery(ctx.t('noAccess'));
      return;
    }
    
    const match = ctx.callbackQuery.data.match(/^view:(.+)$/);
    if (!match) return;
    
    const [, messageId] = match;
    
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { replies: true },
      });
      
      if (!message) {
        await ctx.answerCallbackQuery('❌ Повідомлення не знайдено');
        return;
      }
      
      const metadata = message.metadata as Record<string, unknown> | null;
      
      const detailText = `
📋 <b>Деталі повідомлення</b>

👤 <b>Ім'я:</b> ${message.userName}
${message.userEmail ? `📧 <b>Email:</b> ${message.userEmail}` : ''}
${metadata?.phone ? `📱 <b>Телефон:</b> ${metadata.phone}` : ''}
${metadata?.username ? `💬 <b>Telegram:</b> @${metadata.username}` : ''}

📂 <b>Категорія:</b> ${message.category}
📊 <b>Статус:</b> ${message.status}
📅 <b>Дата:</b> ${message.createdAt.toLocaleString('uk-UA')}

💬 <b>Повідомлення:</b>
${message.messageText}

${message.replies.length > 0 ? `\n📨 <b>Відповіді (${message.replies.length}):</b>\n${message.replies.map(r => `• ${r.replyText.slice(0, 50)}...`).join('\n')}` : ''}
      `.trim();
      
      await ctx.answerCallbackQuery();
      await ctx.reply(detailText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✉️ Відповісти', callback_data: `reply:${messageId}` },
              { text: '✅ Завершити', callback_data: `status:${messageId}:COMPLETED` },
            ],
            [
              { text: '📁 Архів', callback_data: `status:${messageId}:ARCHIVED` },
            ]
          ]
        }
      });
      
    } catch (error) {
      console.error('View message error:', error);
      await ctx.answerCallbackQuery('❌ Помилка');
    }
  });
  
  // Back to main menu callback
  bot.callbackQuery('main_menu', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(ctx.t('mainMenu'), { 
      reply_markup: mainMenu,
      parse_mode: 'HTML',
    });
  });
  
  // Analytics period change callback
  bot.callbackQuery(/^analytics:(.+)$/, async (ctx) => {
    if (!ctx.isAdmin) {
      await ctx.answerCallbackQuery(ctx.t('noAccess'));
      return;
    }
    
    const match = ctx.callbackQuery.data.match(/^analytics:(.+)$/);
    if (!match) return;
    
    const [, action] = match;
    
    if (action === 'export') {
      // Generate export link
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.ua';
      const secret = process.env.ADMIN_SECRET || '';
      
      await ctx.answerCallbackQuery();
      await ctx.reply(`📊 <b>Експорт аналітики</b>\n\nAPI endpoint:\n<code>${siteUrl}/api/telegram/analytics?secret=${secret}</code>`, {
        parse_mode: 'HTML',
      });
      return;
    }
    
    const period = action as 'day' | 'week' | 'month';
    
    await ctx.answerCallbackQuery('⏳ Завантаження...');
    
    const { getBotStats, getConversionStats, getResponseTimeStats, formatStatsMessage } = 
      await import('../analytics');
    
    const [stats, conversion, responseTime] = await Promise.all([
      getBotStats(period),
      getConversionStats(),
      getResponseTimeStats(),
    ]);
    
    const text = formatStatsMessage(stats, conversion, responseTime);
    
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: period === 'day' ? '📅 День ✓' : '📅 День', callback_data: 'analytics:day' },
              { text: period === 'week' ? '📆 Тиждень ✓' : '📆 Тиждень', callback_data: 'analytics:week' },
              { text: period === 'month' ? '🗓️ Місяць ✓' : '🗓️ Місяць', callback_data: 'analytics:month' },
            ],
            [
              { text: '📊 Експорт', callback_data: 'analytics:export' },
            ],
          ],
        },
      });
    } catch {
      // Message might be too similar
      await ctx.answerCallbackQuery('Дані не змінились');
    }
  });
  
  // Partnership type selection callback (for partnership conversation)
  bot.callbackQuery(/^ptype:(.+)$/, async (ctx) => {
    // This is handled in the partnership conversation
    // Just acknowledge it here in case conversation is not active
    await ctx.answerCallbackQuery();
  });
}
