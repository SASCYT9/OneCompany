"""
⚡ FAST Logo Scraper - Parallel downloads with very short timeouts
Downloads logos quickly without hanging on slow sites.

Run: python scripts/scrape-logos-fast.py
"""

import os
import re
import json
import asyncio
import aiohttp
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import ssl

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# Very short per-request timeout (seconds)
REQUEST_TIMEOUT = 5
# Hard cap for a single brand processing (seconds)
BRAND_TIMEOUT = 12
# Concurrency (brands processed in parallel)
CONCURRENCY = 6

# Match the mapping generator: ignore tiny/invalid downloads
MIN_BYTES = 500

# Headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
}

# Direct logo URLs (manually researched)
DIRECT_URLS = {
    'ABT': 'https://www.abt-sportsline.com/fileadmin/assets/images/logo/abt-logo.svg',
    'ARMA Speed': 'https://armaspeed.com/cdn/shop/files/footer-logo.png',
    'BC Racing': 'https://www.bcracing.com/wp-content/themes/flavor/images/logo.png',
    'CT Carbon': 'https://ctcarbon.co.uk/cdn/shop/files/CT_CARBON_LOGO_2.png',
    'Deikin': 'https://deikin.com/wp-content/uploads/2023/01/deikin-exhaust-logo.png',
    'ESS Tuning': 'https://esstuning.com/cdn/shop/files/ESS-Tuning-Logo-White.svg',
    'Eventuri': 'https://eventuri.net/wp-content/themes/eventuri/assets/images/header_logo_white.png',
    'Heico': 'https://heicosportiv.de/media/image/d6/9a/b3/heico-sportiv-tuning.png',
    'Liberty Walk': 'https://libertywalk.co.jp/en/wp-content/uploads/sites/3/2019/08/lbwk_logo_w.png',
    'Lorinser': 'https://lorinser.com/media/logo/stores/1/lorinser-logo-dark.svg',
    'Mansory': 'https://www.mansory.com/themes/custom/mansory/logo.svg',
    'Milltek': 'https://www.millteksport.com/static/version1735297261/frontend/Millteksport/milltek/en_GB/images/logo.svg',
    'Novitec': 'https://www.novitecgroup.com/fileadmin/user_upload/media/logos/novitec-white.png',
    'Renegade Design': 'https://renegade-design.net/wp-content/uploads/2023/02/logo-rd-white-1.png',
    'Sterckenn': 'https://www.sterckenn.com/cdn/shop/files/STERCKENN_Logo.svg',
    'TopCar Design': 'https://topcardesign.com/media/logo/websites/1/Logo-Header-Topcar-380-min_1.png',
    'Urban Automotive': 'https://urbanautomotive.co.uk/cdn/shop/files/UrbanAutomotive_Logo_White.png',
    'Weistec Engineering': 'https://www.weistec.com/graphics/00000001/weistec-logo.png',
    'Seibon Carbon': 'https://www.seibon.com/media/logo/stores/1/seibon-logo.png',
    'TireRack': 'https://www.tirerack.com/content/dam/tirerack/images/layout/TireRack-Logo-White.svg',
    'Turner Motorsport': 'https://www.turnermotorsport.com/skin/frontend/turner/default/images/logo.png',
    # Moto brands
    'Arrow': 'https://www.arrow.it/themes/custom/arrow/logo.svg',
    'Rizoma': 'https://www.rizoma.com/static/frontend/Rizoma/default/en_US/images/logo.png',
    'SC-Project': 'https://sc-project.com/wp-content/uploads/2021/03/sc-project-logo.png',
    'Termignoni': 'https://www.termignoni.it/wp-content/uploads/2023/01/logo-termignoni.png',
    'Vandemon': 'https://vandemonperformance.com/cdn/shop/files/Vandemon_Logo_White.png',
    'ZARD Exhaust': 'https://www.zfrex.it/media/logo/websites/1/logo-zard.png',
}

