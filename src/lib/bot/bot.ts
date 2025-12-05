// Main grammY Bot with all middleware
import { Bot, session, GrammyError, HttpError } from 'grammy';
import { hydrate } from '@grammyjs/hydrate';
import { conversations, createConversation } from '@grammyjs/conversations';
import { limit } from '@grammyjs/ratelimiter';
import { autoRetry } from '@grammyjs/auto-retry';

import type { BotContext, SessionData } from './types';
import { createPrismaStorage, defaultSession, getOrCreateUser, checkIsAdmin } from './storage';
import { getTranslation } from './translations';
import { mainMenu, languageMenu, categoryMenu, adminMenu, catalogMenu } from './menus';
import { contactConversation } from './conversations/contact';
import { partnershipConversation } from './conversations/partnership';
import { registerCommands } from './handlers/commands';
import { registerCallbacks } from './handlers/callbacks';

// Bot instance (will be initialized with token)
let bot: Bot<BotContext> | null = null;

// Get or create bot instance
export function getBot(token?: string): Bot<BotContext> {
  if (bot) return bot;
  
  const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  
  // For serverless, we need to provide botInfo statically to avoid init() call
  // This is the bot info for @OneCompanyUA_bot
  bot = new Bot<BotContext>(botToken, {
    botInfo: {
      id: 8449589510,
      is_bot: true,
      first_name: 'OneCompany',
      username: 'OneCompanyUA_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    },
  });
  
  // Auto-retry on rate limits
  bot.api.config.use(autoRetry({
    maxRetryAttempts: 3,
    maxDelaySeconds: 10,
  }));
  
  // Rate limiting
  bot.use(limit({
    timeFrame: 2000,
    limit: 3,
    onLimitExceeded: async (ctx) => {
      await ctx.reply('⏳ Занадто багато запитів. Зачекайте...');
    },
  }));
  
  // Hydrate for editing messages
  bot.use(hydrate());
  
  // Session with Prisma storage
  bot.use(session({
    initial: (): SessionData => ({ ...defaultSession }),
    storage: createPrismaStorage(),
    getSessionKey: (ctx) => {
      return ctx.from?.id?.toString();
    },
  }));
  
  // Custom middleware - translation function & admin check
  bot.use(async (ctx, next) => {
    // Translation function
    ctx.t = (key: string, params?: Record<string, string | number>) => {
      const lang = ctx.session?.language || 'uk';
      return getTranslation(lang, key, params);
    };
    
    // Telegram ID
    ctx.telegramId = BigInt(ctx.from?.id || 0);
    
    // Update user in database
    if (ctx.from) {
      await getOrCreateUser(ctx.telegramId, {
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        languageCode: ctx.from.language_code,
      });
      
      // Check admin status
      const adminStatus = await checkIsAdmin(ctx.telegramId);
      ctx.isAdmin = adminStatus.isAdmin;
      if (ctx.session) {
        ctx.session.isAdmin = adminStatus.isAdmin;
      }
    } else {
      ctx.isAdmin = false;
    }
    
    await next();
  });
  
  // Conversations
  bot.use(conversations());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(contactConversation as any, 'contact'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bot.use(createConversation(partnershipConversation as any, 'partnership'));
  
  // Menus
  bot.use(mainMenu);
  bot.use(languageMenu);
  bot.use(categoryMenu);
  bot.use(adminMenu);
  bot.use(catalogMenu);
  
  // Register command handlers
  registerCommands(bot);
  
  // Register callback handlers
  registerCallbacks(bot);
  
  // Error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error('Error in request:', e.description);
    } else if (e instanceof HttpError) {
      console.error('Could not contact Telegram:', e);
    } else {
      console.error('Unknown error:', e);
    }
  });
  
  return bot;
}

// For webhook handling
export async function handleUpdate(token: string, update: unknown) {
  const botInstance = getBot(token);
  await botInstance.handleUpdate(update as Parameters<typeof botInstance.handleUpdate>[0]);
}

// Set webhook
export async function setWebhook(token: string, url: string) {
  const botInstance = getBot(token);
  await botInstance.api.setWebhook(url, {
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query', 'inline_query'],
  });
}

// Export bot for direct usage
export { bot };
