// Reminders system for follow-up messages
import { prisma } from './storage';
import { getBot } from './bot';

// Reminder types
export type ReminderType = 
  | 'follow_up_new'        // Follow up on NEW messages after X time
  | 'follow_up_in_progress' // Follow up on IN_PROGRESS messages
  | 'inactive_user'         // Re-engage inactive users
  | 'partnership_follow_up' // Follow up partnership requests
  | 'scheduled'             // Custom scheduled message
  | 'daily_digest';         // Daily summary for admins

/* eslint-disable @typescript-eslint/no-unused-vars */
interface Reminder {
  id: string;
  type: ReminderType;
  targetId: string; // Message ID or User Telegram ID
  scheduledAt: Date;
  content?: string;
  metadata?: Record<string, unknown>;
}

// Check for messages that need follow-up
export async function getMessagesNeedingFollowUp() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  // Get messages that haven't been replied to
  const [
    urgentNewMessages,
    staleInProgressMessages,
    oldPartnershipRequests,
  ] = await Promise.all([
    // NEW messages older than 1 hour without reply
    prisma.message.findMany({
      where: {
        status: 'NEW',
        createdAt: { lte: oneHourAgo },
        replies: { none: {} },
      },
      orderBy: { createdAt: 'asc' },
    }),
    
    // IN_PROGRESS messages older than 1 day without update
    prisma.message.findMany({
      where: {
        status: 'IN_PROGRESS',
        updatedAt: { lte: oneDayAgo },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    
    // Partnership requests older than 3 days still NEW
    prisma.message.findMany({
      where: {
        category: 'PARTNERSHIP',
        status: 'NEW',
        createdAt: { lte: threeDaysAgo },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  
  return {
    urgentNewMessages,
    staleInProgressMessages,
    oldPartnershipRequests,
  };
}

// Send admin reminders
export async function sendAdminReminders() {
  const { getAllAdmins } = await import('./storage');
  const needFollowUp = await getMessagesNeedingFollowUp();
  
  const urgent = needFollowUp.urgentNewMessages.length;
  const stale = needFollowUp.staleInProgressMessages.length;
  const partnerships = needFollowUp.oldPartnershipRequests.length;
  
  if (urgent === 0 && stale === 0 && partnerships === 0) {
    return { sent: false, reason: 'No reminders needed' };
  }
  
  const admins = await getAllAdmins();
  const bot = getBot();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  
  let text = `⏰ <b>Нагадування</b>\n\n`;
  
  if (urgent > 0) {
    text += `🔴 <b>${urgent}</b> нових запитів чекають більше 1 години\n`;
  }
  
  if (stale > 0) {
    text += `🟡 <b>${stale}</b> запитів "В роботі" без оновлень >24г\n`;
  }
  
  if (partnerships > 0) {
    text += `🤝 <b>${partnerships}</b> партнерських заявок чекають >3 дні\n`;
  }
  
  text += `\n<i>Натисніть кнопку для перегляду</i>`;
  
  const sentTo: string[] = [];
  
  for (const admin of admins) {
    try {
      await bot.api.sendMessage(admin.telegramId.toString(), text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `📬 Нові (${urgent})`,
                url: `${siteUrl}/admin/messages`,
              },
            ],
            [
              {
                text: `🤝 Партнери (${partnerships})`,
                url: `${siteUrl}/admin/messages`,
              },
            ],
          ],
        },
      });
      sentTo.push(admin.name);
    } catch (error) {
      console.error(`Failed to send reminder to ${admin.name}:`, error);
    }
  }
  
  return { sent: true, sentTo };
}

// Send daily digest to admins
export async function sendDailyDigest() {
  const { getAllAdmins } = await import('./storage');
  const { getBotStats, getResponseTimeStats, formatStatsMessage } = await import('./analytics');
  
  const stats = await getBotStats('day');
  const responseTime = await getResponseTimeStats();
  
  // Skip if no activity
  if (stats.totalMessages === 0 && stats.newUsersToday === 0) {
    return { sent: false, reason: 'No activity today' };
  }
  
  const admins = await getAllAdmins();
  const bot = getBot();
  
  const text = `📅 <b>Денний звіт</b>\n\n${formatStatsMessage(stats, undefined, responseTime)}`;
  
  const sentTo: string[] = [];
  
  for (const admin of admins) {
    try {
      await bot.api.sendMessage(admin.telegramId.toString(), text, {
        parse_mode: 'HTML',
      });
      sentTo.push(admin.name);
    } catch (error) {
      console.error(`Failed to send digest to ${admin.name}:`, error);
    }
  }
  
  return { sent: true, sentTo };
}

// Send follow-up to user about their message
export async function sendUserFollowUp(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });
  
  if (!message) {
    return { sent: false, reason: 'Message not found' };
  }
  
  const metadata = message.metadata as Record<string, unknown> | null;
  const telegramId = metadata?.telegramId as string | undefined;
  
  if (!telegramId) {
    return { sent: false, reason: 'No Telegram ID in message' };
  }
  
  const bot = getBot();
  
  const statusMessages: Record<string, string> = {
    NEW: `👋 Вітаємо! Ваш запит отримано і буде оброблено найближчим часом. Дякуємо за терпіння!`,
    IN_PROGRESS: `⏳ Ваш запит зараз обробляється нашим менеджером. Очікуйте відповідь!`,
    COMPLETED: `✅ Ваш запит оброблено. Якщо у вас є додаткові питання - напишіть нам!`,
  };
  
  const text = statusMessages[message.status] || statusMessages['NEW'];
  
  try {
    await bot.api.sendMessage(telegramId, text, {
      reply_markup: {
        inline_keyboard: [[
          { text: '✉️ Написати ще', callback_data: 'new_message' },
          { text: '🌐 Сайт', url: 'https://onecompany.global' },
        ]],
      },
    });
    
    return { sent: true, to: telegramId };
  } catch (error) {
    console.error('Failed to send follow-up:', error);
    return { sent: false, reason: String(error) };
  }
}

