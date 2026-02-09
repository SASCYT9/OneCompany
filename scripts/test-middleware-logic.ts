
// Mock NextRequest and other necessary parts
class MockRequest {
  cookies: Map<string, any>;
  headers: Map<string, string>;

  constructor(cookies = {}, headers = {}) {
    this.cookies = new Map(Object.entries(cookies));
    this.headers = new Map(Object.entries(headers));
  }
}

// Logic from middleware (copied for testing purposes)

// Logic from middleware (copied for testing purposes)
// Countries that should see Ukrainian version
const ukrainianCountries = ['UA'];

function detectLocale(req: MockRequest, isMigrated: boolean = false): 'ua' | 'en' {
  // 1. Check if user already has a locale preference cookie
  // ONLY if they have been migrated (verified against new logic)
  if (isMigrated) {
    const localeCookie = req.cookies.get('NEXT_LOCALE');
    const localeValue = localeCookie ? localeCookie.value : undefined;
    if (localeValue && (localeValue === 'ua' || localeValue === 'en')) {
      return localeValue;
    }
  }

  // 2. Check Vercel's geolocation header (works on Vercel deployment)
  const country = req.headers.get('x-vercel-ip-country');

  // STRICT LOGIC: If we have country info
  if (country) {
    if (ukrainianCountries.includes(country)) {
      return 'ua';
    } else {
      // ANY other country -> English
      return 'en';
    }
  }

  // 3. Fallback: Check browser's Accept-Language header (only if no country info)
  const acceptLanguage = req.headers.get('accept-language');
  if (acceptLanguage) {
    // Check for Ukrainian language preference
    if (acceptLanguage.toLowerCase().includes('uk') ||
      acceptLanguage.toLowerCase().includes('ua')) {
      return 'ua';
    }
    // Check for Russian - show Ukrainian version (they can understand)
    if (acceptLanguage.toLowerCase().includes('ru')) {
      return 'ua';
    }
  }

  // 4. Default to English for international users
  return 'en';
}

function runTests() {
  console.log("Running Middleware Logic Tests (Migration Edition)...\n");
  let passed = 0;
  let failed = 0;

  function assert(name: string, actual: string, expected: string) {
    if (actual === expected) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name}: Expected ${expected}, got ${actual}`);
      failed++;
    }
  }

  // Test 1: MIGRATED User with Cookie
  // Simulated: User has verified locale logic before (isMigrated=true)
  const req1 = new MockRequest({ NEXT_LOCALE: { value: 'ua' } }, { 'x-vercel-ip-country': 'US' });
  assert("Migrated + Cookie 'ua' overrides US IP", detectLocale(req1, true), 'ua');

  // Test 2: NON-MIGRATED User with Cookie (The Fix!)
  // Simulated: User has old cookie (maybe from browser language fallback) but is in US
  // Should IGNORE cookie and use GeoIP
  const req2 = new MockRequest({ NEXT_LOCALE: { value: 'ua' } }, { 'x-vercel-ip-country': 'US' });
  assert("Non-Migrated + Cookie 'ua' IGNORED for US IP -> returns 'en'", detectLocale(req2, false), 'en');

  // Test 3: GeoIP - Ukraine (Non-Migrated)
  const req3 = new MockRequest({}, { 'x-vercel-ip-country': 'UA' });
  assert("IP from UA -> returns 'ua'", detectLocale(req3, false), 'ua');

  // Test 4: GeoIP - Poland (Non-Migrated)
  const req4 = new MockRequest({}, { 'x-vercel-ip-country': 'PL' });
  assert("IP from PL -> returns 'en'", detectLocale(req4, false), 'en');

  // Test 5: Fallback (Localhost) - No GeoIP, Browser UK
  const req5 = new MockRequest({}, { 'accept-language': 'uk-UA,uk;q=0.9' });
  assert("No GeoIP, Browser UK -> returns 'ua'", detectLocale(req5, false), 'ua');

  // Test 6: Fallback (Localhost) - No GeoIP, Browser RU
  const req6 = new MockRequest({}, { 'accept-language': 'ru-RU,ru;q=0.9' });
  assert("No GeoIP, Browser RU -> returns 'ua'", detectLocale(req6, false), 'ua');


  console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
}

runTests();
