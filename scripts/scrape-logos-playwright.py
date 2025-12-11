""" 
🎭 Logo Scraper with Playwright - For JS-rendered sites

- Auto-detects missing brands by reading src/lib/brands.ts
- Matches slug rules used by scripts/generate-brand-logos-map.js
- Uses Playwright request context to download images with session headers/cookies
- Uses per-brand timeout so it doesn't hang on slow sites

Run: python scripts/scrape-logos-playwright.py
"""

import re
import json
import asyncio
from pathlib import Path
from urllib.parse import urljoin
from typing import Any, Dict, List, Tuple

try:
    from playwright.async_api import async_playwright
except Exception:  # pragma: no cover
    async_playwright = None

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# Suppress SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Keep the same overrides as scripts/generate-brand-logos-map.js
NAME_TO_SLUG_OVERRIDES: Dict[str, str] = {
    'ABT': 'abt',
    'AC Schnitzer': 'ac-schnitzer',
    'AMS / Alpha Performance': 'ams-alpha-performance',
    'H&R': 'handr',
    'KW': 'kw',
    'Öhlins': 'ohlins',
    '3D Design': '3d-design',
    'FI Exhaust': 'fi-exhaust',
    'IPe exhaust': 'ipe-exhaust',
    'Akrapovič': 'akrapovic',
}


MIN_BYTES = 500
NAV_TIMEOUT_MS = 30000
PER_BRAND_TIMEOUT_S = 45


def slugify(name: str) -> str:
    """Match slug rules used by scripts/generate-brand-logos-map.js"""
    if name in NAME_TO_SLUG_OVERRIDES:
        return NAME_TO_SLUG_OVERRIDES[name]

    slug = name.lower()
    slug = slug.replace('ö', 'o').replace('č', 'c')
    slug = slug.replace('&', 'and')
    slug = slug.replace("'", '')
    slug = slug.replace('/', '-')
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'^-|-$', '', slug)
    return slug


def has_logo(name: str) -> bool:
    """Return True only if a non-tiny logo exists (>= MIN_BYTES)."""
    slug = slugify(name)
    for ext in ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif']:
        p = (LOGOS_DIR / f"{slug}{ext}")
        if p.exists() and p.stat().st_size >= MIN_BYTES:
            return True
    return False


def _pick_ext(url: str, content_type: str, content: bytes) -> str:
    ct = (content_type or '').lower()
    if 'svg' in ct or url.lower().endswith('.svg') or b'<svg' in content[:500]:
        return '.svg'
    if 'webp' in ct or url.lower().endswith('.webp'):
        return '.webp'
    if 'png' in ct or url.lower().endswith('.png'):
        return '.png'
    if 'gif' in ct or url.lower().endswith('.gif'):
        return '.gif'
    if 'jpg' in ct or 'jpeg' in ct or url.lower().endswith('.jpg') or url.lower().endswith('.jpeg'):
        return '.jpg'
    return '.png'


async def download_image_via_playwright(request: Any, url: str, dest_path: Path) -> bool:
    """Download image using Playwright request context (keeps cookies/headers)."""
    try:
        resp = await request.get(url, timeout=12000)
        if not resp.ok:
            return False

        content_type = resp.headers.get('content-type', '')
        content = await resp.body()
        if not content or len(content) < MIN_BYTES:
            return False

        ext = _pick_ext(url, content_type, content)
        final_path = dest_path.with_suffix(ext)
        final_path.write_bytes(content)
        return True
    except Exception:
        return False


