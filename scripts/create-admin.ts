import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const email = 'sashatsompel@gmail.com';
  const password = 'admin123'; // Temporary password
  
  // 1. Ensure a Super Admin role exists
  let superRole = await prisma.adminRole.findFirst({
    where: { key: 'super_admin' }
  });
  
  if (!superRole) {
    // If not, maybe create one? The prompt said there are roles. Let's find any role.
    superRole = await prisma.adminRole.findFirst();
    if (!superRole) {
      superRole = await prisma.adminRole.create({
        data: {
          key: 'super_admin',
          name: 'Super Admin',
          permissions: ['*'], // Give everything
        }
      });
    }
  }

  // 2. Hash password
  const hashed = hashPassword(password);

  // 3. Create or Update user
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      passwordHash: hashed,
      isActive: true,
      name: 'SASHA'
    },
    create: {
      email,
      name: 'SASHA',
      passwordHash: hashed,
      isActive: true,
    }
  });

  // 4. Link role
  const existingLink = await prisma.adminUserRole.findUnique({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superRole.id
      }
    }
  });

  if (!existingLink) {
    await prisma.adminUserRole.create({
      data: {
        userId: user.id,
        roleId: superRole.id
      }
    });
  }

  console.log(`\n✅ Account created successfully!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
