import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShopCustomerRegistration,
  hashShopCustomerPassword,
} from '../../../src/lib/shopCustomers';
import { serializeShopCustomerAdminDetail } from '../../../src/lib/shopAdminCustomers';

test('customer registration persists only hashed credentials', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    shopCustomer: {
      findUnique: async () => null,
      create: async (args: Record<string, unknown>) => {
        calls.push(args);
        return {
          id: 'customer_1',
          email: 'customer@example.com',
          firstName: 'Jamie',
          lastName: 'Driver',
          group: 'B2C',
          account: { passwordHash: 'stored-hash' },
          addresses: [],
        };
      },
    },
  } as any;

  await createShopCustomerRegistration(prisma, {
    email: 'customer@example.com',
    firstName: 'Jamie',
    lastName: 'Driver',
    password: 'SecretPass123!',
  });

  const createArgs = calls[0] as any;
  assert.ok(createArgs);
  assert.equal(typeof createArgs.data.account.create.passwordHash, 'string');
  assert.equal(createArgs.data.account.create.passwordHash.includes('SecretPass123!'), false);
  assert.equal('plainPassword' in createArgs.data.account.create, false);
});

test('admin customer serialization never exposes plaintext passwords', async () => {
  const passwordHash = await hashShopCustomerPassword('SecretPass123!');
  const serialized = serializeShopCustomerAdminDetail(
    {
      id: 'customer_1',
      email: 'customer@example.com',
      firstName: 'Jamie',
      lastName: 'Driver',
      phone: null,
      companyName: null,
      vatNumber: null,
      group: 'B2C',
      b2bDiscountPercent: null,
      isActive: true,
      notes: null,
      preferredLocale: 'en',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      account: {
        lastLoginAt: null,
        emailVerifiedAt: null,
        passwordHash,
        plainPassword: 'SecretPass123!',
      },
      addresses: [],
      orders: [],
      carts: [],
    } as any,
    []
  );

  assert.ok(serialized.account);
  assert.equal('plainPassword' in serialized.account!, false);
});
