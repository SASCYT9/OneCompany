"""
🚀 BRANDFETCH PRO LOGO FETCHER
Uses official Brandfetch API with your API key for highest quality SVG logos

Run: python scripts/brandfetch_pro.py
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
from io import BytesIO

# API Key
BRANDFETCH_API_KEY = "pAQhwqzcVnLMwEUp6KnGodfstOoPOuAJt97b2va0Prk="

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# All automotive brands with domains
BRANDS: Dict[str, str] = {
    # Top Featured
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
    
    # German Tuners
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
    
    # Exhaust Systems
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
    'Kline Innovation': 'klineinnovation.com',
    'Fabspeed': 'fabspeed.com',
    'Soul Performance': 'soulpp.com',
    
    # Wheels
    'BBS': 'bbs.com',
    'OZ Racing': 'ozracing.com',
    'Vossen': 'vfrwheels.com',
    'Forgiato': 'forgiato.com',
    'ADV.1': 'thewheelindustry.com',
    'Rotiform': 'rotiform.com',
    'fifteen52': 'fifteen52.com',
    'Rays': 'rayswheels.co.jp',
    'Work Wheels': 'work-wheels.co.jp',
    'Enkei': 'enkei.com',
    'SSR': 'ssr-wheels.com',
    'Titan 7': 'titan7.com',
    'Apex': 'apexraceparts.com',
    'BC Forged': 'bcforged.com',
    'Brixton Forged': 'brixtonforged.com',
    'Ferrada': 'ferradawheels.com',
    'Rohana': 'rohanawheels.com',
    
    # Suspension
    'Bilstein': 'bilstein.com',
    'Ohlins': 'ohlins.com',
    'H&R': 'h-r.com',
    'Eibach': 'eibach.com',
    'Air Lift': 'airliftperformance.com',
    'KW': 'kwsuspensions.com',
    'Tein': 'tein.com',
    'BC Racing': 'bcracing.com',
    'Fortune Auto': 'fortune-auto.com',
    'ST Suspensions': 'stsuspensions.com',
    'Accuair': 'accuair.com',
    'Airlift': 'airliftperformance.com',
    
    # Brakes
    'StopTech': 'stoptech.com',
    'AP Racing': 'apracing.com',
    'Alcon': 'alcon.co.uk',
    'Endless': 'endless-sport.co.jp',
    'Project Mu': 'projectmu.co.jp',
    
    # ECU/Tuning
    'APR': 'goapr.com',
    'COBB': 'cobbtuning.com',
    'Unitronic': 'getunitronic.com',
    'Dinan': 'dinancars.com',
    'Burger Motorsports': 'burgertuning.com',
    'Active Autowerke': 'activeautowerke.com',
    'ESS Tuning': 'esstuning.com',
    'VF Engineering': 'vf-engineering.com',
    'Eurocharged': 'eurocharged.com',
    'MHD': 'mhdtuning.com',
    'Bootmod3': 'protuningfreaks.com',
    
    # Carbon/Aero
    'Seibon': 'seibon.com',
    'RKP': 'rkpcomposites.com',
    '3D Design': '3ddesign.jp',
    'Sterckenn': 'sterckenn.com',
    'PSM Dynamic': 'psm-dynamic.com',
    'RW Carbon': 'rwcarbon.com',
    '1016 Industries': '1016industries.com',
    'Zacoe': 'zacoe.com',
    'Future Design': 'futuredesign-carbon.com',
    'Mode Carbon': 'modecarbon.com',
    'Morph Auto Design': 'morphautodesign.com',
    'Darwinpro': 'darwinproaero.com',
    'Karbel': 'karbelcarbon.com',
    'Vorsteiner': 'vorsteiner.com',
    
    # American Tuners
    'Hennessey': 'hennesseyperformance.com',
    'Roush': 'roush.com',
    'Shelby': 'shelby.com',
    'Saleen': 'saleen.com',
    'Lingenfelter': 'lingenfelter.com',
    
    # Japanese Style
    'Liberty Walk': 'libertywalk.co.jp',
    'Rocket Bunny': 'rocket-bunny.jp',
    'Pandem': 'pandem.jp',
    'Varis': 'varisna.com',
    'Top Secret': 'topsecret-jpn.com',
    
    # Moto Exhaust
    'SC Project': 'sc-project.com',
    'Termignoni': 'termignoni.it',
    'Arrow': 'arrow.it',
    'LeoVince': 'leovince.com',
    'Yoshimura': 'yoshimura-jp.com',
    'Two Brothers': 'twobros.com',
    
    # Moto Parts
    'Rotobox': 'rotobox.eu',
    'BST': 'blackstonetek.com',
    'Dymag': 'dymag.com',
    'Marchesini': 'marchesini.com',
    'Bonamici': 'bonamiciracing.it',
    'Rizoma': 'rizoma.com',
    'Lightech': 'lightech.it',
    'CNC Racing': 'cncracing.it',
    'Gilles Tooling': 'gillestooling.com',
    
    # Misc Performance
    'Wagner Tuning': 'wagnertuning.com',
    'Forge Motorsport': 'forgemotorsport.com',
    'Agency Power': 'agency-power.com',
    'Vivid Racing': 'vividracing.com',
    'Turner Motorsport': 'turnermotorsport.com',
    'BimmerWorld': 'bimmerworld.com',
    'EAS': 'enthusiastauto.com',
    'IND Distribution': 'ind-distribution.com',
}

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[&]', 'and', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

class BrandfetchPro:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.results: Dict[str, str] = {}
        self.failed: List[str] = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                'Authorization': f'Bearer {BRANDFETCH_API_KEY}',
                'Accept': 'application/json',
            }
        )
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.close()

    async def fetch_brand_data(self, domain: str) -> Optional[dict]:
        """Fetch brand data from Brandfetch API"""
        url = f"https://api.brandfetch.io/v2/brands/{domain}"
        try:
            async with self.session.get(url) as resp:
                if resp.status == 200:
                    return await resp.json()
                elif resp.status == 404:
                    return None
                else:
                    print(f"      ⚠️ API status {resp.status}")
                    return None
        except Exception as e:
            print(f"      ❌ Error: {e}")
            return None

    async def download_file(self, url: str) -> Optional[bytes]:
        """Download file from URL"""
        try:
            headers = {'User-Agent': 'Mozilla/5.0'}
            async with aiohttp.ClientSession() as sess:
                async with sess.get(url, headers=headers, ssl=False) as resp:
                    if resp.status == 200:
                        return await resp.read()
        except:
            pass
        return None

    def get_best_logo(self, data: dict) -> Optional[Tuple[str, str]]:
        """Extract best logo URL from brand data (prioritize SVG)"""
        logos = data.get('logos', [])
        
        best_svg = None
        best_png = None
        best_png_size = 0
        
        for logo in logos:
            formats = logo.get('formats', [])
            
            for fmt in formats:
                src = fmt.get('src', '')
                format_type = fmt.get('format', '')
                
                if not src:
                    continue
                
                # Prefer SVG
                if format_type == 'svg' or src.endswith('.svg'):
                    best_svg = src
                
                # Fallback to PNG - get largest
                elif format_type == 'png' or src.endswith('.png'):
                    width = fmt.get('width', 0) or 0
                    height = fmt.get('height', 0) or 0
                    size = width * height
                    if size > best_png_size or best_png is None:
                        best_png = src
                        best_png_size = size
        
        if best_svg:
            return best_svg, 'svg'
        if best_png:
            return best_png, 'png'
        
        return None

    async def process_brand(self, brand: str, domain: str) -> Optional[str]:
        """Process single brand"""
        slug = slugify(brand)
        
        # Check if SVG already exists
        svg_path = LOGOS_DIR / f"{slug}.svg"
        if svg_path.exists() and svg_path.stat().st_size > 200:
            print(f"  ✅ {brand} - SVG exists")
            return f"{slug}.svg"
        
        print(f"  🔍 {brand} ({domain})...")
        
        # Fetch from Brandfetch API
        data = await self.fetch_brand_data(domain)
        
        if not data:
            # Try alternative domains
            alt_domains = [
                domain.replace('.com', '.co'),
                domain.replace('.de', '.com'),
                domain.replace('.co.uk', '.com'),
                f"www.{domain}",
            ]
            for alt in alt_domains:
                data = await self.fetch_brand_data(alt)
                if data:
                    break
        
        if not data:
            print(f"      ❌ Not found in Brandfetch")
            return None
        
        # Get best logo
        logo_info = self.get_best_logo(data)
        if not logo_info:
            print(f"      ❌ No logo in response")
            return None
        
        url, fmt = logo_info
        
        # Download logo
        content = await self.download_file(url)
        if not content:
            print(f"      ❌ Failed to download")
            return None
        
        # Save
        filename = f"{slug}.{fmt}"
        filepath = LOGOS_DIR / filename
        
        async with aiofiles.open(filepath, 'wb') as f:
            await f.write(content)
        
        size_kb = len(content) / 1024
        print(f"      ✅ {filename} ({size_kb:.1f}KB) - {fmt.upper()}")
        return filename

    async def run(self):
        """Process all brands"""
        LOGOS_DIR.mkdir(parents=True, exist_ok=True)
        
        print(f"\n📋 Processing {len(BRANDS)} brands...\n")
        
        # Process with rate limiting (Brandfetch has limits)
        for brand, domain in BRANDS.items():
            result = await self.process_brand(brand, domain)
            if result:
                self.results[brand] = result
            else:
                self.failed.append(brand)
            
            # Rate limit: 2 requests per second
            await asyncio.sleep(0.5)
        
        return self.results, self.failed

def update_brand_logos_ts(results: Dict[str, str]):
    """Update brandLogos.ts"""
    brand_logos_path = PROJECT_DIR / "src" / "lib" / "brandLogos.ts"
    
    if not brand_logos_path.exists():
        print("⚠️ brandLogos.ts not found")
        return
    
    content = brand_logos_path.read_text(encoding='utf-8')
    
    updated = 0
    for brand, filename in results.items():
        logo_path = f"/logos/{filename}"
        escaped_brand = brand.replace("'", "\\'")
        
        pattern = rf"'{re.escape(escaped_brand)}':\s*'[^']*'"
        if re.search(pattern, content, re.IGNORECASE):
            content = re.sub(pattern, f"'{escaped_brand}': '{logo_path}'", content, flags=re.IGNORECASE)
            updated += 1
        else:
            insert_point = content.find('= {') + 3
            content = content[:insert_point] + f"\n  '{escaped_brand}': '{logo_path}'," + content[insert_point:]
            updated += 1
    
    brand_logos_path.write_text(content, encoding='utf-8')
    print(f"\n📝 Updated {updated} entries in brandLogos.ts")

async def main():
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║          🏆 BRANDFETCH PRO - Official API Integration             ║
║          High-quality SVG logos direct from source                ║
╚═══════════════════════════════════════════════════════════════════╝
""")
    
    async with BrandfetchPro() as fetcher:
        results, failed = await fetcher.run()
        
        svg_count = sum(1 for f in results.values() if f.endswith('.svg'))
        png_count = sum(1 for f in results.values() if f.endswith('.png'))
        
        print(f"""
╔═══════════════════════════════════════════════════════════════════╗
║                          📊 RESULTS                               ║
╠═══════════════════════════════════════════════════════════════════╣
║  SVG logos:        {svg_count:4}                                          ║
║  PNG logos:        {png_count:4}                                          ║
║  Failed:           {len(failed):4}                                          ║
╠═══════════════════════════════════════════════════════════════════╣
║  Total success:    {len(results):4}                                          ║
╚═══════════════════════════════════════════════════════════════════╝
""")
        
        if results:
            update_brand_logos_ts(results)
        
        if failed:
            print("\n❌ Failed brands (try manual):")
            for b in failed[:30]:
                print(f"   • {b}")

if __name__ == "__main__":
    asyncio.run(main())
