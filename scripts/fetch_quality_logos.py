#!/usr/bin/env python3
"""
High-Quality Logo Fetcher for Automotive Tuning Brands
=======================================================
Priority: SVG first, then high-quality PNG (transparent background)

Sources (in order of priority):
1. WorldVectorLogo (excellent SVG source)
2. Official website scraping  
3. SeekLogo
4. Simple Icons
5. Clearbit (PNG fallback, good quality)

Requirements:
    pip install httpx beautifulsoup4 aiofiles pillow lxml

Usage:
    python fetch_quality_logos.py --all --concurrency 10
    python fetch_quality_logos.py --brand "Akrapovic"
"""

import asyncio
import json
import os
import re
import sys
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass
from urllib.parse import quote_plus, urljoin
import time

try:
    import httpx
    from bs4 import BeautifulSoup
    import aiofiles
    from PIL import Image
    import io
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Please run: pip install httpx beautifulsoup4 aiofiles pillow lxml")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_ROOT / "public" / "logos"
BRANDS_FILE = PROJECT_ROOT / "src" / "lib" / "brands.ts"

# Known official domains for brands
BRAND_DOMAINS: Dict[str, str] = {
    # USA Tuning
    "1221 wheels": "1221wheels.com",
    "1016 Industries": "1016industries.com",
    "5150 Autosport": "5150autosport.com",
    "AE Design": "aedesign.com",
    "ADV.1 wheels": "adv1wheels.com",
    "Agency Power": "agencypower.com",
    "Airlift Performance": "airliftperformance.com",
    "AL13 wheels": "al13wheels.com",
    "AMS / Alpha Performance": "aboracing.com",
    "American Racing Headers": "americanracingheaders.com",
    "ANRKY wheels": "anrkywheels.com",
    "APR": "goapr.com",
    "Avantgarde Wheels": "avantgardewheels.com",
    "BE bearings": "bearacing.com",
    "BBi Autosport": "bbiautosport.com",
    "Big Boost": "bigboostfab.com",
    "BimmerWorld": "bimmerworld.com",
    "BootMod3": "bootmod3.com",
    "Borla": "borla.com",
    "Brixton wheels": "brixtonforged.com",
    "Burger Motorsport": "burgertuning.com",
    "Circle D": "circled.com",
    "Cobb tuning": "cobbtuning.com",
    "CMST": "cmsttuning.com",
    "CSF": "csfrace.com",
    "DarwinPro": "darwinpro.com",
    "Deatschwerks": "deatschwerks.com",
    "Dorch Engineering": "dorchengineering.com",
    "Driveshaftshop": "driveshaftshop.com",
    "Duke Dynamics": "dukedynamics.com",
    "Eterna Motorworks": "eternamotorworks.com",
    "Fabspeed": "fabspeed.com",
    "Fall-Line Motorsports": "fall-linemotorsports.com",
    "Fore Innovations": "foreinnovations.com",
    "Fragola Performance Systems": "fragola.com",
    "Full-Race": "full-race.com",
    "Future Design": "futuredesign-automobile.com",
    "Girodisc": "girodisc.com",
    "HRE wheels": "hrewheels.com",
    "Injector Dynamics": "injectordynamics.com",
    "JXB Performance": "jxbperformance.com",
    "Karbel": "karbelcarbon.com",
    "Killer B Motorsport": "killerbmotorsport.com",
    "KLM Race": "klmrace.com",
    "Kooks Headers": "kooksheaders.com",
    "Lingenfelter": "lingenfelter.com",
    "Mega3 Performance": "mega3performance.com",
    "Mickey Thompson": "mickeythompsontires.com",
    "Motiv Motorsport": "motivmotorsport.com",
    "Moser Engineering": "moserengineering.com",
    "Mountune": "mountuneusa.com",
    "MV Forged": "mvforged.com",
    "Paragon brakes": "paragonperformance.com",
    "Premier Tuning Group": "premiertuninggroup.com",
    "Project 6GR": "project6gr.com",
    "Pure Drivetrain Solutions": "puredrivetrain.com",
    "Pure Turbos": "pureturbos.com",
    "Renntech": "renntechmercedes.com",
    "RK Autowerks": "rkautowerks.com",
    "RPM Transmissions": "rpmtransmissions.com",
    "RKP": "rkpcomposites.com",
    "RYFT": "ryftexhaust.com",
    "Seibon": "seibon.com",
    "ShepTrans": "sheptrans.com",
    "Southern Hotrod": "southernhotrod.com",
    "Spool Performance": "spoolperformance.com",
    "SPL Parts": "splparts.com",
    "Strasse wheels": "strasseforged.com",
    "Stoptech": "stoptech.com",
    "Stillen": "stillen.com",
    "Titan Motorsport": "titanmotorsports.com",
    "TireRack": "tirerack.com",
    "Turner Motorsport": "turnermotorsport.com",
    "Vargas Turbo": "vargasturbo.com",
    "Velos Wheels": "velosdesignwerks.com",
    "VF Engineering": "vfengineering.com",
    "VP Racing Fuel": "vpracingfuels.com",
    "VR Aero": "vraero.com",
    "VR Bespoke": "vrbespoke.com",
    "VR Forged": "vrforged.com",
    "VR Performance": "vrperformance.com",
    "Vorsteiner": "vorsteiner.com",
    "Wavetrac": "wavetrac.net",
    "Weistec Engineering": "weistec.com",
    "Whipple Superchargers": "whipplesuperchargers.com",
    "XDI fuel systems": "xdifuelsystems.com",
    
    # Europe Tuning
    "3D Design": "3ddesign.jp",
    "ABT": "abt-sportsline.com",
    "AC Schnitzer": "ac-schnitzer.de",
    "ADRO": "adroaero.com",
    "Akrapovic": "akrapovic.com",
    "Alpha-N": "alpha-n.de",
    "ARMA Speed": "armaspeed.com",
    "Armytrix": "armytrix.com",
    "Black Boost": "blackboost.de",
    "BMC filters": "bmcairfilters.com",
    "Brabus": "brabus.com",
    "Brembo": "brembo.com",
    "BC Racing": "bcracing.com",
    "Capristo": "capristo.de",
    "CT Carbon": "ct-carbon.de",
    "Custom Cages": "customcages.co.uk",
    "Dahler": "dahler.com",
    "DMC": "dmc.ag",
    "do88": "do88.se",
    "DTE Systems": "dte-systems.com",
    "ESS Tuning": "ess-tuning.com",
    "Eventuri": "eventuri.net",
    "FI Exhaust": "fi-exhaust.com",
    "GTHaus": "gthaus.com",
    "Gruppe-M": "gruppem.co.jp",
    "Hamann": "hamann-motorsport.de",
    "Hardrace": "hardrace.com",
    "Harrop": "harrop.com.au",
    "IPe exhaust": "ipe-innotech.com",
    "ItalianRP": "italianrp.com",
    "KAHN design": "projectkahn.com",
    "Karbonius": "karbonius.com",
    "Keyvany": "keyvany.com",
    "Kline Innovation": "klineinnovation.com",
    "KW Suspension": "kwsuspensions.com",
    "Larte Design": "lartedesign.com",
    "Liberty Walk": "libertywalk.co.jp",
    "Litchfield": "litchfieldmotors.com",
    "LOBA Motorsport": "loba-motorsport.de",
    "Lorinser": "lorinser.com",
    "Lumma": "lumma-design.com",
    "Manhart": "manhart-performance.de",
    "Mansory": "mansory.com",
    "MCA Suspension": "mcasuspension.com",
    "McChip-DKR": "mcchip-dkr.com",
    "Milltek": "millteksport.com",
    "MST Performance": "mstperformance.eu",
    "MTM": "mtm-online.de",
    "Novitec": "novitec.com",
    "Onyx Concept": "onyxconcept.com",
    "Ohlins": "ohlins.com",
    "Prior Design": "prior-design.de",
    "Power Division": "powerdivision.de",
    "R44 Performance": "r44performance.com",
    "Renegade Design": "renegade-design.net",
    "RES exhaust": "resexhaust.com",
    "Revo": "revotechnik.com",
    "Rotiform": "rotiform.com",
    "RUF": "ruf-automobile.de",
    "RW Carbon": "rwcarbon.com",
    "Samsonas": "samsonas.lt",
    "Schrick": "schrick.de",
    "Star Performance": "starperformance.co.uk",
    "Startech": "startech-refinement.com",
    "Sterckenn": "sterckenn.com",
    "STOPART ceramic": "stopart.biz",
    "Supersprint": "supersprint.com",
    "Summit Racing": "summitracing.com",
    "Team Oreca": "oreca-store.com",
    "Tubi Style": "tubistyle.it",
    "Urban Automotive": "urbanautomotive.co.uk",
    "Vossen": "vfracing.com",
    "Wald": "wald.co.jp",
    "Wagner Tuning": "wagnertuning.com",
    "Wheelsandmore": "wheelsandmore.de",
}


