import { Resend } from 'resend';

export const isProduction = process.env.NODE_ENV === 'production';

export function getEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

export function getRequiredEnv(name: string, devFallback?: string): string {
  const value = getEnv(name);
  if (value) {
    return value;
  }

  if (!isProduction && typeof devFallback === 'string') {
    return devFallback;
  }

  throw new Error(`${name} is not set`);
}

export function getOptionalResendClient(): Resend | null {
  const apiKey = getEnv('RESEND_API_KEY');
  return apiKey ? new Resend(apiKey) : null;
}
