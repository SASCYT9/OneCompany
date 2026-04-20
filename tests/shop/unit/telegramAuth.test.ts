import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
async function loadTelegramAuthModule() {
  return import(`../../../src/lib/telegram-auth?test=${Date.now()}`);
}

const ORIGINAL_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function createSignedInitData(authDate: number) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAEAAAE',
    user: JSON.stringify({ id: 42, first_name: 'Jamie' }),
  });

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN!).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test.after(() => {
  if (ORIGINAL_TELEGRAM_BOT_TOKEN === undefined) {
    delete process.env.TELEGRAM_BOT_TOKEN;
  } else {
    process.env.TELEGRAM_BOT_TOKEN = ORIGINAL_TELEGRAM_BOT_TOKEN;
  }
});

test('rejects stale telegram init data to prevent replay', () => {
  process.env.TELEGRAM_BOT_TOKEN = 'telegram-unit-test-token';
  const staleTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 24;
  return loadTelegramAuthModule().then(({ verifyInitData }) => {
    const result = verifyInitData(createSignedInitData(staleTimestamp));

    assert.equal(result.isValid, false);
  });
});

test('accepts fresh telegram init data', () => {
  process.env.TELEGRAM_BOT_TOKEN = 'telegram-unit-test-token';
  const freshTimestamp = Math.floor(Date.now() / 1000);
  return loadTelegramAuthModule().then(({ verifyInitData }) => {
    const result = verifyInitData(createSignedInitData(freshTimestamp));

    assert.equal(result.isValid, true);
    assert.equal(result.userId, 42);
  });
});