@dataclass 
class LogoResult:
    """Result of a logo fetch attempt"""
    success: bool
    source: str
    format: str  # 'svg' or 'png'
    data: Optional[bytes] = None
    error: Optional[str] = None


class QualityLogoFetcher:
    """Fetches high-quality logos with SVG priority"""
    
    def __init__(self, output_dir: Path = LOGOS_DIR, concurrency: int = 10):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.concurrency = concurrency
        self.semaphore = asyncio.Semaphore(concurrency)
        self.session: Optional[httpx.AsyncClient] = None
        
    async def __aenter__(self):
        self.session = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/svg+xml,image/webp,image/png,image/*,*/*;q=0.8",
            }
        )
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.aclose()
    
    def get_slug(self, brand_name: str) -> str:
        """Convert brand name to slug"""
        slug = brand_name.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = re.sub(r'^-+|-+$', '', slug)
        return slug
    
    def has_logo(self, brand_name: str) -> Tuple[bool, Optional[str]]:
        """Check if logo exists and return format"""
        slug = self.get_slug(brand_name)
        for ext in ['svg', 'png']:
            path = self.output_dir / f"{slug}.{ext}"
            if path.exists() and path.stat().st_size > 500:
                return True, ext
        return False, None
    
    async def fetch_url(self, url: str) -> Optional[bytes]:
        """Fetch URL with error handling"""
        try:
            async with self.semaphore:
                response = await self.session.get(url)
                if response.status_code == 200:
                    return response.content
        except Exception:
            pass
        return None
    
    def is_valid_svg(self, data: bytes) -> bool:
        """Validate SVG content"""
        try:
            text = data.decode('utf-8', errors='ignore').lower()
            return '<svg' in text and '</svg>' in text and len(data) > 200
        except:
            return False
    
    def is_valid_png(self, data: bytes) -> bool:
        """Validate PNG is transparent and high quality"""
        try:
            img = Image.open(io.BytesIO(data))
            # Check it's actually PNG/WebP with transparency
            if img.mode not in ('RGBA', 'LA', 'PA'):
                return False
            # Check minimum size (avoid tiny icons)
            if img.width < 100 or img.height < 100:
                return False
            # Check it has actual transparency
            if img.mode == 'RGBA':
                extrema = img.split()[3].getextrema()
                if extrema[0] == 255:  # No transparency at all
                    return False
            return True
        except:
            return False
    
    async def try_worldvectorlogo(self, brand_name: str) -> LogoResult:
        """Try WorldVectorLogo - excellent SVG source"""
        try:
            search_url = f"https://worldvectorlogo.com/search/{quote_plus(brand_name)}"
            response = await self.session.get(search_url)
            
            if response.status_code != 200:
                return LogoResult(False, "WorldVectorLogo", "svg", error="Search failed")
            
            soup = BeautifulSoup(response.text, 'lxml')
            logo_link = soup.select_one('a.logo__link')
            
            if not logo_link:
                return LogoResult(False, "WorldVectorLogo", "svg", error="No results")
            
            # Get logo page
            logo_url = urljoin("https://worldvectorlogo.com", logo_link.get('href', ''))
            logo_page = await self.session.get(logo_url)
            
            if logo_page.status_code != 200:
                return LogoResult(False, "WorldVectorLogo", "svg", error="Logo page failed")
            
            logo_soup = BeautifulSoup(logo_page.text, 'lxml')
            download_btn = logo_soup.select_one('a.button--download[href$=".svg"]')
            
            if not download_btn:
                return LogoResult(False, "WorldVectorLogo", "svg", error="No SVG download")
            
            svg_url = download_btn.get('href', '')
            if not svg_url.startswith('http'):
                svg_url = urljoin("https://worldvectorlogo.com", svg_url)
            
            svg_data = await self.fetch_url(svg_url)
            
            if svg_data and self.is_valid_svg(svg_data):
                return LogoResult(True, "WorldVectorLogo", "svg", data=svg_data)
            
            return LogoResult(False, "WorldVectorLogo", "svg", error="Invalid SVG")
            
        except Exception as e:
            return LogoResult(False, "WorldVectorLogo", "svg", error=str(e))
    
    async def try_brandfetch(self, domain: str) -> LogoResult:
        """Try Brandfetch/Clearbit for logo"""
        try:
            # Clearbit Logo API (free)
            url = f"https://logo.clearbit.com/{domain}?size=512"
            data = await self.fetch_url(url)
            
            if data and self.is_valid_png(data):
                return LogoResult(True, "Clearbit", "png", data=data)
            
            return LogoResult(False, "Clearbit", "png", error="No valid logo")
            
        except Exception as e:
            return LogoResult(False, "Clearbit", "png", error=str(e))
    
    async def try_seeklogo(self, brand_name: str) -> LogoResult:
        """Try SeekLogo for SVG"""
        try:
            search_url = f"https://seeklogo.com/search?q={quote_plus(brand_name + ' automotive')}"
            response = await self.session.get(search_url)
            
            if response.status_code != 200:
                return LogoResult(False, "SeekLogo", "svg", error="Search failed")
            
            soup = BeautifulSoup(response.text, 'lxml')
            logo_item = soup.select_one('.logo-item')
            
            if not logo_item:
                return LogoResult(False, "SeekLogo", "svg", error="No results")
            
            link = logo_item.select_one('a')
            if not link:
                return LogoResult(False, "SeekLogo", "svg", error="No link")
            
            logo_url = urljoin("https://seeklogo.com", link.get('href', ''))
            logo_page = await self.session.get(logo_url)
            
            if logo_page.status_code != 200:
                return LogoResult(False, "SeekLogo", "svg", error="Logo page failed")
            
            logo_soup = BeautifulSoup(logo_page.text, 'lxml')
            svg_link = logo_soup.select_one('a.download[href*=".svg"]')
            
            if not svg_link:
                return LogoResult(False, "SeekLogo", "svg", error="No SVG download")
            
            svg_url = svg_link.get('href', '')
            svg_data = await self.fetch_url(svg_url)
            
            if svg_data and self.is_valid_svg(svg_data):
                return LogoResult(True, "SeekLogo", "svg", data=svg_data)
            
            return LogoResult(False, "SeekLogo", "svg", error="Invalid SVG")
            
        except Exception as e:
            return LogoResult(False, "SeekLogo", "svg", error=str(e))
    
    async def try_official_site(self, domain: str) -> LogoResult:
        """Try to scrape SVG logo from official website"""
        try:
            url = f"https://{domain}"
            response = await self.session.get(url)
            
            if response.status_code != 200:
                url = f"https://www.{domain}"
                response = await self.session.get(url)
            
            if response.status_code != 200:
                return LogoResult(False, "Official", "svg", error="Site not accessible")
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Look for inline SVG logos
            for svg in soup.select('svg'):
                classes = ' '.join(svg.get('class', []))
                svg_id = svg.get('id', '')
                if 'logo' in classes.lower() or 'logo' in svg_id.lower():
                    svg_str = str(svg)
                    if len(svg_str) > 200:
                        return LogoResult(True, "Official (inline)", "svg", data=svg_str.encode())
            
            # Look for SVG file links
            for img in soup.select('img[src*="logo"], img[class*="logo"], .logo img, #logo img, header img'):
                src = img.get('src', '')
                if not src:
                    continue
                    
                if not src.startswith('http'):
                    src = urljoin(url, src)
                
                if '.svg' in src.lower():
                    svg_data = await self.fetch_url(src)
                    if svg_data and self.is_valid_svg(svg_data):
                        return LogoResult(True, "Official", "svg", data=svg_data)
            
            return LogoResult(False, "Official", "svg", error="No SVG logo found")
            
        except Exception as e:
            return LogoResult(False, "Official", "svg", error=str(e))
    
    async def try_simpleicons(self, brand_name: str) -> LogoResult:
        """Try Simple Icons CDN"""
        try:
            # Simple Icons uses lowercase, no spaces/hyphens
            icon_name = re.sub(r'[^a-z0-9]', '', brand_name.lower())
            
            url = f"https://cdn.simpleicons.org/{icon_name}/white"
            data = await self.fetch_url(url)
            
            if data and self.is_valid_svg(data):
                return LogoResult(True, "SimpleIcons", "svg", data=data)
            
            return LogoResult(False, "SimpleIcons", "svg", error="Not found")
            
        except Exception as e:
            return LogoResult(False, "SimpleIcons", "svg", error=str(e))
    
    async def fetch_brand_logo(self, brand_name: str, force: bool = False) -> LogoResult:
        """Fetch logo for a brand, trying multiple sources"""
        slug = self.get_slug(brand_name)
        
        # Check if already exists
        if not force:
            exists, fmt = self.has_logo(brand_name)
            if exists:
                return LogoResult(True, "Cached", fmt or "svg")
        
        print(f"  ⏳ Fetching {brand_name}...")
        
        domain = BRAND_DOMAINS.get(brand_name)
        
        # Try sources in priority order (SVG first)
        sources = []
        
        # 1. WorldVectorLogo (best SVG source)
        result = await self.try_worldvectorlogo(brand_name)
        if result.success:
            print(f"  ✓ Found {brand_name} on {result.source}")
            return result
        
        # 2. Official website
        if domain:
            result = await self.try_official_site(domain)
            if result.success:
                print(f"  ✓ Found {brand_name} on {result.source}")
                return result
        
        # 3. SeekLogo
        result = await self.try_seeklogo(brand_name)
        if result.success:
            print(f"  ✓ Found {brand_name} on {result.source}")
            return result
        
        # 4. Simple Icons
        result = await self.try_simpleicons(brand_name)
        if result.success:
            print(f"  ✓ Found {brand_name} on {result.source}")
            return result
        
        # 5. Clearbit (PNG fallback)
        if domain:
            result = await self.try_brandfetch(domain)
            if result.success:
                print(f"  ✓ Found {brand_name} on {result.source} (PNG)")
                return result
        
        print(f"  ❌ Could not find logo for {brand_name}")
        return LogoResult(False, "None", "svg", error="Not found in any source")
    
    async def save_logo(self, brand_name: str, result: LogoResult) -> bool:
        """Save logo to file"""
        if not result.success or not result.data:
            return False
        
        slug = self.get_slug(brand_name)
        filename = f"{slug}.{result.format}"
        filepath = self.output_dir / filename
        
        try:
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(result.data)
            print(f"  ✅ Saved {brand_name} as {filename}")
            return True
        except Exception as e:
            print(f"  ❌ Failed to save {brand_name}: {e}")
            return False
    
    async def fetch_single(self, brand: str, force: bool, results: Dict[str, bool]):
        """Fetch a single brand logo"""
        async with self.semaphore:
            result = await self.fetch_brand_logo(brand, force)
            
            if result.success and result.data:
                saved = await self.save_logo(brand, result)
                results[brand] = saved
            else:
                results[brand] = False
            
            await asyncio.sleep(0.2)
    
    async def fetch_all(self, brands: List[str], force: bool = False) -> Dict[str, bool]:
        """Fetch logos for all brands in parallel"""
        results = {}
        
        print(f"Fetching logos for {len(brands)} brands with {self.concurrency} parallel workers...")
        print(f"Output directory: {self.output_dir}\n")
        
        # Create tasks for parallel execution
        tasks = [self.fetch_single(brand, force, results) for brand in brands]
        await asyncio.gather(*tasks)
        
        # Summary
        success = sum(1 for v in results.values() if v)
        print(f"\n{'='*50}")
        print(f"Results: {success}/{len(brands)} logos found")
        
        failed = [name for name, ok in results.items() if not ok]
        if failed:
            print(f"\nFailed ({len(failed)}):")
            for name in failed[:20]:
                print(f"  - {name}")
            if len(failed) > 20:
                print(f"  ... and {len(failed) - 20} more")
        
        return results


