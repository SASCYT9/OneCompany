/* eslint-disable */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Перевірка підключення до бази даних...\n');
    
    // Створити тестове повідомлення
    const newMessage = await prisma.message.create({
      data: {
        userName: 'Test User',
        userEmail: 'test@example.com',
        messageText: 'Це тестове повідомлення для перевірки адмін панелі OneCompany. Все працює чудово!',
        status: 'NEW',
      },
    });
    
    console.log('✅ Тестове повідомлення створено:');
    console.log('   ID:', newMessage.id);
    console.log('   Користувач:', newMessage.userName);
    console.log('   Email:', newMessage.userEmail);
    console.log('   Статус:', newMessage.status);
    console.log('   Дата:', newMessage.createdAt);
    console.log('');
    
    // Отримати всі повідомлення
    const allMessages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { replies: true },
    });
    
    console.log('📊 Статистика повідомлень:');
    console.log('   Загальна кількість:', allMessages.length);
    console.log('');
    
    if (allMessages.length > 0) {
      console.log('📝 Останні 5 повідомлень:');
      allMessages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg.userName} (${msg.status}) - ${msg.createdAt.toLocaleString()}`);
        console.log(`      Email: ${msg.userEmail}`);
        console.log(`      Відповідей: ${msg.replies.length}`);
      });
    }
    
    console.log('\n✅ База даних працює коректно!');
    
  } catch (error) {
    console.error('❌ Помилка підключення до бази даних:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
