"""
🔥 MEGA LOGO FETCHER - Multiple Sources with Validation
Uses: Brandfetch, Clearbit, SimpleIcons, Google, DDG, and more
Validates that SVG is real (not placeholder)

Run: python scripts/mega_logo_fetcher.py
"""

import asyncio
import aiohttp
import aiofiles
import re
from pathlib import Path
from typing import Optional, Tuple

# API Keys
BRAND_API_KEY = "pAQhwqzcVnLMwEUp6KnGodfstOoPOuAJt97b2va0Prk="

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# Brands with domains
BRANDS = {
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
    'Weistec': 'weistec.com',
    'Brabus': 'brabus.com',
    'ABT': 'abt-sportsline.com',
    'Techart': 'techart.de',
    'AC Schnitzer': 'ac-schnitzer.de',
    'Hamann': 'hamann-motorsport.de',
    'Lorinser': 'lorinser.com',
    'Carlsson': 'carlsson.de',
    'G-Power': 'g-power.de',
    'Alpha-N': 'alpha-n.de',
    'Novitec': 'novitecgroup.com',
    'Mansory': 'mansory.com',
    'IPE': 'ipe-exhaust.com',
    'Fi Exhaust': 'fi-exhaust.com',
    'Capristo': 'capristo.de',
    'Borla': 'borla.com',
    'MagnaFlow': 'magnaflow.com',
    'Flowmaster': 'flowmastermufflers.com',
    'Milltek': 'millteksport.com',
    'Remus': 'remus.eu',
    'Supersprint': 'supersprint.com',
    'AWE': 'awe-tuning.com',
    'BBS': 'bbs.com',
    'OZ Racing': 'ozracing.com',
    'Vossen': 'vossen.com',
    'Forgiato': 'forgiato.com',
    'ADV.1': 'adv1wheels.com',
    'Rotiform': 'rotiform.com',
    'fifteen52': 'fifteen52.com',
    'Bilstein': 'bilstein.com',
    'Ohlins': 'ohlins.com',
    'H&R': 'h-r.com',
    'Eibach': 'eibach.com',
    'Air Lift': 'airliftperformance.com',
    'StopTech': 'stoptech.com',
    'AP Racing': 'apracing.com',
    'APR': 'goapr.com',
    'COBB': 'cobbtuning.com',
    'Unitronic': 'getunitronic.com',
    'Dinan': 'dinancars.com',
    'Seibon': 'seibon.com',
    'RKP': 'rkpcomposites.com',
    '3D Design': '3ddesign.jp',
    'Hennessey': 'hennesseyperformance.com',
    'Roush': 'roushperformance.com',
    'Shelby': 'shelby.com',
    'Liberty Walk': 'libertywalk.co.jp',
    'SC Project': 'sc-project.com',
    'Termignoni': 'termignoni.it',
    'Arrow': 'arrow.it',
    'Yoshimura': 'yoshimura-jp.com',
    'Rizoma': 'rizoma.com',
    'Wagner Tuning': 'wagnertuning.com',
    'Forge Motorsport': 'forgemotorsport.com',
    'Vivid Racing': 'vividracing.com',
    'Rays': 'rayswheels.co.jp',
    'Work Wheels': 'workwheels.com',
    'Enkei': 'enkei.com',
    'Tein': 'tein.com',
    'BC Racing': 'bcracing.com',
    'Alcon': 'alcon.co.uk',
    'LeoVince': 'leovince.com',
    'Accuair': 'accuair.com',
    'Titan 7': 'titan7.com',
    'BC Forged': 'bcforged.com',
    'Brixton Forged': 'brixtonforged.com',
    'Ferrada': 'ferradawheels.com',
    'Saleen': 'saleen.com',
    'Rocket Bunny': 'tra-kyoto.com',
    'Varis': 'varisna.com',
    'Turner Motorsport': 'turnermotorsport.com',
    '1016 Industries': '1016industries.com',
    'Sterckenn': 'sterckenn.com',
    'RW Carbon': 'rwcarbon.com',
    'ESS Tuning': 'esstuning.com',
    'VF Engineering': 'vf-engineering.com',
    'Burger Motorsports': 'burgertuning.com',
    'Fabspeed': 'fabspeed.com',
    'Soul Performance': 'soulpp.com',
    'Eisenmann': 'eisenmann.com',
}

