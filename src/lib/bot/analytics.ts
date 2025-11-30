// Bot Analytics - tracking events and generating reports
import { prisma } from './storage';

// Event types for analytics
export type AnalyticsEvent = 
  | 'bot_start'
  | 'command_used'
  | 'menu_clicked'
  | 'conversation_started'
  | 'conversation_completed'
  | 'conversation_abandoned'
  | 'message_sent'
  | 'partnership_request'
  | 'contact_request'
  | 'webapp_opened'
  | 'admin_action'
  | 'language_changed'
  | 'callback_clicked';

// Track event
export async function trackEvent(
  telegramId: bigint,
  event: AnalyticsEvent,
  data?: Record<string, unknown>
) {
  try {
    // Store in TelegramConversation as analytics log
    await prisma.telegramConversation.create({
      data: {
        telegramId,
        chatId: telegramId,
        conversationType: 'analytics',
        state: JSON.parse(JSON.stringify({
          event,
          data: data || {},
          timestamp: new Date().toISOString(),
        })),
        isActive: false,
      },
    });
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
}

// Get bot statistics
export async function getBotStats(period: 'day' | 'week' | 'month' | 'all' = 'week') {
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'all':
      startDate = new Date(0);
      break;
  }
  
  const [
    totalUsers,
    activeUsers,
    totalMessages,
    messagesByStatus,
    messagesByCategory,
    newUsersToday,
    partnershipRequests,
  ] = await Promise.all([
    // Total unique users
    prisma.telegramUser.count(),
    
    // Active users in period
    prisma.telegramUser.count({
      where: {
        lastActiveAt: { gte: startDate },
      },
    }),
    
    // Total messages
    prisma.message.count({
      where: {
        createdAt: { gte: startDate },
      },
    }),
    
    // Messages by status
    prisma.message.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    }),
    
    // Messages by category
    prisma.message.groupBy({
      by: ['category'],
      _count: true,
      where: {
        createdAt: { gte: startDate },
      },
    }),
    
    // New users today
    prisma.telegramUser.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    
    // Partnership requests
    prisma.message.count({
      where: {
        category: 'PARTNERSHIP',
        createdAt: { gte: startDate },
      },
    }),
  ]);
  
  return {
    period,
    totalUsers,
    activeUsers,
    newUsersToday,
    totalMessages,
    partnershipRequests,
    messagesByStatus: messagesByStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>),
    messagesByCategory: messagesByCategory.reduce((acc, item) => {
      if (item.category) {
        acc[item.category] = item._count;
      }
      return acc;
    }, {} as Record<string, number>),
  };
}

// Get conversion funnel stats
export async function getConversionStats() {
  const [
    totalStarts,
    contactsStarted,
    contactsCompleted,
    partnershipsStarted,
    partnershipsCompleted,
  ] = await Promise.all([
    // Total bot starts (approximation via sessions)
    prisma.telegramSession.count(),
    
    // Contact conversations started
    prisma.telegramConversation.count({
      where: { conversationType: 'contact' },
    }),
    
    // Contact messages (completed)
    prisma.message.count({
      where: {
        category: { in: ['AUTO', 'MOTO', 'GENERAL'] },
        metadata: {
          path: ['source'],
          equals: 'telegram_bot',
        },
      },
    }),
    
    // Partnership conversations started
    prisma.telegramConversation.count({
      where: { conversationType: 'partnership' },
    }),
    
    // Partnership messages (completed)
    prisma.message.count({
      where: {
        category: 'PARTNERSHIP',
        metadata: {
          path: ['source'],
          equals: 'telegram_bot',
        },
      },
    }),
  ]);
  
  return {
    botStarts: totalStarts,
    contactFunnel: {
      started: contactsStarted,
      completed: contactsCompleted,
      conversionRate: contactsStarted > 0 
        ? Math.round((contactsCompleted / contactsStarted) * 100) 
        : 0,
    },
    partnershipFunnel: {
      started: partnershipsStarted,
      completed: partnershipsCompleted,
      conversionRate: partnershipsStarted > 0 
        ? Math.round((partnershipsCompleted / partnershipsStarted) * 100) 
        : 0,
    },
  };
}