def _score_candidate(src: str, alt: str, cls: str, parent: str, width: int, height: int) -> int:
    s = 0
    low_src = (src or '').lower()
    low_alt = (alt or '').lower()
    low_cls = (cls or '').lower()
    low_parent = (parent or '').lower()

    if not low_src:
        return -10_000
    if low_src.startswith('data:'):
        return -10_000
    if 'logo' in low_src or 'logo' in low_alt or 'logo' in low_cls:
        s += 500
    if 'brand' in low_src or 'branding' in low_src:
        s += 120
    if any(k in low_parent for k in ['header', 'nav']):
        s += 120
    if any(k in low_cls for k in ['header', 'nav', 'logo']):
        s += 80
    if any(k in low_src for k in ['sprite', 'icon', 'burger', 'menu']):
        s -= 300
    if low_src.endswith('.svg'):
        s += 80
    if low_src.endswith('.png') or low_src.endswith('.webp'):
        s += 40
    if width and height:
        # Prefer reasonably large
        area = width * height
        if area >= 30_000:
            s += 80
        elif area <= 2_000:
            s -= 80
    return s


def load_brands_from_ts() -> List[Tuple[str, str]]:
    brands_file = PROJECT_DIR / 'src' / 'lib' / 'brands.ts'
    content = brands_file.read_text(encoding='utf-8')

    brands: List[Tuple[str, str]] = []

    # TS object format: { name: 'X', ..., website: 'https://...' }
    pat1 = re.compile(
        r"name:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\").*?website:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\")",
        re.DOTALL,
    )
    for m in pat1.finditer(content):
        raw_name = (m.group(1) or m.group(2) or '').strip()
        raw_website = (m.group(3) or m.group(4) or '').strip()
        if not raw_name or not raw_website:
            continue
        name = raw_name.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        website = raw_website.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        if website.startswith('http'):
            brands.append((name, website))

    # JSON-ish fallback (just in case)
    pat2 = re.compile(r"\"name\":\s*\"([^\"]+)\".*?\"website\":\s*\"([^\"]+)\"", re.DOTALL)
    for m in pat2.finditer(content):
        name = m.group(1).strip()
        website = m.group(2).strip()
        if website.startswith('http'):
            brands.append((name, website))

    # Dedup by name (keep first website)
    seen = set()
    unique: List[Tuple[str, str]] = []
    for name, website in brands:
        if name not in seen:
            seen.add(name)
            unique.append((name, website))
    return unique


