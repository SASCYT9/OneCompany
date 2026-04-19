import crypto from 'crypto';

export function resolveSecret(...envNames: string[]) {
  for (const envName of envNames) {
    const value = (process.env[envName] || '').trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function readBearerToken(headers: Headers) {
  const authHeader = headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

export function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function matchesBearerSecret(headers: Headers, secret: string | null) {
  if (!secret) {
    return false;
  }

  const token = readBearerToken(headers);
  return token ? timingSafeEqualText(token, secret) : false;
}

export function matchesHeaderSecret(headers: Headers, headerName: string, secret: string | null) {
  if (!secret) {
    return false;
  }

  const headerValue = headers.get(headerName)?.trim() || null;
  return headerValue ? timingSafeEqualText(headerValue, secret) : false;
}
