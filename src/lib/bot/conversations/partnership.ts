// Partnership form conversation
import type { BotConversation, BotContext, PartnershipType } from '../types';
import { prisma } from '../storage';
import { notifyAdminsNewMessage } from '../notifications';
import { InlineKeyboard } from 'grammy';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Partnership type keyboard
function getPartnershipTypeKeyboard(ctx: BotContext) {
  const t = ctx.t.bind(ctx);
  return new InlineKeyboard()
    .text(t('partnershipTypes.sto'), 'ptype:sto')
    .text(t('partnershipTypes.dealer'), 'ptype:dealer')
    .row()
    .text(t('partnershipTypes.detailing'), 'ptype:detailing')
    .text(t('partnershipTypes.tuning'), 'ptype:tuning')
    .row()
    .text(t('partnershipTypes.other'), 'ptype:other');
}

export async function partnershipConversation(
  conversation: BotConversation,
  ctx: BotContext
) {
  const t = ctx.t.bind(ctx);
  
  // Step 1: Show partnership info and get type
  await ctx.reply(t('partnershipWelcome'), {
    parse_mode: 'HTML',
    reply_markup: getPartnershipTypeKeyboard(ctx),
  });
  
  // Wait for partnership type selection
  const typeCtx = await conversation.waitFor('callback_query:data');
  const typeData = typeCtx.callbackQuery?.data || '';
  
  if (!typeData.startsWith('ptype:')) {
    await ctx.reply('❌ Помилка вибору типу. Спробуйте /partnership знову.');
    return;
  }
  
  const partnershipType = typeData.replace('ptype:', '') as PartnershipType;
  await typeCtx.answerCallbackQuery();
  
  // Update original message to show selected type
  const typeLabels: Record<PartnershipType, string> = {
    sto: '🔧 СТО',
    dealer: '🏪 Дилер',
    detailing: '✨ Детейлінг',
    tuning: '⚡ Тюнінг',
    other: '📋 Інше',
  };
  
  await typeCtx.editMessageText(`✅ Тип партнерства: <b>${typeLabels[partnershipType]}</b>`, {
    parse_mode: 'HTML',
  });
  
  // Step 2: Get company name
  await ctx.reply(t('enterCompanyName'));
  const companyCtx = await conversation.waitFor('message:text');
  const companyName = companyCtx.message?.text || '';
  
  if (!companyName || companyName.length < 2) {
    await ctx.reply('❌ Назва компанії занадто коротка.');
    return;
  }
  
  // Step 3: Get website (optional)
  await ctx.reply(t('enterWebsite'));
  let website: string | undefined;
  
  const websiteCtx = await conversation.waitFor('message:text');
  const websiteInput = websiteCtx.message?.text || '';
  
  if (websiteInput.toLowerCase() !== '/skip') {
    website = websiteInput.startsWith('http') ? websiteInput : `https://${websiteInput}`;
  }
  
  // Step 4: Get contact person name
  await ctx.reply(t('enterContactPerson'));
  const contactCtx = await conversation.waitFor('message:text');
  const contactPerson = contactCtx.message?.text || '';
  
  if (!contactPerson || contactPerson.length < 2) {
    await ctx.reply('❌ Ім\'я занадто коротке.');
    return;
  }
  
  // Step 5: Get email
  await ctx.reply(t('enterEmail').replace('(або /skip щоб пропустити)', ''));
  let email: string = '';
  
  const emailCtx = await conversation.waitFor('message:text');
  const emailInput = emailCtx.message?.text || '';
  
  if (!EMAIL_REGEX.test(emailInput)) {
    await ctx.reply(t('invalidEmail'));
    const emailRetryCtx = await conversation.waitFor('message:text');
    const emailRetry = emailRetryCtx.message?.text || '';
    
    if (EMAIL_REGEX.test(emailRetry)) {
      email = emailRetry;
    } else {
      await ctx.reply('❌ Email обов\'язковий для партнерства.');
      return;
    }
  } else {
    email = emailInput;
  }
  
  // Step 6: Get phone
  await ctx.reply(t('enterPhone').replace('(або /skip щоб пропустити)', ''));
  const phoneCtx = await conversation.waitFor('message:text');
  const phone = phoneCtx.message?.text || '';
  
  if (!phone || phone.length < 10) {
    await ctx.reply('❌ Телефон обов\'язковий для партнерства.');
    return;
  }
  
  // Step 7: Get additional message (optional)
  await ctx.reply('💬 Додаткова інформація про ваш бізнес (або /skip):');
  let message: string | undefined;
  
  const messageCtx = await conversation.waitFor('message:text');
  const messageInput = messageCtx.message?.text || '';
  
  if (messageInput.toLowerCase() !== '/skip') {
    message = messageInput;
  }
  
  // Save to database
  try {
    const telegramId = ctx.from?.id;
    const username = ctx.from?.username;
    
    const savedMessage = await prisma.message.create({
      data: {
        userName: contactPerson,
        userEmail: email,
        userPhone: phone,
        contactMethod: 'TELEGRAM',
        messageText: message || `Partnership request: ${companyName} (${partnershipType})`,
        category: 'PARTNERSHIP',
        status: 'NEW',
        metadata: {
          type: 'partnership',
          partnershipType,
          companyName,
          website,
          contactPerson,
          telegramId: telegramId?.toString(),
          username,
          source: 'telegram_bot',
          language: ctx.session.language,
        },
      },
    });
    
    // Send success message
    await ctx.reply(t('partnershipSent'), { parse_mode: 'HTML' });
    
    // Notify admins with partnership details
    await notifyAdminsPartnership(savedMessage.id, {
      companyName,
      website,
      contactPerson,
      email,
      phone,
      type: partnershipType,
      message,
      telegramId,
      username,
    });
    
  } catch (error) {
    console.error('Failed to save partnership form:', error);
    await ctx.reply(t('requestFailed'));
  }
}

