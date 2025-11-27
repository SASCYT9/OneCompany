"""
🚀 ULTRA LOGO FETCHER - Maximum Speed & Quality
Uses multiple parallel sources with async requests
Priority: SVG > PNG (transparent) > WebP

Run: pip install aiohttp aiofiles pillow cairosvg httpx beautifulsoup4 lxml
Then: python scripts/ultra_logo_fetcher.py
"""

import asyncio
import aiohttp
import aiofiles
import os
import json
import re
import sys
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from urllib.parse import quote, urljoin
from io import BytesIO

# Check and install dependencies
def install_deps():
    import subprocess
    deps = ['aiohttp', 'aiofiles', 'pillow', 'httpx', 'beautifulsoup4', 'lxml']
    for dep in deps:
        try:
            __import__(dep.replace('-', '_').split('[')[0])
        except ImportError:
            print(f"Installing {dep}...")
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', dep, '-q'])

install_deps()

from bs4 import BeautifulSoup
from PIL import Image
import httpx

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"
BRANDS_FILE = SCRIPT_DIR / "brands-list.json"

# Brand domains mapping
BRAND_DOMAINS: Dict[str, str] = {
    'Akrapovic': 'akrapovic.com',
    'Eventuri': 'eventuri.net',
    'KW': 'kwsuspensions.com',
    'HRE': 'hrewheels.com',
    'Brembo': 'brembo.com',
    'Vorsteiner': 'vorsteiner.com',
    'Armytrix': 'armytrix.com',
    'CSF': 'csfrace.com',
    'Manhart': 'manhart-performance.de',
    'Renntech': 'renntechmercedes.com',
    'Velos': 'velosdesignwerks.com',
    'Velos Wheels': 'velosdesignwerks.com',
    'Weistec': 'weistec.com',
    'Novitec': 'novitecgroup.com',
    'Brabus': 'brabus.com',
    'ABT': 'abt-sportsline.com',
    'Techart': 'techart.de',
    'IPE': 'ipe-exhaust.com',
    'AWE': 'awe-tuning.com',
    'H&R': 'h-r.com',
    'Eibach': 'eibach.com',
    'BBS': 'bbs.com',
    'OZ Racing': 'ozracing.com',
    'Bilstein': 'bilstein.com',
    'Ohlins': 'ohlins.com',
    'Capristo': 'capristo.de',
    'Fi Exhaust': 'fi-exhaust.com',
    'AC Schnitzer': 'ac-schnitzer.de',
    'Hamann': 'hamann-motorsport.de',
    'Lorinser': 'lorinser.com',
    'Mansory': 'mansory.com',
    'Liberty Walk': 'libertywalk.co.jp',
    'Air Lift': 'airliftperformance.com',
    'StopTech': 'stoptech.com',
    'AP Racing': 'apracing.com',
    'Vossen': 'vfrwheels.com',
    'Forgiato': 'forgiato.com',
    'ADV.1': 'thewheelindustry.com',
    'Rotiform': 'rotiform.com',
    'fifteen52': 'fifteen52.com',
    'Borla': 'borla.com',
    'MagnaFlow': 'magnaflow.com',
    'Milltek': 'millteksport.com',
    'Remus': 'remus.eu',
    'APR': 'goapr.com',
    'COBB': 'cobbtuning.com',
    'Dinan': 'dinancars.com',
    'G-Power': 'g-power.de',
    'Hennessey': 'hennesseyperformance.com',
    'Roush': 'roush.com',
    'Shelby': 'shelby.com',
    'Seibon': 'seibon.com',
    'SC Project': 'sc-project.com',
    'Termignoni': 'termignoni.it',
    'Yoshimura': 'yoshimura-jp.com',
    'Rizoma': 'rizoma.com',
    'Alpha-N': 'alpha-n.de',
    '3D Design': '3ddesign.jp',
    'RKP': 'rkpcomposites.com',
    'Eventuri': 'eventuri.net',
    'Wagner Tuning': 'wagnertuning.com',
    'Forge Motorsport': 'forgemotorsport.com',
    'Burger Motorsports': 'burgertuning.com',
    'Active Autowerke': 'activeautowerke.com',
    'ESS Tuning': 'esstuning.com',
    'VF Engineering': 'vf-engineering.com',
    'Fabspeed': 'fabspeed.com',
    'Soul Performance': 'soulpp.com',
    'Agency Power': 'agency-power.com',
    'Vivid Racing': 'vividracing.com',
    'IND Distribution': 'ind-distribution.com',
    'EAS': 'enthusiastauto.com',
    'Turner Motorsport': 'turnermotorsport.com',
    'BimmerWorld': 'bimmerworld.com',
    'Macht Schnell': 'machtschnell.com',
    'Eisenmann': 'eisenmann.com',
    'Kline Innovation': 'klineinnovation.com',
    'Frequency Intelligent': 'frequencyintelligent.com',
    'Boden Autohaus': 'bodenautohaus.com',
    'RW Carbon': 'rwcarbon.com',
    'PSM Dynamic': 'psm-dynamic.com',
    '1016 Industries': '1016industries.com',
    'Zacoe': 'zacoe.com',
    'Future Design': 'futuredesign-carbon.com',
    'Mode Carbon': 'modecarbon.com',
    'Morph Auto Design': 'morphautodesign.com',
    'Arqray': 'arqray.com',
    '3DDesign': '3ddesign.jp',
    'Akra': 'akrapovic.com',
}