# Skip these - known dead or problematic
SKIP_BRANDS = {
    'Big Boost', 'Brixton wheels', 'Fragola Performance Systems', 'GTHaus', 
    'Paragon brakes', 'Fall-Line Motorsports', 'Pure Drivetrain Solutions',
    'Lingenfelter', 'APR', 'Avantgarde Wheels', 'Borla', 'Fore Innovations',
    'AMS / Alpha Performance',
    # Ukrainian/local brands without websites
    'ONE COMPANY forged', 'Raliw Forged', 'Red Star Exhaust', 'Ronin Design',
    'SCL Concept', 'SooQoo', 'STOPFLEX', 'YPG', 'Matt', 'Pulsar turbo',
    'Black Boost', 'Kotouc', 'Xshift', 'Premier Tuning Group',
}


def slugify(name):
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug.strip('-')


def has_logo(name):
    slug = slugify(name)
    for ext in ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif']:
        p = LOGOS_DIR / f"{slug}{ext}"
        if p.exists() and p.stat().st_size >= MIN_BYTES:
            return True
    return False


_CLIENT_TIMEOUT = aiohttp.ClientTimeout(
    total=REQUEST_TIMEOUT,
    connect=REQUEST_TIMEOUT,
    sock_connect=REQUEST_TIMEOUT,
    sock_read=REQUEST_TIMEOUT,
)


async def download_image(session, url, dest_path):
    """Download image asynchronously"""
    try:
        async with session.get(url, timeout=_CLIENT_TIMEOUT, ssl=False) as resp:
            if resp.status != 200:
                return False
            
            content_type = resp.headers.get('Content-Type', '').lower()
            if not any(t in content_type for t in ['image/', 'svg', 'octet-stream']):
                return False
            
            content = await resp.read()
            if len(content) < 500:
                return False
            
            # Determine extension
            if 'svg' in content_type or url.endswith('.svg') or b'<svg' in content[:200]:
                ext = '.svg'
            elif 'png' in content_type or url.endswith('.png'):
                ext = '.png'
            elif 'webp' in content_type or url.endswith('.webp'):
                ext = '.webp'
            elif 'gif' in content_type or url.endswith('.gif'):
                ext = '.gif'
            else:
                ext = '.png'

            final_path = dest_path.with_suffix(ext)
            final_path.write_bytes(content)
            return True

    except (asyncio.TimeoutError, aiohttp.ClientError, OSError):
        return False


async def try_direct_url(session, name):
    """Try to download from known direct URL"""
    if name not in DIRECT_URLS:
        return False
    
    slug = slugify(name)
    dest_path = LOGOS_DIR / slug
    
    url = DIRECT_URLS[name]
    if await download_image(session, url, dest_path):
        return True
    return False


async def scrape_brand(session, name, website):
    """Try to scrape logo from brand website"""
    slug = slugify(name)
    dest_path = LOGOS_DIR / slug
    
    # Try direct URL first
    if await try_direct_url(session, name):
        return True
    
    # Try common paths
    parsed = urlparse(website)
    base = f"{parsed.scheme}://{parsed.netloc}"
    
    common_paths = [
        '/logo.svg', '/logo.png',
        '/images/logo.svg', '/images/logo.png',
        '/img/logo.svg', '/img/logo.png',
        '/assets/logo.svg', '/assets/logo.png',
        '/cdn/shop/files/logo.svg',
        f'/images/{slug}-logo.svg', f'/images/{slug}-logo.png',
    ]
    
    for path in common_paths:
        url = base + path
        if await download_image(session, url, dest_path):
            return True
    
    # Try scraping the page
    try:
        async with session.get(website, timeout=_CLIENT_TIMEOUT, ssl=False) as resp:
            if resp.status != 200:
                return False
            
            html = await resp.text(errors="ignore")
            soup = BeautifulSoup(html, 'lxml')
            
            # Find logo
            selectors = [
                'header img[src*="logo"]',
                '.logo img', '#logo img',
                'nav img[src*="logo"]',
                'img[alt*="logo" i]',
                'img[class*="logo" i]',
            ]
            
            for sel in selectors:
                img = soup.select_one(sel)
                if img and img.get('src'):
                    img_url = urljoin(website, img['src'])
                    if await download_image(session, img_url, dest_path):
                        return True
            
    except (asyncio.TimeoutError, aiohttp.ClientError, OSError):
        pass
    
    return False


