import crypto from 'crypto';

const DEFAULT_MAX_AGE_SECONDS = 60 * 60;

function getTelegramBotToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function getMaxAgeSeconds() {
  const configured = Number.parseInt(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_AGE_SECONDS;
}

export function verifyInitData(initData: string): { isValid: boolean; userId?: number; userData?: unknown } {
  const telegramBotToken = getTelegramBotToken();
  if (!telegramBotToken) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return { isValid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDateRaw = params.get('auth_date');
    
    if (!hash || !authDateRaw) {
      return { isValid: false };
    }

    const authDate = Number.parseInt(authDateRaw, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(authDate) ||
      authDate <= 0 ||
      nowSeconds - authDate > getMaxAgeSeconds() ||
      authDate - nowSeconds > 300
    ) {
      return { isValid: false };
    }

    params.delete('hash');
    
    // Sort params alphabetically
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(telegramBotToken)
      .digest();
    
    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');
    
    const provided = Buffer.from(hash, 'hex');
    const expected = Buffer.from(calculatedHash, 'hex');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return { isValid: false };
    }
    
    // Extract user data
    const userDataStr = params.get('user');
    let userData = null;
    let userId = undefined;

    if (userDataStr) {
      userData = JSON.parse(userDataStr);
      userId = userData.id;
    }
    
    return { isValid: true, userId, userData };
  } catch (error) {
    console.error('InitData verification error:', error);
    return { isValid: false };
  }
}

export function isAuthenticated(request: Request): boolean {
  // Allow dev mode bypass if configured
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_AUTH_BYPASS === 'true') {
    return true;
  }

  let initData = '';
  const authHeader = request.headers.get('Authorization');
  const customHeader = request.headers.get('X-Telegram-Init-Data');

  if (customHeader) {
    initData = customHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    initData = authHeader.substring(7);
  }

  if (!initData) {
    return false;
  }

  if (initData === 'dev' && process.env.NODE_ENV === 'development') {
    return true;
  }

  const { isValid } = verifyInitData(initData);
  return isValid;
}
