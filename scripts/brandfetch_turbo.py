"""
🚀 BRANDFETCH TURBO - Maximum Speed SVG Fetcher
Uses BOTH API keys for fastest downloads
Always downloads fresh SVG (overwrites existing)

Run: python scripts/brandfetch_turbo.py
"""

import asyncio
import aiohttp
import aiofiles
import os
import json
import re
from pathlib import Path
from typing import Optional, Dict, List

# API Keys
BRAND_API_KEY = "pAQhwqzcVnLMwEUp6KnGodfstOoPOuAJt97b2va0Prk="
LOGO_API_CLIENT_ID = "1idyH0p6IxR3s4rkyyc"

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# All brands
BRANDS: Dict[str, str] = {
    # Featured
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
    # German
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
    # Exhaust
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
    'Eisenmann': 'eisenmann.com',
    'Fabspeed': 'fabspeed.com',
    'Soul Performance': 'soulpp.com',
    # Wheels
    'BBS': 'bbs.com',
    'OZ Racing': 'ozracing.com',
    'Vossen': 'vossen.com',
    'Forgiato': 'forgiato.com',
    'ADV.1': 'adv1wheels.com',
    'Rotiform': 'rotiform.com',
    'fifteen52': 'fifteen52.com',
    'Rays': 'rayswheels.co.jp',
    'Work Wheels': 'workwheels.com',
    'Enkei': 'enkei.com',
    'Titan 7': 'titan7.com',
    'Apex': 'apexraceparts.com',
    'BC Forged': 'bcforged.com',
    'Brixton Forged': 'brixtonforged.com',
    'Ferrada': 'ferradawheels.com',
    # Suspension
    'Bilstein': 'bilstein.com',
    'Ohlins': 'ohlins.com',
    'H&R': 'h-r.com',
    'Eibach': 'eibach.com',
    'Air Lift': 'airliftperformance.com',
    'Tein': 'tein.com',
    'BC Racing': 'bcracing.com',
    'KW Suspensions': 'kwsuspensions.com',
    'Accuair': 'accuair.com',
    # Brakes
    'StopTech': 'stoptech.com',
    'AP Racing': 'apracing.com',
    'Alcon': 'alcon.co.uk',
    # ECU
    'APR': 'goapr.com',
    'COBB': 'cobbtuning.com',
    'Unitronic': 'getunitronic.com',
    'Dinan': 'dinancars.com',
    'Burger Motorsports': 'burgertuning.com',
    'ESS Tuning': 'esstuning.com',
    'VF Engineering': 'vf-engineering.com',
    # Carbon
    'Seibon': 'seibon.com',
    'RKP': 'rkpcomposites.com',
    '3D Design': '3ddesign.jp',
    'Sterckenn': 'sterckenn.com',
    'RW Carbon': 'rwcarbon.com',
    '1016 Industries': '1016industries.com',
    # American
    'Hennessey': 'hennesseyperformance.com',
    'Roush': 'roushperformance.com',
    'Shelby': 'shelby.com',
    'Saleen': 'saleen.com',
    # Japanese
    'Liberty Walk': 'libertywalk.co.jp',
    'Rocket Bunny': 'rocket-bunny.jp',
    'Varis': 'varisna.com',
    # Moto
    'SC Project': 'sc-project.com',
    'Termignoni': 'termignoni.it',
    'Arrow': 'arrow.it',
    'LeoVince': 'leovince.com',
    'Yoshimura': 'yoshimura-jp.com',
    'Rizoma': 'rizoma.com',
    # Other
    'Wagner Tuning': 'wagnertuning.com',
    'Forge Motorsport': 'forgemotorsport.com',
    'Vivid Racing': 'vividracing.com',
    'Turner Motorsport': 'turnermotorsport.com',
}

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[&]', 'and', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')


async def fetch_with_logo_api(session: aiohttp.ClientSession, domain: str) -> Optional[bytes]:
    """Use Logo API (image endpoint) - FAST"""
    url = f"https://api.brandfetch.io/v2/brands/{domain}/logo"
    headers = {'Authorization': f'Bearer {LOGO_API_CLIENT_ID}'}
    try:
        async with session.get(url, headers=headers, ssl=False) as resp:
            if resp.status == 200:
                data = await resp.json()
                # Get SVG from response
                for logo in data if isinstance(data, list) else [data]:
                    if isinstance(logo, dict):
                        for fmt in logo.get('formats', []):
                            if fmt.get('format') == 'svg':
                                src = fmt.get('src')
                                if src:
                                    async with session.get(src, ssl=False) as img_resp:
                                        if img_resp.status == 200:
                                            return await img_resp.read()
    except:
        pass
    return None