async def find_logo_with_playwright(page: Any, website: str, name: str) -> bool:
    """Use Playwright to find logo on a page"""
    slug = slugify(name)
    dest_path = LOGOS_DIR / slug
    
    try:
        # Navigate to page
        print(f"  🌐 Loading page...")
        await page.goto(website, wait_until='domcontentloaded', timeout=NAV_TIMEOUT_MS)
        await page.wait_for_timeout(1200)
        
        request = page.request

        # 1) Prefer logo-like SVGs (but skip sprite <use> icons)
        try:
            svg_candidates = await page.eval_on_selector_all(
                'header svg, header .logo svg, .logo svg, svg[class*="logo" i], svg[id*="logo" i]',
                'els => els.map(el => ({ html: el.outerHTML || "", cls: el.getAttribute("class")||"", id: el.getAttribute("id")||"" }))'
            )
            for c in svg_candidates or []:
                html = (c.get('html') or '').strip()
                meta = ((c.get('cls') or '') + ' ' + (c.get('id') or '')).lower()
                if len(html) < 800:
                    continue
                if '<use' in html.lower():
                    continue
                if any(bad in html.lower() for bad in ['icon-burger', 'burger', 'menu']):
                    continue
                if 'logo' not in meta and 'logo' not in html.lower():
                    # avoid random SVG art
                    continue
                final_path = dest_path.with_suffix('.svg')
                final_path.write_text(html, encoding='utf-8')
                print('  📷 Extracted SVG directly')
                return True
        except Exception:
            pass

        # 2) Collect IMG candidates and score them
        img_candidates = await page.eval_on_selector_all(
            'img',
            """
            els => els.map(el => {
              const src = el.currentSrc || el.src || el.getAttribute('src') || '';
              const alt = el.getAttribute('alt') || '';
              const cls = el.getAttribute('class') || '';
              const w = el.naturalWidth || el.width || 0;
              const h = el.naturalHeight || el.height || 0;
              const parent = (el.closest('header') ? 'header' : (el.closest('nav') ? 'nav' : (el.parentElement ? el.parentElement.tagName : '')));
              return {src, alt, cls, w, h, parent};
            })
            """
        )

        scored: List[Tuple[int, str]] = []
        seen_urls = set()
        for c in img_candidates or []:
            src = (c.get('src') or '').strip()
            if not src:
                continue
            full = urljoin(website, src)
            if full in seen_urls:
                continue
            seen_urls.add(full)
            score = _score_candidate(full, c.get('alt') or '', c.get('cls') or '', c.get('parent') or '', int(c.get('w') or 0), int(c.get('h') or 0))
            if score > -5_000:
                scored.append((score, full))

        scored.sort(key=lambda t: t[0], reverse=True)
        for score, url in scored[:12]:
            if score < 150:
                break
            if await download_image_via_playwright(request, url, dest_path):
                print(f"  📷 Downloaded: {url[:60]}...")
                return True
        
        # 3) Try og:image (sometimes is a logo, sometimes not)
        og_image = await page.query_selector('meta[property="og:image"]')
        if og_image:
            content = await og_image.get_attribute('content')
            if content:
                logo_url = urljoin(website, content)
                if await download_image_via_playwright(request, logo_url, dest_path):
                    print(f"  📷 Downloaded OG image: {logo_url[:60]}...")
                    return True
        
        # 4) Favicon as last resort (prefer apple-touch)
        favicon_links = await page.query_selector_all('link[rel*="icon"]')
        for fav in favicon_links or []:
            href = await fav.get_attribute('href')
            if not href:
                continue
            if not any(k in href.lower() for k in ['apple-touch', '180', '192', '256']):
                continue
            favicon_url = urljoin(website, href)
            if await download_image_via_playwright(request, favicon_url, dest_path):
                print(f"  📷 Downloaded favicon: {favicon_url[:60]}...")
                return True
        
        return False
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:60]}")
        return False


async def main():
    print("=" * 70)
    print("🎭 PLAYWRIGHT LOGO SCRAPER - For JS-rendered sites")
    print("=" * 70)
    
    brands = load_brands_from_ts()
    missing = [(n, w) for n, w in brands if not has_logo(n)]
    
    print(f"\n📋 Found {len(missing)} brands still missing logos\n")
    
    if not missing:
        print("✅ All brands have logos!")
        return
    
    downloaded = 0
    failed = []
    
    if async_playwright is None:
        raise RuntimeError('Playwright is not installed. Run: npm i -D playwright ; npx playwright install')

    async with async_playwright() as p:
        # Launch browser
        print("🚀 Launching browser...")
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        
        context = await browser.new_context(
            viewport={'width': 1400, 'height': 900},
            locale='en-US',
            timezone_id='Europe/Warsaw',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignore_https_errors=True,
        )
        
        page = await context.new_page()
        
        for i, (name, website) in enumerate(missing, 1):
            print(f"\n[{i}/{len(missing)}] {name} ({website})")

            try:
                ok = await asyncio.wait_for(find_logo_with_playwright(page, website, name), timeout=PER_BRAND_TIMEOUT_S)
            except asyncio.TimeoutError:
                ok = False

            if ok:
                print(f"  ✅ Downloaded!")
                downloaded += 1
            else:
                print(f"  ❌ Failed")
                failed.append(name)
            
            await page.wait_for_timeout(600)  # Small delay
        
        await browser.close()
    
    # Summary
    print("\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"   ✅ Downloaded: {downloaded}")
    print(f"   ❌ Failed: {len(failed)}")
    print("=" * 70)
    
    if failed:
        print("\n⚠️ Failed brands:")
        for name in failed:
            print(f"   - {name}")
        
        # Save failed list
        with open(SCRIPT_DIR / "failed-playwright.json", "w") as f:
            json.dump(failed, f, indent=2)


if __name__ == "__main__":
    asyncio.run(main())
