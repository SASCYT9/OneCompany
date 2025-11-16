INSERT INTO "Message" ("id", "userName", "userEmail", "messageText", "status", "createdAt", "updatedAt")
VALUES (
  'test_' || gen_random_uuid()::text,
  'Test User',
  'test@example.com',
  'Це тестове повідомлення для перевірки адмін панелі OneCompany. Все працює чудово!',
  'NEW',
  NOW(),
  NOW()
);

SELECT id, "userName", "userEmail", status, "createdAt" 
FROM "Message" 
ORDER BY "createdAt" DESC 
LIMIT 5;