// Get inactive users (haven't interacted in X days)
export async function getInactiveUsers(daysInactive: number = 30) {
  const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);
  
  return prisma.telegramUser.findMany({
    where: {
      lastActiveAt: { lte: cutoffDate },
      isBlocked: false,
    },
    orderBy: { lastActiveAt: 'asc' },
    take: 100,
  });
}

// Send re-engagement message to inactive users
export async function sendReEngagementCampaign(customMessage?: string) {
  const inactiveUsers = await getInactiveUsers(30);
  const bot = getBot();
  
  const defaultMessage = `
👋 <b>Давно не бачились!</b>

У нас багато нових надходжень:
🚗 Оновлений каталог для авто
🏍️ Нові бренди для мото
🤝 Спеціальні умови для партнерів

Напишіть /start щоб переглянути!
  `.trim();
  
  const text = customMessage || defaultMessage;
  
  let sent = 0;
  let failed = 0;
  const blocked: bigint[] = [];
  
  for (const user of inactiveUsers) {
    try {
      await bot.api.sendMessage(user.telegramId.toString(), text, {
        parse_mode: 'HTML',
      });
      sent++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: unknown) {
      const err = error as { description?: string };
      if (err.description?.includes('blocked') || err.description?.includes('deactivated')) {
        blocked.push(user.telegramId);
      }
      failed++;
    }
  }
  
  // Mark blocked users
  if (blocked.length > 0) {
    await prisma.telegramUser.updateMany({
      where: { telegramId: { in: blocked } },
      data: { isBlocked: true },
    });
  }
  
  return { sent, failed, blocked: blocked.length };
}

// Schedule types for cron-like jobs
export interface ScheduleConfig {
  dailyDigestTime: string;    // e.g., "09:00"
  reminderInterval: number;   // minutes
  followUpDelay: number;      // hours after message
}

// Default schedule configuration
export const defaultSchedule: ScheduleConfig = {
  dailyDigestTime: '09:00',
  reminderInterval: 60, // Every hour
  followUpDelay: 2, // 2 hours after message
};