# Slugify helper
def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[&]', 'and', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

# Get brand list
def get_brands() -> List[str]:
    """Get list of all brands"""
    brands = list(BRAND_DOMAINS.keys())
    
    # Also try reading from brands-list.json
    if BRANDS_FILE.exists():
        try:
            with open(BRANDS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'categories' in data:
                    for cat_brands in data['categories'].values():
                        brands.extend(cat_brands)
        except:
            pass
    
    return list(set(brands))

class LogoFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.results: Dict[str, str] = {}
        self.failed: List[str] = []
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/svg+xml,image/webp,image/png,image/*,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        
    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=15, connect=5)
        connector = aiohttp.TCPConnector(limit=50, limit_per_host=10)
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector,
            headers=self.headers
        )
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def fetch_url(self, url: str) -> Optional[bytes]:
        """Fetch URL with retries"""
        for attempt in range(2):
            try:
                async with self.session.get(url, allow_redirects=True, ssl=False) as resp:
                    if resp.status == 200:
                        content = await resp.read()
                        if len(content) > 100:  # Minimum valid size
                            return content
            except Exception:
                await asyncio.sleep(0.5)
        return None

    def is_valid_svg(self, content: bytes) -> bool:
        """Check if content is valid SVG"""
        try:
            text = content.decode('utf-8', errors='ignore')[:500]
            return '<svg' in text.lower() or '<?xml' in text.lower()
        except:
            return False

    def is_valid_png(self, content: bytes) -> bool:
        """Check if content is valid PNG"""
        return content[:8] == b'\x89PNG\r\n\x1a\n'

    def is_valid_image(self, content: bytes) -> Tuple[bool, str]:
        """Check image type and validity"""
        if self.is_valid_svg(content):
            return True, 'svg'
        if self.is_valid_png(content):
            return True, 'png'
        # Check WebP
        if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
            return True, 'webp'
        # Check JPEG
        if content[:2] == b'\xff\xd8':
            return True, 'jpg'
        return False, ''

    async def try_brandfetch(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Try Brandfetch CDN"""
        urls = [
            f"https://cdn.brandfetch.io/{domain}/w/400/h/400/logo?c=1id_zeCAiaj7c_WBP5H",
            f"https://cdn.brandfetch.io/{domain}/w/512/h/512/logo",
            f"https://cdn.brandfetch.io/{domain}/logo",
            f"https://asset.brandfetch.io/id{domain}/logo/symbol",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content:
                valid, fmt = self.is_valid_image(content)
                if valid:
                    return content, fmt
        return None

    async def try_clearbit(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Try Clearbit Logo API"""
        urls = [
            f"https://logo.clearbit.com/{domain}?size=512",
            f"https://logo.clearbit.com/{domain}?size=256",
            f"https://logo.clearbit.com/{domain}",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content:
                valid, fmt = self.is_valid_image(content)
                if valid and len(content) > 1000:  # Skip tiny placeholders
                    return content, fmt
        return None

    async def try_google_favicon(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Try Google Favicon service"""
        urls = [
            f"https://www.google.com/s2/favicons?domain={domain}&sz=256",
            f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
            f"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://{domain}&size=256",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content:
                valid, fmt = self.is_valid_image(content)
                if valid and len(content) > 500:
                    return content, fmt
        return None

    async def try_duckduckgo(self, brand: str) -> Optional[Tuple[bytes, str]]:
        """Try DuckDuckGo Icons API"""
        domain = BRAND_DOMAINS.get(brand, f"{slugify(brand)}.com")
        url = f"https://icons.duckduckgo.com/ip3/{domain}.ico"
        content = await self.fetch_url(url)
        if content:
            valid, fmt = self.is_valid_image(content)
            if valid and len(content) > 500:
                return content, 'ico'
        return None

    async def try_unavatar(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Try Unavatar service - aggregates multiple sources"""
        urls = [
            f"https://unavatar.io/{domain}?fallback=false",
            f"https://unavatar.io/google/{domain}?fallback=false",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content:
                valid, fmt = self.is_valid_image(content)
                if valid and len(content) > 1000:
                    return content, fmt
        return None

    async def try_simple_icons(self, brand: str) -> Optional[Tuple[bytes, str]]:
        """Try Simple Icons CDN for SVG"""
        slug = slugify(brand).replace('-', '')
        urls = [
            f"https://cdn.simpleicons.org/{slug}",
            f"https://cdn.simpleicons.org/{slug}/white",
            f"https://simpleicons.org/icons/{slug}.svg",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content and self.is_valid_svg(content):
                return content, 'svg'
        return None

    async def try_svgporn(self, brand: str) -> Optional[Tuple[bytes, str]]:
        """Try SVGPorn for SVG logos"""
        slug = slugify(brand)
        urls = [
            f"https://cdn.svgporn.com/logos/{slug}.svg",
            f"https://cdn.svgporn.com/logos/{slug}-icon.svg",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content and self.is_valid_svg(content):
                return content, 'svg'
        return None

    async def try_world_vector_logo(self, brand: str) -> Optional[Tuple[bytes, str]]:
        """Try WorldVectorLogo"""
        slug = slugify(brand)
        urls = [
            f"https://cdn.worldvectorlogo.com/logos/{slug}.svg",
            f"https://cdn.worldvectorlogo.com/logos/{slug}-1.svg",
            f"https://cdn.worldvectorlogo.com/logos/{slug}-2.svg",
        ]
        for url in urls:
            content = await self.fetch_url(url)
            if content and self.is_valid_svg(content):
                return content, 'svg'
        return None

    async def try_logo_dev(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Try Logo.dev API"""
        url = f"https://img.logo.dev/{domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ"
        content = await self.fetch_url(url)
        if content:
            valid, fmt = self.is_valid_image(content)
            if valid:
                return content, fmt
        return None

    async def try_website_scrape(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Scrape logo directly from website"""
        try:
            url = f"https://{domain}"
            async with self.session.get(url, allow_redirects=True, ssl=False) as resp:
                if resp.status != 200:
                    return None
                html = await resp.text()
            
            soup = BeautifulSoup(html, 'lxml')
            
            # Look for logo in common places
            logo_selectors = [
                'link[rel*="icon"][sizes="192x192"]',
                'link[rel*="icon"][sizes="180x180"]',
                'link[rel*="apple-touch-icon"]',
                'meta[property="og:image"]',
                'img[class*="logo"]',
                'img[id*="logo"]',
                'img[alt*="logo"]',
                'a[class*="logo"] img',
                'header img',
                '.logo img',
                '#logo img',
            ]
            
            for selector in logo_selectors:
                elem = soup.select_one(selector)
                if elem:
                    img_url = elem.get('href') or elem.get('content') or elem.get('src')
                    if img_url:
                        if not img_url.startswith('http'):
                            img_url = urljoin(f"https://{domain}", img_url)
                        
                        content = await self.fetch_url(img_url)
                        if content:
                            valid, fmt = self.is_valid_image(content)
                            if valid and len(content) > 500:
                                return content, fmt
            
        except Exception:
            pass
        return None

    async def fetch_brand_logo(self, brand: str) -> Optional[str]:
        """Fetch logo using all available methods"""
        slug = slugify(brand)
        domain = BRAND_DOMAINS.get(brand, f"{slug}.com")
        
        # Check if already exists as SVG
        svg_path = LOGOS_DIR / f"{slug}.svg"
        if svg_path.exists() and svg_path.stat().st_size > 100:
            return f"{slug}.svg"
        
        print(f"  🔍 {brand} ({domain})")
        
        # Try sources in priority order (SVG first)
        sources = [
            ("SimpleIcons", lambda: self.try_simple_icons(brand)),
            ("SVGPorn", lambda: self.try_svgporn(brand)),
            ("WorldVector", lambda: self.try_world_vector_logo(brand)),
            ("Brandfetch", lambda: self.try_brandfetch(domain)),
            ("Logo.dev", lambda: self.try_logo_dev(domain)),
            ("Clearbit", lambda: self.try_clearbit(domain)),
            ("Unavatar", lambda: self.try_unavatar(domain)),
            ("Google", lambda: self.try_google_favicon(domain)),
            ("DuckDuckGo", lambda: self.try_duckduckgo(brand)),
            ("Website", lambda: self.try_website_scrape(domain)),
        ]
        
        for source_name, fetcher in sources:
            try:
                result = await fetcher()
                if result:
                    content, fmt = result
                    
                    # Convert ICO/JPG to PNG for consistency
                    if fmt in ('ico', 'jpg'):
                        try:
                            img = Image.open(BytesIO(content))
                            if img.mode != 'RGBA':
                                img = img.convert('RGBA')
                            buf = BytesIO()
                            img.save(buf, 'PNG', optimize=True)
                            content = buf.getvalue()
                            fmt = 'png'
                        except:
                            continue
                    
                    # Save file
                    filename = f"{slug}.{fmt}"
                    filepath = LOGOS_DIR / filename
                    
                    async with aiofiles.open(filepath, 'wb') as f:
                        await f.write(content)
                    
                    size_kb = len(content) / 1024
                    print(f"    ✅ {source_name} → {filename} ({size_kb:.1f}KB)")
                    return filename
                    
            except Exception as e:
                continue
        
        print(f"    ❌ No logo found")
        return None

    async def process_all_brands(self, brands: List[str]):
        """Process all brands with concurrency"""
        LOGOS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Process in batches for better rate limiting
        batch_size = 10
        for i in range(0, len(brands), batch_size):
            batch = brands[i:i + batch_size]
            tasks = [self.fetch_brand_logo(brand) for brand in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for brand, result in zip(batch, results):
                if isinstance(result, str):
                    self.results[brand] = result
                elif result is None:
                    self.failed.append(brand)
            
            # Small delay between batches
            await asyncio.sleep(0.5)

def update_brand_logos_ts(results: Dict[str, str]):
    """Update brandLogos.ts with new logos"""
    brand_logos_path = PROJECT_DIR / "src" / "lib" / "brandLogos.ts"
    
    if not brand_logos_path.exists():
        print("⚠️ brandLogos.ts not found")
        return
    
    content = brand_logos_path.read_text(encoding='utf-8')
    
    updated = 0
    for brand, filename in results.items():
        logo_path = f"/logos/{filename}"
        escaped_brand = brand.replace("'", "\\'")
        
        # Try to update existing entry
        pattern = rf"'{re.escape(escaped_brand)}':\s*'[^']*'"
        if re.search(pattern, content, re.IGNORECASE):
            content = re.sub(pattern, f"'{escaped_brand}': '{logo_path}'", content, flags=re.IGNORECASE)
            updated += 1
        else:
            # Add new entry after opening brace
            insert_point = content.find('= {') + 3
            content = content[:insert_point] + f"\n  '{escaped_brand}': '{logo_path}'," + content[insert_point:]
            updated += 1
    
    brand_logos_path.write_text(content, encoding='utf-8')
    print(f"\n📝 Updated {updated} entries in brandLogos.ts")

async def main():
    print("""
╔════════════════════════════════════════════════════════════════╗
║         🚀 ULTRA LOGO FETCHER - Maximum Speed Edition          ║
║         Sources: SimpleIcons, Brandfetch, Clearbit,            ║
║                  Logo.dev, Unavatar, Google, DDG               ║
╚════════════════════════════════════════════════════════════════╝
""")
    
    brands = get_brands()
    print(f"📋 Found {len(brands)} brands to process\n")
    
    async with LogoFetcher() as fetcher:
        await fetcher.process_all_brands(brands)
        
        # Stats
        svg_count = sum(1 for f in fetcher.results.values() if f.endswith('.svg'))
        png_count = sum(1 for f in fetcher.results.values() if f.endswith('.png'))
        webp_count = sum(1 for f in fetcher.results.values() if f.endswith('.webp'))
        
        print(f"""
╔════════════════════════════════════════════════════════════════╗
║                        📊 RESULTS                              ║
╠════════════════════════════════════════════════════════════════╣
║  SVG logos:        {svg_count:4}                                       ║
║  PNG logos:        {png_count:4}                                       ║
║  WebP logos:       {webp_count:4}                                       ║
║  Failed:           {len(fetcher.failed):4}                                       ║
╠════════════════════════════════════════════════════════════════╣
║  Total downloaded: {len(fetcher.results):4}                                       ║
╚════════════════════════════════════════════════════════════════╝
""")
        
        if fetcher.results:
            update_brand_logos_ts(fetcher.results)
        
        if fetcher.failed:
            print("\n❌ Failed brands:")
            for brand in fetcher.failed[:20]:
                print(f"   • {brand}")
            if len(fetcher.failed) > 20:
                print(f"   ... and {len(fetcher.failed) - 20} more")

if __name__ == "__main__":
    asyncio.run(main())