async def fetch_with_brand_api(session: aiohttp.ClientSession, domain: str) -> Optional[tuple]:
    """Use Brand API - detailed info"""
    url = f"https://api.brandfetch.io/v2/brands/{domain}"
    headers = {'Authorization': f'Bearer {BRAND_API_KEY}'}
    try:
        async with session.get(url, headers=headers, ssl=False) as resp:
            if resp.status == 200:
                data = await resp.json()
                logos = data.get('logos', [])
                
                # Find best SVG
                for logo in logos:
                    for fmt in logo.get('formats', []):
                        if fmt.get('format') == 'svg':
                            src = fmt.get('src')
                            if src:
                                async with session.get(src, ssl=False) as img_resp:
                                    if img_resp.status == 200:
                                        content = await img_resp.read()
                                        if b'<svg' in content or b'<?xml' in content:
                                            return content, 'svg'
                
                # Fallback to PNG
                best_png = None
                best_size = 0
                for logo in logos:
                    for fmt in logo.get('formats', []):
                        if fmt.get('format') == 'png':
                            w = fmt.get('width', 0) or 0
                            h = fmt.get('height', 0) or 0
                            if w * h > best_size:
                                best_size = w * h
                                best_png = fmt.get('src')
                
                if best_png:
                    async with session.get(best_png, ssl=False) as img_resp:
                        if img_resp.status == 200:
                            return await img_resp.read(), 'png'
    except Exception as e:
        pass
    return None


async def fetch_cdn_direct(session: aiohttp.ClientSession, domain: str) -> Optional[tuple]:
    """Direct CDN fetch - fastest"""
    urls = [
        f"https://cdn.brandfetch.io/{domain}/w/512/h/512/logo?c=1id{LOGO_API_CLIENT_ID}",
        f"https://cdn.brandfetch.io/{domain}/logo",
        f"https://cdn.brandfetch.io/{domain}/symbol",
        f"https://cdn.brandfetch.io/{domain}/icon",
    ]
    for url in urls:
        try:
            async with session.get(url, ssl=False, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 200:
                    content = await resp.read()
                    if len(content) > 500:
                        if b'<svg' in content:
                            return content, 'svg'
                        elif content[:8] == b'\x89PNG\r\n\x1a\n':
                            return content, 'png'
        except:
            continue
    return None


async def process_brand(session: aiohttp.ClientSession, brand: str, domain: str, semaphore: asyncio.Semaphore) -> Optional[str]:
    """Process single brand - try all methods"""
    async with semaphore:
        slug = slugify(brand)
        print(f"  ⚡ {brand}", end=" ", flush=True)
        
        result = None
        
        # Method 1: Brand API (best quality SVG)
        result = await fetch_with_brand_api(session, domain)
        
        # Method 2: CDN direct
        if not result:
            result = await fetch_cdn_direct(session, domain)
        
        if result:
            content, fmt = result
            filename = f"{slug}.{fmt}"
            filepath = LOGOS_DIR / filename
            
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(content)
            
            size_kb = len(content) / 1024
            icon = "🎯" if fmt == 'svg' else "📷"
            print(f"{icon} {fmt.upper()} ({size_kb:.1f}KB)")
            return filename
        else:
            print("❌")
            return None


async def main():
    print("""
╔═══════════════════════════════════════════════════════════════════════╗
║            ⚡ BRANDFETCH TURBO - Dual API Power                       ║
║            Downloads fresh SVG logos (overwrites all)                 ║
╚═══════════════════════════════════════════════════════════════════════╝
""")
    
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    
    # High concurrency
    semaphore = asyncio.Semaphore(15)
    
    connector = aiohttp.TCPConnector(limit=50, limit_per_host=20)
    timeout = aiohttp.ClientTimeout(total=30)
    
    results = {}
    failed = []
    
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        print(f"📋 Processing {len(BRANDS)} brands...\n")
        
        tasks = []
        for brand, domain in BRANDS.items():
            task = process_brand(session, brand, domain, semaphore)
            tasks.append((brand, task))
        
        for brand, task in tasks:
            result = await task
            if result:
                results[brand] = result
            else:
                failed.append(brand)
    
    # Stats
    svg_count = sum(1 for f in results.values() if f.endswith('.svg'))
    png_count = sum(1 for f in results.values() if f.endswith('.png'))
    
    print(f"""
╔═══════════════════════════════════════════════════════════════════════╗
║                            📊 RESULTS                                 ║
╠═══════════════════════════════════════════════════════════════════════╣
║  🎯 SVG logos:     {svg_count:4}                                              ║
║  📷 PNG logos:     {png_count:4}                                              ║
║  ❌ Failed:        {len(failed):4}                                              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  ✅ Total:         {len(results):4}                                              ║
╚═══════════════════════════════════════════════════════════════════════╝
""")
    
    # Update brandLogos.ts
    if results:
        brand_logos_path = PROJECT_DIR / "src" / "lib" / "brandLogos.ts"
        if brand_logos_path.exists():
            content = brand_logos_path.read_text(encoding='utf-8')
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
            brand_logos_path.write_text(content, encoding='utf-8')
            print(f"📝 Updated {updated} entries in brandLogos.ts")
    
    if failed:
        print(f"\n❌ Failed ({len(failed)}):", ", ".join(failed[:15]))


if __name__ == "__main__":
    asyncio.run(main())