def parse_brands_from_ts(filepath: Path) -> List[str]:
    """Extract brand names from TypeScript file"""
    content = filepath.read_text(encoding='utf-8')
    
    # Match: { name: 'Brand Name' } or { name: "Brand Name" }
    pattern = r"name:\s*['\"]([^'\"]+)['\"]"
    matches = re.findall(pattern, content)
    
    # Remove duplicates while preserving order
    seen = set()
    brands = []
    for name in matches:
        if name not in seen:
            seen.add(name)
            brands.append(name)
    
    return brands


async def main():
    parser = argparse.ArgumentParser(description='Fetch high-quality logos for automotive brands')
    parser.add_argument('--brand', '-b', help='Fetch specific brand only')
    parser.add_argument('--all', '-a', action='store_true', help='Fetch all brands (default: missing only)')
    parser.add_argument('--force', '-f', action='store_true', help='Overwrite existing logos')
    parser.add_argument('--concurrency', '-c', type=int, default=10, help='Concurrency (default: 10)')
    
    args = parser.parse_args()
    
    # Get brands
    brands = parse_brands_from_ts(BRANDS_FILE)
    print(f"Found {len(brands)} brands in brands.ts")
    
    if args.brand:
        brands = [b for b in brands if args.brand.lower() in b.lower()]
        if not brands:
            print(f"Brand '{args.brand}' not found")
            return
    
    async with QualityLogoFetcher(concurrency=args.concurrency) as fetcher:
        # Filter to missing only unless --all or --force
        if not args.all and not args.force:
            missing = [b for b in brands if not fetcher.has_logo(b)[0]]
            print(f"Missing logos: {len(missing)}/{len(brands)}")
            brands = missing
        
        if not brands:
            print("All logos already present!")
            return
        
        await fetcher.fetch_all(brands, force=args.force)


if __name__ == "__main__":
    asyncio.run(main())
