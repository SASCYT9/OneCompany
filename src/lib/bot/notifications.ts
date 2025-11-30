// Notification functions for admins
import { getBot } from './bot';
import { getAllAdmins, prisma } from './storage';

// Notify all admins about new message
export async function notifyAdminsNewMessage(
  messageId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    message: string;
    category: string;
    telegramId?: number;
    username?: string;
  }
) {
  try {
    const bot = getBot();
    const admins = await getAllAdmins();
    
    const categoryEmoji = {
      auto: '🚗',
      moto: '🏍️',
      general: '📦',
    }[data.category] || '📦';
    
    const text = `
📬 <b>Нове повідомлення!</b>

${categoryEmoji} <b>Категорія:</b> ${data.category}
👤 <b>Ім'я:</b> ${escapeHtml(data.name)}
${data.email ? `📧 <b>Email:</b> ${escapeHtml(data.email)}` : ''}
${data.phone ? `📱 <b>Телефон:</b> ${escapeHtml(data.phone)}` : ''}
${data.username ? `💬 <b>Telegram:</b> @${escapeHtml(data.username)}` : ''}

💬 <b>Повідомлення:</b>
${escapeHtml(data.message)}
    `.trim();
    
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.ua';
    
    for (const admin of admins) {
      try {
        await bot.api.sendMessage(admin.telegramId.toString(), text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '👁️ Переглянути',
                  web_app: { url: `${siteUrl}/telegram-app/admin/message/${messageId}` }
                },
                {
                  text: '✉️ Відповісти',
                  callback_data: `reply:${messageId}`
                }
              ],
              [
                {
                  text: '✅ Позначити оброблено',
                  callback_data: `status:${messageId}:COMPLETED`
                }
              ]
            ]
          }
        });
      } catch (error) {
        console.error(`Failed to notify admin ${admin.telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to notify admins:', error);
  }
}

// Notify user about reply
export async function notifyUserReply(
  telegramId: string | number,
  replyText: string,
  originalMessage?: string
) {
  try {
    const bot = getBot();
    
    const text = `
📨 <b>Відповідь від OneCompany</b>

${originalMessage ? `<i>Ваше запитання:</i>\n${escapeHtml(originalMessage.slice(0, 100))}${originalMessage.length > 100 ? '...' : ''}\n\n` : ''}
<b>Відповідь:</b>
${escapeHtml(replyText)}

—
<i>Якщо у вас є додаткові питання, напишіть нам!</i>
    `.trim();
    
    await bot.api.sendMessage(telegramId.toString(), text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✉️ Написати', callback_data: 'new_message' },
          { text: '🌐 Сайт', url: 'https://onecompany.ua' }
        ]]
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to notify user:', error);
    return false;
  }
}

// Send message status update to admins
export async function notifyAdminsStatusChange(
  messageId: string,
  newStatus: string,
  changedBy?: string
) {
  try {
    const bot = getBot();
    const admins = await getAllAdmins();
    
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { userName: true, category: true },
    });
    
    if (!message) return;
    
    const statusEmoji = {
      NEW: '🆕',
      IN_PROGRESS: '⏳',
      COMPLETED: '✅',
      ARCHIVED: '📁',
    }[newStatus] || '📋';
    
    const text = `
${statusEmoji} <b>Статус змінено</b>

📋 <b>Від:</b> ${escapeHtml(message.userName)}
📂 <b>Категорія:</b> ${message.category}
📊 <b>Новий статус:</b> ${newStatus}
${changedBy ? `👤 <b>Змінив:</b> ${escapeHtml(changedBy)}` : ''}
    `.trim();
    
    for (const admin of admins) {
      try {
        await bot.api.sendMessage(admin.telegramId.toString(), text, {
          parse_mode: 'HTML',
        });
      } catch (error) {
        // Silently ignore - admin might have blocked the bot
      }
    }
  } catch (error) {
    console.error('Failed to notify status change:', error);
  }
}

// Escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
