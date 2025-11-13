/**
 * Telegram Bot Long Polling для локальної розробки
 * Запускайте: node scripts/telegram-bot-polling.js
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8449589510:AAHFS3DVvVd--pCqsFPUIEji1IeJ8MOVJc4';
const API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const WEBHOOK_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

let offset = 0;
let isRunning = false;

// Функція для обробки update через локальний API
async function processUpdate(update) {
  try {
    const response = await fetch(`${WEBHOOK_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    
    const data = await response.json();
    console.log('✅ Update processed:', data);
  } catch (error) {
    console.error('❌ Error processing update:', error.message);
  }
}

// Long polling
async function startPolling() {
  console.log('🤖 Starting Telegram Bot Polling...');
  console.log('📱 Bot Token:', TELEGRAM_BOT_TOKEN.substring(0, 20) + '...');
  console.log('🔗 Webhook URL:', WEBHOOK_URL);
  console.log('');
  
  // Видаляємо webhook якщо він був
  try {
    await fetch(`${API_URL}/deleteWebhook`);
    console.log('✅ Webhook removed (using polling mode)');
  } catch (e) {
    console.warn('⚠️ Failed to remove webhook:', e.message);
  }
  
  isRunning = true;
  
  while (isRunning) {
    try {
      const response = await fetch(`${API_URL}/getUpdates?offset=${offset}&timeout=30`);
      const data = await response.json();
      
      if (!data.ok) {
        console.error('❌ Telegram API error:', data);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      if (data.result && data.result.length > 0) {
        for (const update of data.result) {
          console.log('\n📨 New update:', update.update_id);
          
          if (update.message) {
            console.log('💬 Message from:', update.message.from.first_name);
            console.log('📝 Text:', update.message.text);
          } else if (update.callback_query) {
            console.log('🔘 Button pressed:', update.callback_query.data);
            console.log('👤 By:', update.callback_query.from.first_name);
          }
          
          // Обробляємо через локальний webhook endpoint
          await processUpdate(update);
          
          // Оновлюємо offset
          offset = update.update_id + 1;
        }
      }
      
      // Короткий timeout між запитами
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('❌ Polling error:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping bot polling...');
  isRunning = false;
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Stopping bot polling...');
  isRunning = false;
  process.exit(0);
});

// Перевірка підключення
async function testConnection() {
  try {
    const response = await fetch(`${API_URL}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Bot connected:', data.result.first_name, `(@${data.result.username})`);
      console.log('');
      return true;
    } else {
      console.error('❌ Bot connection failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    return false;
  }
}

// Головна функція
async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🤖 Telegram Bot - Local Development  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  const connected = await testConnection();
  
  if (!connected) {
    console.error('');
    console.error('⚠️  Check your TELEGRAM_BOT_TOKEN in .env.local');
    process.exit(1);
  }
  
  // Перевірка локального API
  try {
    const response = await fetch(`${WEBHOOK_URL}/api/telegram/webhook`);
    const data = await response.json();
    console.log('✅ Local API available:', data.status);
    console.log('');
  } catch (error) {
    console.error('❌ Local API not available:', error.message);
    console.error('⚠️  Make sure dev server is running: npm run dev');
    console.error('');
    process.exit(1);
  }
  
  console.log('🚀 Bot is ready! Send /start to your bot in Telegram');
  console.log('Press Ctrl+C to stop');
  console.log('═════════════════════════════════════════════════════');
  console.log('');
  
  await startPolling();
}

main();
