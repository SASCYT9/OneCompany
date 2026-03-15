import type { CustomerGroup } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      customerId: string;
      group: CustomerGroup;
      b2bDiscountPercent?: number | null;
      preferredLocale: string;
      companyName?: string | null;
      firstName?: string;
      lastName?: string;
    };
  }

  interface User {
    customerId: string;
    group: CustomerGroup;
    b2bDiscountPercent?: number | null;
    preferredLocale: string;
    companyName?: string | null;
    firstName?: string;
    lastName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    customerId?: string;
    group?: CustomerGroup;
    b2bDiscountPercent?: number | null;
    preferredLocale?: string;
    companyName?: string | null;
    firstName?: string;
    lastName?: string;
  }
}
