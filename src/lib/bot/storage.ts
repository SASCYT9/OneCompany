// Prisma Session Storage for grammY
import { PrismaClient } from '@prisma/client';
import type { StorageAdapter } from 'grammy';
import type { SessionData } from './types';

const prisma = new PrismaClient();

// Default session data
export const defaultSession: SessionData = {
  language: 'uk',
  lastCategory: undefined,
  contactStep: null,
  tempData: undefined,
  menuMessageId: undefined,
  isAdmin: false,
};

// Prisma Storage Adapter for grammY sessions
export function createPrismaStorage(): StorageAdapter<SessionData> {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      try {
        const telegramId = BigInt(key);
        const session = await prisma.telegramSession.findUnique({
          where: { telegramId },
        });
        
        if (session?.data) {
          return {
            ...defaultSession,
            ...(session.data as unknown as SessionData),
          };
        }
        
        return undefined;
      } catch (error) {
        console.error('Session read error:', error);
        return undefined;
      }
    },
    
    async write(key: string, value: SessionData): Promise<void> {
      try {
        const telegramId = BigInt(key);
        
        await prisma.telegramSession.upsert({
          where: { telegramId },
          update: {
            data: value as object,
            updatedAt: new Date(),
          },
          create: {
            telegramId,
            data: value as object,
          },
        });
      } catch (error) {
        console.error('Session write error:', error);
      }
    },
    
    async delete(key: string): Promise<void> {
      try {
        const telegramId = BigInt(key);
        await prisma.telegramSession.delete({
          where: { telegramId },
        });
      } catch (error) {
        console.error('Session delete error:', error);
      }
    },
  };
}

// Get or create Telegram user
export async function getOrCreateUser(
  telegramId: bigint,
  data?: {
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
  }
) {
  try {
    const user = await prisma.telegramUser.upsert({
      where: { telegramId },
      update: {
        ...(data?.username && { username: data.username }),
        ...(data?.firstName && { firstName: data.firstName }),
        ...(data?.lastName && { lastName: data.lastName }),
        lastActiveAt: new Date(),
      },
      create: {
        telegramId,
        username: data?.username,
        firstName: data?.firstName,
        lastName: data?.lastName,
        languageCode: data?.languageCode || 'uk',
      },
    });
    
    return user;
  } catch (error) {
    console.error('User upsert error:', error);
    return null;
  }
}

// Check if user is admin
export async function checkIsAdmin(telegramId: bigint): Promise<{
  isAdmin: boolean;
  role?: string;
  permissions?: string[];
}> {
  try {
    const admin = await prisma.telegramAdmin.findUnique({
      where: { telegramId, isActive: true },
    });
    
    if (admin) {
      return {
        isAdmin: true,
        role: admin.role,
        permissions: admin.permissions as string[],
      };
    }
    
    // Also check TelegramUser.isAdmin flag
    const user = await prisma.telegramUser.findUnique({
      where: { telegramId },
    });
    
    return {
      isAdmin: user?.isAdmin || false,
    };
  } catch (error) {
    console.error('Admin check error:', error);
    return { isAdmin: false };
  }
}

// Add admin
export async function addAdmin(
  telegramId: bigint,
  name: string,
  options?: {
    username?: string;
    role?: 'admin' | 'superadmin';
    permissions?: string[];
  }
) {
  try {
    const admin = await prisma.telegramAdmin.upsert({
      where: { telegramId },
      update: {
        name,
        ...(options?.username && { username: options.username }),
        ...(options?.role && { role: options.role }),
        ...(options?.permissions && { permissions: options.permissions }),
        isActive: true,
      },
      create: {
        telegramId,
        name,
        username: options?.username,
        role: options?.role || 'admin',
        permissions: options?.permissions || ['messages'],
      },
    });
    
    // Also update TelegramUser flag
    await prisma.telegramUser.updateMany({
      where: { telegramId },
      data: { isAdmin: true },
    });
    
    return admin;
  } catch (error) {
    console.error('Add admin error:', error);
    return null;
  }
}

// Get all admins
export async function getAllAdmins() {
  try {
    return await prisma.telegramAdmin.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Get admins error:', error);
    return [];
  }
}

// Export prisma for direct use
export { prisma };
