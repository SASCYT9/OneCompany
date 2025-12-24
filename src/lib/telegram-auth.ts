import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export function verifyInitData(initData: string): { isValid: boolean; userId?: number; userData?: any } {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return { isValid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
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
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    
    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex');
    
    if (calculatedHash !== hash) {
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