def load_brands():
    """Load brands from brands.ts"""
    brands_file = PROJECT_DIR / "src" / "lib" / "brands.ts"
    content = brands_file.read_text(encoding='utf-8')
    
    brands = []
    # TS object format: { name: '...' } or { name: "..." } (allow apostrophes inside "...")
    pattern1 = r"name:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\").*?website:\s*(?:'((?:\\\\.|[^'])*)'|\"((?:\\\\.|[^\"])*)\")"
    for match in re.finditer(pattern1, content, re.DOTALL):
        raw_name = (match.group(1) or match.group(2) or '').strip()
        raw_website = (match.group(3) or match.group(4) or '').strip()
        if not raw_name or not raw_website:
            continue
        name = raw_name.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        website = raw_website.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        if website and 'http' in website:
            brands.append((name, website))
    
    pattern2 = r'"name":\s*"([^"]+)".*?"website":\s*"([^"]*)"'
    for match in re.finditer(pattern2, content, re.DOTALL):
        name = match.group(1)
        website = match.group(2)
        if website and 'http' in website and (name, website) not in brands:
            brands.append((name, website))
    
    # Remove duplicates
    seen = set()
    unique = []
    for name, website in brands:
        if name not in seen:
            seen.add(name)
            unique.append((name, website))
    
    return unique


async def _process_one(semaphore, session, idx, total, name, website):
    async with semaphore:
        try:
            ok = await asyncio.wait_for(scrape_brand(session, name, website), timeout=BRAND_TIMEOUT)
            return idx, name, ok
        except asyncio.TimeoutError:
            return idx, name, False


async def main():
    print("=" * 60)
    print("⚡ FAST Logo Scraper - Parallel downloads")
    print("=" * 60)
    
    brands = load_brands()
    # Historically we skipped some brands as “problematic”, but if the user
    # asks to fill missing logos we should still attempt them — especially
    # when a DIRECT_URL is available.
    missing = [(n, w) for n, w in brands if not has_logo(n) and (n not in SKIP_BRANDS or n in DIRECT_URLS)]
    
    print(f"\n📋 {len(missing)} brands to process\n")
    
    if not missing:
        print("✅ All brands have logos!")
        return
    
    connector = aiohttp.TCPConnector(
        limit=CONCURRENCY * 2,
        limit_per_host=max(2, CONCURRENCY // 2),
        ssl=False,
        ttl_dns_cache=300,
        enable_cleanup_closed=True,
    )

    downloaded = 0
    failed = []
    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with aiohttp.ClientSession(headers=HEADERS, connector=connector, raise_for_status=False) as session:
        tasks = []
        total = len(missing)
        for i, (name, website) in enumerate(missing, 1):
            tasks.append(asyncio.create_task(_process_one(semaphore, session, i, total, name, website)))

        for fut in asyncio.as_completed(tasks):
            i, name, ok = await fut
            print(f"[{i}/{total}] {name}... {'✅' if ok else '❌'}")
            if ok:
                downloaded += 1
            else:
                failed.append(name)
    
    print("\n" + "=" * 60)
    print(f"📊 Downloaded: {downloaded}, Failed: {len(failed)}")
    print("=" * 60)
    
    if failed:
        print("\n⚠️ Failed brands:", ", ".join(failed[:10]))
        if len(failed) > 10:
            print(f"   ...and {len(failed)-10} more")


if __name__ == "__main__":
    asyncio.run(main())