def slugify(text: str) -> str:
    text = text.lower().replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def is_valid_svg(content: bytes) -> bool:
    """Check if SVG is valid (not placeholder)"""
    if len(content) < 100:
        return False
    # Placeholder SVGs are usually 209KB or have certain patterns
    if len(content) > 200000:
        return False
    try:
        text = content.decode('utf-8', errors='ignore')
        if '<svg' not in text.lower():
            return False
        # Check for actual content (paths, shapes, etc)
        if '<path' in text or '<g' in text or '<rect' in text or '<polygon' in text or '<circle' in text:
            return True
    except:
        pass
    return False


def is_valid_png(content: bytes) -> bool:
    """Check if PNG is valid"""
    if len(content) < 500:
        return False
    return content[:8] == b'\x89PNG\r\n\x1a\n'


class MegaFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.results = {}
        self.failed = []

    async def __aenter__(self):
        timeout = aiohttp.ClientTimeout(total=15)
        connector = aiohttp.TCPConnector(limit=30, ssl=False)
        self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
        return self

    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def fetch(self, url: str, headers: dict = None) -> Optional[bytes]:
        """Fetch URL"""
        try:
            hdrs = headers or {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120'}
            async with self.session.get(url, headers=hdrs, allow_redirects=True) as resp:
                if resp.status == 200:
                    return await resp.read()
        except:
            pass
        return None

    async def try_brandfetch_api(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Brandfetch official API"""
        url = f"https://api.brandfetch.io/v2/brands/{domain}"
        headers = {'Authorization': f'Bearer {BRAND_API_KEY}'}
        try:
            async with self.session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Look for SVG first
                    for logo in data.get('logos', []):
                        for fmt in logo.get('formats', []):
                            if fmt.get('format') == 'svg':
                                src = fmt.get('src')
                                if src:
                                    content = await self.fetch(src)
                                    if content and is_valid_svg(content):
                                        return content, 'svg'
                    # Then PNG
                    for logo in data.get('logos', []):
                        for fmt in logo.get('formats', []):
                            if fmt.get('format') == 'png':
                                src = fmt.get('src')
                                if src:
                                    content = await self.fetch(src)
                                    if content and is_valid_png(content):
                                        return content, 'png'
        except:
            pass
        return None

    async def try_clearbit(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Clearbit Logo API"""
        for size in [512, 256, 128]:
            url = f"https://logo.clearbit.com/{domain}?size={size}"
            content = await self.fetch(url)
            if content and is_valid_png(content) and len(content) > 1000:
                return content, 'png'
        return None

    async def try_simple_icons(self, brand: str) -> Optional[Tuple[bytes, str]]:
        """SimpleIcons CDN for SVG"""
        slug = slugify(brand).replace('-', '')
        urls = [
            f"https://cdn.simpleicons.org/{slug}",
            f"https://cdn.simpleicons.org/{slug}/white",
        ]
        for url in urls:
            content = await self.fetch(url)
            if content and is_valid_svg(content):
                return content, 'svg'
        return None

    async def try_google_favicon(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Google Favicon HD"""
        urls = [
            f"https://www.google.com/s2/favicons?domain={domain}&sz=256",
            f"https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://{domain}&size=256",
        ]
        for url in urls:
            content = await self.fetch(url)
            if content and is_valid_png(content) and len(content) > 500:
                return content, 'png'
        return None

    async def try_duckduckgo(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """DuckDuckGo Icons"""
        url = f"https://icons.duckduckgo.com/ip3/{domain}.ico"
        content = await self.fetch(url)
        if content and len(content) > 500:
            return content, 'ico'
        return None

    async def try_unavatar(self, domain: str) -> Optional[Tuple[bytes, str]]:
        """Unavatar aggregator"""
        url = f"https://unavatar.io/{domain}?fallback=false"
        content = await self.fetch(url)
        if content and is_valid_png(content) and len(content) > 1000:
            return content, 'png'
        return None

    async def process_brand(self, brand: str, domain: str) -> Optional[str]:
        """Try all sources for a brand"""
        slug = slugify(brand)
        print(f"  ⚡ {brand}", end=" ", flush=True)

        # Check if good file exists
        for ext in ['svg', 'png', 'webp']:
            path = LOGOS_DIR / f"{slug}.{ext}"
            if path.exists():
                size = path.stat().st_size
                if ext == 'svg' and 100 < size < 200000:
                    print(f"✓ exists ({size//1024}KB)")
                    return f"{slug}.{ext}"
                elif ext != 'svg' and size > 500:
                    print(f"✓ exists ({size//1024}KB)")
                    return f"{slug}.{ext}"

        # Try sources in priority order
        sources = [
            ('Brandfetch', self.try_brandfetch_api(domain)),
            ('Clearbit', self.try_clearbit(domain)),
            ('SimpleIcons', self.try_simple_icons(brand)),
            ('Unavatar', self.try_unavatar(domain)),
            ('Google', self.try_google_favicon(domain)),
            ('DDG', self.try_duckduckgo(domain)),
        ]

        for name, coro in sources:
            result = await coro
            if result:
                content, fmt = result
                
                # Convert ICO to PNG
                if fmt == 'ico':
                    try:
                        from PIL import Image
                        from io import BytesIO
                        img = Image.open(BytesIO(content))
                        if img.mode != 'RGBA':
                            img = img.convert('RGBA')
                        buf = BytesIO()
                        img.save(buf, 'PNG')
                        content = buf.getvalue()
                        fmt = 'png'
                    except:
                        continue

                filename = f"{slug}.{fmt}"
                filepath = LOGOS_DIR / filename
                
                async with aiofiles.open(filepath, 'wb') as f:
                    await f.write(content)
                
                icon = "🎯" if fmt == 'svg' else "📷"
                print(f"{icon} {name} ({len(content)//1024}KB)")
                return filename

        print("❌")
        return None

    async def run(self):
        """Process all brands"""
        LOGOS_DIR.mkdir(parents=True, exist_ok=True)
        
        for brand, domain in BRANDS.items():
            result = await self.process_brand(brand, domain)
            if result:
                self.results[brand] = result
            else:
                self.failed.append(brand)
            await asyncio.sleep(0.3)  # Rate limiting


def update_brand_logos_ts(results):
    """Update brandLogos.ts"""
    path = PROJECT_DIR / "src" / "lib" / "brandLogos.ts"
    if not path.exists():
        return
    
    content = path.read_text(encoding='utf-8')
    updated = 0
    
    for brand, filename in results.items():
        logo_path = f"/logos/{filename}"
        escaped = brand.replace("'", "\\'")
        pattern = rf"'{re.escape(escaped)}':\s*'[^']*'"
        
        if re.search(pattern, content, re.IGNORECASE):
            content = re.sub(pattern, f"'{escaped}': '{logo_path}'", content, flags=re.IGNORECASE)
            updated += 1
        else:
            insert = content.find('= {') + 3
            content = content[:insert] + f"\n  '{escaped}': '{logo_path}'," + content[insert:]
            updated += 1
    
    path.write_text(content, encoding='utf-8')
    print(f"\n📝 Updated {updated} entries in brandLogos.ts")


async def main():
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║          🔥 MEGA LOGO FETCHER - Multi-Source with Validation         ║
║          Sources: Brandfetch, Clearbit, SimpleIcons, Google          ║
╚═══════════════════════════════════════════════════════════════════════╝
""")
    print(f"📋 Processing {len(BRANDS)} brands...\n")
    
    async with MegaFetcher() as fetcher:
        await fetcher.run()
        
        svg_count = sum(1 for f in fetcher.results.values() if f.endswith('.svg'))
        png_count = sum(1 for f in fetcher.results.values() if f.endswith('.png'))
        
        print(f"""
╔═══════════════════════════════════════════════════════════════════════╗
║                            📊 RESULTS                                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║  🎯 SVG:           {svg_count:4}                                              ║
║  📷 PNG:           {png_count:4}                                              ║
║  ❌ Failed:        {len(fetcher.failed):4}                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  ✅ Total:         {len(fetcher.results):4}                                              ║
╚═══════════════════════════════════════════════════════════════════════╝
""")
        
        if fetcher.results:
            update_brand_logos_ts(fetcher.results)
        
        if fetcher.failed:
            print(f"\n❌ Failed: {', '.join(fetcher.failed)}")


if __name__ == "__main__":
    asyncio.run(main())
