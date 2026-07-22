UPDATE "AdminUser"
SET
  "name" = 'Саша Цомпель',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE LOWER("email") = 'sashatsompel@gmail.com'
  AND (
    "name" IS NULL
    OR LOWER(BTRIM("name")) IN ('sasha', 'local lab owner')
  );