// Get hourly activity distribution
export async function getActivityDistribution() {
  const messages = await prisma.message.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    select: {
      createdAt: true,
    },
  });
  
  // Group by hour
  const hourlyDistribution = new Array(24).fill(0);
  const dailyDistribution = new Array(7).fill(0);
  
  for (const msg of messages) {
    const hour = msg.createdAt.getHours();
    const day = msg.createdAt.getDay();
    hourlyDistribution[hour]++;
    dailyDistribution[day]++;
  }
  
  return {
    hourly: hourlyDistribution,
    daily: dailyDistribution,
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    peakDay: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][
      dailyDistribution.indexOf(Math.max(...dailyDistribution))
    ],
  };
}

// Get response time analytics
export async function getResponseTimeStats() {
  const messagesWithReplies = await prisma.message.findMany({
    where: {
      replies: {
        some: {},
      },
    },
    include: {
      replies: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });
  
  if (messagesWithReplies.length === 0) {
    return {
      averageResponseTime: 0,
      medianResponseTime: 0,
      fastestResponse: 0,
      slowestResponse: 0,
    };
  }
  
  const responseTimes = messagesWithReplies
    .filter(m => m.replies[0])
    .map(m => {
      const messageTime = m.createdAt.getTime();
      const replyTime = m.replies[0].createdAt.getTime();
      return (replyTime - messageTime) / (1000 * 60); // Minutes
    })
    .sort((a, b) => a - b);
  
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  const avg = sum / responseTimes.length;
  const median = responseTimes[Math.floor(responseTimes.length / 2)];
  
  return {
    averageResponseTime: Math.round(avg),
    medianResponseTime: Math.round(median),
    fastestResponse: Math.round(responseTimes[0]),
    slowestResponse: Math.round(responseTimes[responseTimes.length - 1]),
    totalReplied: messagesWithReplies.length,
  };
}

// Format stats for Telegram message
export function formatStatsMessage(
  stats: Awaited<ReturnType<typeof getBotStats>>,
  conversion?: Awaited<ReturnType<typeof getConversionStats>>,
  responseTime?: Awaited<ReturnType<typeof getResponseTimeStats>>
): string {
  const periodLabels = {
    day: 'сьогодні',
    week: 'за тиждень',
    month: 'за місяць',
    all: 'за весь час',
  };
  
  let text = `
📊 <b>Аналітика бота</b> (${periodLabels[stats.period]})

👥 <b>Користувачі:</b>
• Всього: ${stats.totalUsers}
• Активних: ${stats.activeUsers}
• Нових сьогодні: ${stats.newUsersToday}

📬 <b>Повідомлення:</b>
• Всього: ${stats.totalMessages}
• 🆕 Нових: ${stats.messagesByStatus['NEW'] || 0}
• ⏳ В роботі: ${stats.messagesByStatus['IN_PROGRESS'] || 0}
• ✅ Завершено: ${stats.messagesByStatus['COMPLETED'] || 0}
• 📁 Архів: ${stats.messagesByStatus['ARCHIVED'] || 0}

📂 <b>По категоріях:</b>
• 🚗 Авто: ${stats.messagesByCategory['AUTO'] || 0}
• 🏍️ Мото: ${stats.messagesByCategory['MOTO'] || 0}
• 📦 Загальне: ${stats.messagesByCategory['GENERAL'] || 0}
• 🤝 Партнери: ${stats.partnershipRequests}
`.trim();

  if (conversion) {
    text += `

📈 <b>Конверсія:</b>
• Контакти: ${conversion.contactFunnel.conversionRate}% (${conversion.contactFunnel.completed}/${conversion.contactFunnel.started})
• Партнерство: ${conversion.partnershipFunnel.conversionRate}% (${conversion.partnershipFunnel.completed}/${conversion.partnershipFunnel.started})`;
  }

  if (responseTime && (responseTime.totalReplied ?? 0) > 0) {
    text += `

⏱️ <b>Час відповіді:</b>
• Середній: ${responseTime.averageResponseTime ?? 0} хв
• Медіана: ${responseTime.medianResponseTime ?? 0} хв
• Відповіли: ${responseTime.totalReplied ?? 0} запитів`;
  }

  return text;
}

// Get top sources (from metadata)
export async function getTopSources() {
  const messages = await prisma.message.findMany({
    where: {
      metadata: {
        path: ['source'],
        not: undefined,
      },
    },
    select: {
      metadata: true,
    },
  });
  
  const sources: Record<string, number> = {};
  
  for (const msg of messages) {
    const meta = msg.metadata as Record<string, unknown> | null;
    if (meta?.source) {
      const source = String(meta.source);
      sources[source] = (sources[source] || 0) + 1;
    }
  }
  
  return Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}