// Special notification for partnership requests
async function notifyAdminsPartnership(
  messageId: string,
  data: {
    companyName: string;
    website?: string;
    contactPerson: string;
    email: string;
    phone: string;
    type: PartnershipType;
    message?: string;
    telegramId?: number;
    username?: string;
  }
) {
  const { getBot } = await import('../bot');
  const { getAllAdmins } = await import('../storage');
  
  try {
    const bot = getBot();
    const admins = await getAllAdmins();
    
    const typeLabels: Record<PartnershipType, string> = {
      sto: '🔧 СТО',
      dealer: '🏪 Дилер',
      detailing: '✨ Детейлінг',
      tuning: '⚡ Тюнінг ательє',
      other: '📋 Інше',
    };
    
    const text = `
🤝 <b>НОВА ЗАЯВКА НА ПАРТНЕРСТВО!</b>

📂 <b>Тип:</b> ${typeLabels[data.type]}
🏢 <b>Компанія:</b> ${escapeHtml(data.companyName)}
${data.website ? `🌐 <b>Сайт:</b> ${escapeHtml(data.website)}` : ''}
👤 <b>Контактна особа:</b> ${escapeHtml(data.contactPerson)}
📧 <b>Email:</b> ${escapeHtml(data.email)}
📱 <b>Телефон:</b> ${escapeHtml(data.phone)}
${data.username ? `💬 <b>Telegram:</b> @${escapeHtml(data.username)}` : ''}
${data.message ? `\n💬 <b>Додатково:</b>\n${escapeHtml(data.message)}` : ''}
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
                  text: '📞 Зателефонувати',
                  url: `tel:${data.phone.replace(/\s/g, '')}`,
                },
                {
                  text: '✉️ Написати email',
                  url: `mailto:${data.email}`,
                },
              ],
              [
                {
                  text: '👁️ Відкрити в панелі',
                  web_app: { url: `${siteUrl}/telegram-app/admin?filter=partnership` }
                },
              ],
              [
                {
                  text: '✅ Взяти в роботу',
                  callback_data: `status:${messageId}:IN_PROGRESS`
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
    console.error('Failed to notify admins about partnership:', error);
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
