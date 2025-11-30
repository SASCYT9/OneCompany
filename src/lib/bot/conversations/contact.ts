// Contact form conversation
import type { BotConversation, BotContext } from '../types';
import { prisma } from '../storage';
import { notifyAdminsNewMessage } from '../notifications';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const category = ctx.session.lastCategory || 'general';
  const t = ctx.t.bind(ctx);
  
  // Step 1: Get name
  await ctx.reply(t('enterName'));
  const nameCtx = await conversation.waitFor('message:text');
  const name = nameCtx.message?.text || '';
  
  if (!name || name.length < 2) {
    await ctx.reply('❌ Ім\'я занадто коротке. Мінімум 2 символи.');
    return;
  }
  
  // Step 2: Get email (optional)
  await ctx.reply(t('enterEmail'));
  let email: string | null = null;
  
  const emailCtx = await conversation.waitFor('message:text');
  const emailInput = emailCtx.message?.text || '';
  
  if (emailInput.toLowerCase() !== '/skip') {
    if (!EMAIL_REGEX.test(emailInput)) {
      await ctx.reply(t('invalidEmail'));
      const emailRetryCtx = await conversation.waitFor('message:text');
      const emailRetry = emailRetryCtx.message?.text || '';
      
      if (emailRetry.toLowerCase() !== '/skip') {
        if (EMAIL_REGEX.test(emailRetry)) {
          email = emailRetry;
        }
      }
    } else {
      email = emailInput;
    }
  }
  
  // Step 3: Get phone (optional)
  await ctx.reply(t('enterPhone'));
  let phone: string | undefined;
  
  const phoneCtx = await conversation.waitFor('message:text');
  const phoneInput = phoneCtx.message?.text || '';
  
  if (phoneInput.toLowerCase() !== '/skip') {
    phone = phoneInput;
  }
  
  // Step 4: Get message
  await ctx.reply(t('enterMessage'));
  const messageCtx = await conversation.waitFor('message:text');
  const message = messageCtx.message?.text || '';
  
  if (!message || message.length < 5) {
    await ctx.reply('❌ Повідомлення занадто коротке. Мінімум 5 символів.');
    return;
  }
  
  // Save to database
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    
    const categoryEnum = category.toUpperCase() as 'AUTO' | 'MOTO' | 'GENERAL';
    
    const savedMessage = await prisma.message.create({
      data: {
        userName: name,
        userEmail: email || '',
        messageText: message,
        category: categoryEnum,
        status: 'NEW',
        metadata: {
          telegramId: telegramId?.toString(),
          username,
          phone,
          source: 'telegram_bot',
          language: ctx.session.language,
        },
      },
    });
    
    // Send success message
    await ctx.reply(t('requestSent'), { parse_mode: 'HTML' });
    
    // Notify admins
    await notifyAdminsNewMessage(savedMessage.id, {
      name,
      email: email || undefined,
      phone,
      message,
      category,
      telegramId,
      username,
    });
    
  } catch (error) {
    console.error('Failed to save contact form:', error);
    await ctx.reply(t('requestFailed'));
  }
}
