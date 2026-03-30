const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT 1 as test')
  .then(r => { console.log('DB OK:', r); return p.$disconnect(); })
  .catch(e => { console.log('ERROR:', e.message.substring(0, 300)); p.$disconnect(); });
