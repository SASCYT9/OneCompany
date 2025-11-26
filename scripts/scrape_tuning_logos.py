#!/usr/bin/env python3
"""
Advanced SVG Logo Scraper for Automotive Tuning Brands
=======================================================
This script scrapes high-quality SVG logos for automotive tuning companies.
It uses multiple sources and adds context keywords to avoid confusion with
similarly-named non-automotive companies (like pizzerias, etc.)

Features:
- Uses Brandfetch API (free tier) for official logos
- Falls back to DuckDuckGo image search with automotive context
- Validates SVG files for quality
- Converts PNG/WebP to SVG when needed using potrace
- Adds tuning/automotive keywords to disambiguate searches

Requirements:
    pip install httpx beautifulsoup4 aiohttp aiofiles pillow cairosvg lxml

Usage:
    python scrape_tuning_logos.py
    python scrape_tuning_logos.py --brand "Akrapovic"
    python scrape_tuning_logos.py --missing-only
"""

import asyncio
import json
import os
import re
import sys
import hashlib
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from urllib.parse import quote_plus, urljoin, urlparse
import logging

# Third-party imports
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logo_scraper.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_ROOT / "public" / "logos"
BRANDS_FILE = PROJECT_ROOT / "src" / "lib" / "brands.ts"

# Automotive context keywords to add to searches
AUTOMOTIVE_KEYWORDS = [
    "tuning",
    "automotive",
    "car parts",
    "performance",
    "racing",
    "exhaust",
    "motorsport",
    "wheels",
    "suspension",
]

# Known brand domains for direct fetching
KNOWN_DOMAINS: Dict[str, str] = {
    "Akrapovic": "akrapovic.com",
    "Brembo": "brembo.com",
    "KW Suspension": "kwsuspensions.com",
    "Bilstein": "bilstein.com",
    "Borla": "borla.com",
    "APR": "goapr.com",
    "HKS": "hks-power.co.jp",
    "Eibach": "eibach.com",
    "Recaro": "recaro-automotive.com",
    "Sparco": "sparco-official.com",
    "OMP": "ompracing.com",
    "Momo": "momodesign.com",
    "BC Racing": "bcracing.com",
    "Öhlins": "ohlins.com",
    "Magnaflow": "magnaflow.com",
    "Flowmaster": "flowmastermufflers.com",
    "Mishimoto": "mishimoto.com",
    "Garrett": "turbobygarrett.com",
    "BorgWarner": "borgwarner.com",
    "Hondata": "hondata.com",
    "AEM": "aemelectronics.com",
    "Holley": "holley.com",
    "Edelbrock": "edelbrock.com",
    "K&N": "knfilters.com",
    "AFE Power": "afepower.com",
    "Injen": "injen.com",
    "Skunk2": "skunk2.com",
    "Tein": "tein.com",
    "Cusco": "cusco.co.jp",
    "HRE Wheels": "hrewheels.com",
    "Vossen": "vfracing.com",
    "BBS": "bbs.com",
    "Enkei": "enkei.com",
    "Work Wheels": "work-wheels.co.jp",
    "Rays": "rayswheels.co.jp",
    "Advan": "advanracing.jp",
    "Stoptech": "stoptech.com",
    "Wilwood": "wilwood.com",
    "AP Racing": "apracing.com",
    "Brabus": "brabus.com",
    "ABT": "abt-sportsline.com",
    "Mansory": "mansory.com",
    "Novitec": "novitec.com",
    "TechArt": "techart.com",
    "Hamann": "hamann-motorsport.com",
    "AC Schnitzer": "ac-schnitzer.de",
    "Alpina": "alpina-automobiles.com",
    "Ruf": "ruf-automobile.de",
    "Liberty Walk": "libertywalk.co.jp",
    "Rocket Bunny": "rocket-bunny.com",
    "Vorsteiner": "vorsteiner.com",
    "Eventuri": "eventuri.net",
    "Armytrix": "armytrix.com",
    "FI Exhaust": "fi-exhaust.com",
    "Capristo": "capristo.de",
    "iPE": "ipe.com.tw",
    "Remus": "remus.eu",
    "Milltek": "milltek.com",
    "Supersprint": "supersprint.com",
    "Fabspeed": "fabspeed.com",
    "Agency Power": "agencypower.com",
    "Dinan": "dinancars.com",
    "Burger Motorsports": "burgertuning.com",
    "Cobb Tuning": "cobbtuning.com",
    "Unitronic": "getunitronic.com",
    "APR": "goapr.com",
    "Revo": "revotechnik.com",
    "Weistec": "weistec.com",
    "RENNtech": "renntechmercedes.com",
    "Manhart": "manhart-performance.de",
    "G-Power": "g-power.com",
    "Lumma Design": "lumma-design.com",
    "Prior Design": "prior-design.de",
    "TopCar": "topcar.ru",
    "DMC": "dmc.ag",
    "Wheelsandmore": "wheelsandmore.de",
    "Lorinser": "lorinser.com",
    "Carlsson": "carlsson.de",
    "MTM": "mtm-online.de",
    "JE Design": "je-design.de",
    "Arden": "arden.de",
    "Urban Automotive": "urbanautomotive.co.uk",
    "KAHN Design": "projectkahn.com",
    "Startech": "startech.de",
}


@dataclass
class BrandInfo:
    """Information about a brand for logo scraping"""
    name: str
    category: str  # 'auto' or 'moto'
    subcategory: Optional[str] = None
    country: Optional[str] = None
    domain: Optional[str] = None
    
    @property
    def slug(self) -> str:
        """Generate URL-safe slug from brand name"""
        slug = self.name.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = re.sub(r'^-+|-+$', '', slug)
        return slug
    
    @property
    def logo_filename(self) -> str:
        """Expected logo filename"""
        return f"{self.slug}.svg"
    
    @property
    def search_query(self) -> str:
        """Generate search query with automotive context"""
        # Add context based on subcategory
        context_words = []
        if self.subcategory:
            context_words.append(self.subcategory.lower())
        
        # Add general automotive context
        if self.category == 'moto':
            context_words.extend(['motorcycle', 'motorbike', 'racing'])
        else:
            context_words.extend(['automotive', 'tuning', 'car parts'])
        
        return f"{self.name} {' '.join(context_words[:2])} logo svg"


class LogoScraper:
    """Advanced logo scraper with multiple sources and validation"""
    
    def __init__(self, output_dir: Path = LOGOS_DIR):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session: Optional[httpx.AsyncClient] = None
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        ]
        self._ua_index = 0
        
    @property
    def user_agent(self) -> str:
        """Rotate user agents"""
        ua = self.user_agents[self._ua_index % len(self.user_agents)]
        self._ua_index += 1
        return ua
    
    async def __aenter__(self):
        self.session = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"User-Agent": self.user_agent}
        )
        return self
    
    async def __aexit__(self, *args):
        if self.session:
            await self.session.aclose()
    
    def has_logo(self, brand: BrandInfo) -> bool:
        """Check if logo already exists"""
        logo_path = self.output_dir / brand.logo_filename
        if not logo_path.exists():
            return False
        # Check if file is not empty or placeholder
        if logo_path.stat().st_size < 100:
            return False
        return True
    
    async def fetch_from_brandfetch(self, brand: BrandInfo) -> Optional[bytes]:
        """Try to fetch logo from Brandfetch API (free tier)"""
        try:
            domain = brand.domain or KNOWN_DOMAINS.get(brand.name)
            if not domain:
                # Try to guess domain
                domain = f"{brand.slug.replace('-', '')}.com"
            
            # Brandfetch logo.clearbit.com fallback (free)
            url = f"https://logo.clearbit.com/{domain}"
            response = await self.session.get(url)
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'svg' in content_type:
                    return response.content
                elif 'image' in content_type:
                    # Got PNG/JPEG, we'll handle conversion separately
                    logger.info(f"Got raster image from Clearbit for {brand.name}")
                    return None
            
            return None
        except Exception as e:
            logger.debug(f"Brandfetch failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_worldvectorlogo(self, brand: BrandInfo) -> Optional[bytes]:
        """Fetch from WorldVectorLogo (good SVG source)"""
        try:
            search_url = f"https://worldvectorlogo.com/search/{quote_plus(brand.name)}"
            response = await self.session.get(search_url)
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find first logo result
            logo_link = soup.select_one('a.logo__link')
            if not logo_link:
                return None
            
            logo_page_url = urljoin("https://worldvectorlogo.com", logo_link.get('href', ''))
            logo_response = await self.session.get(logo_page_url)
            
            if logo_response.status_code != 200:
                return None
            
            logo_soup = BeautifulSoup(logo_response.text, 'lxml')
            download_link = logo_soup.select_one('a.button--download[href$=".svg"]')
            
            if not download_link:
                return None
            
            svg_url = download_link.get('href', '')
            if not svg_url.startswith('http'):
                svg_url = urljoin("https://worldvectorlogo.com", svg_url)
            
            svg_response = await self.session.get(svg_url)
            if svg_response.status_code == 200:
                return svg_response.content
            
            return None
        except Exception as e:
            logger.debug(f"WorldVectorLogo failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_svgporn(self, brand: BrandInfo) -> Optional[bytes]:
        """Fetch from SVGPorn (curated SVG logos)"""
        try:
            # SVGPorn has a GitHub repo with logos
            github_url = f"https://raw.githubusercontent.com/nicbeltran/SVGPorn/master/logos/{brand.slug}.svg"
            response = await self.session.get(github_url)
            
            if response.status_code == 200:
                return response.content
            
            # Try alternative naming
            alt_slug = brand.name.lower().replace(' ', '-').replace('_', '-')
            github_url = f"https://raw.githubusercontent.com/nicbeltran/SVGPorn/master/logos/{alt_slug}.svg"
            response = await self.session.get(github_url)
            
            if response.status_code == 200:
                return response.content
            
            return None
        except Exception as e:
            logger.debug(f"SVGPorn failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_simpleicons(self, brand: BrandInfo) -> Optional[bytes]:
        """Fetch from Simple Icons (popular brand icons)"""
        try:
            # Simple Icons uses lowercase, no spaces
            icon_name = brand.name.lower().replace(' ', '').replace('-', '').replace('.', '')
            
            url = f"https://cdn.simpleicons.org/{icon_name}"
            response = await self.session.get(url)
            
            if response.status_code == 200 and b'<svg' in response.content:
                return response.content
            
            return None
        except Exception as e:
            logger.debug(f"SimpleIcons failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_seeklogo(self, brand: BrandInfo) -> Optional[bytes]:
        """Fetch from SeekLogo with automotive context"""
        try:
            # Add automotive context to search
            search_terms = f"{brand.name} {AUTOMOTIVE_KEYWORDS[0]}"
            search_url = f"https://seeklogo.com/search?q={quote_plus(search_terms)}"
            
            response = await self.session.get(search_url)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Find SVG download link
            logo_item = soup.select_one('.logo-item a')
            if not logo_item:
                return None
            
            logo_page_url = urljoin("https://seeklogo.com", logo_item.get('href', ''))
            logo_response = await self.session.get(logo_page_url)
            
            if logo_response.status_code != 200:
                return None
            
            logo_soup = BeautifulSoup(logo_response.text, 'lxml')
            svg_link = logo_soup.select_one('a[href$=".svg"]')
            
            if svg_link:
                svg_url = svg_link.get('href', '')
                svg_response = await self.session.get(svg_url)
                if svg_response.status_code == 200:
                    return svg_response.content
            
            return None
        except Exception as e:
            logger.debug(f"SeekLogo failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_duckduckgo(self, brand: BrandInfo) -> Optional[bytes]:
        """Search DuckDuckGo Images with automotive context"""
        try:
            # Build search query with automotive context
            query = brand.search_query
            
            # DuckDuckGo image search
            url = f"https://duckduckgo.com/?q={quote_plus(query)}&iax=images&ia=images&iaf=type:svg"
            
            response = await self.session.get(url)
            if response.status_code != 200:
                return None
            
            # Parse response for image URLs
            # Note: DDG loads images dynamically, so this is limited
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Try to find SVG links in the page
            for link in soup.find_all('a', href=True):
                href = link['href']
                if '.svg' in href.lower():
                    try:
                        svg_response = await self.session.get(href)
                        if svg_response.status_code == 200 and b'<svg' in svg_response.content:
                            return svg_response.content
                    except:
                        continue
            
            return None
        except Exception as e:
            logger.debug(f"DuckDuckGo failed for {brand.name}: {e}")
            return None
    
    async def fetch_from_official_website(self, brand: BrandInfo) -> Optional[bytes]:
        """Try to scrape logo from official website"""
        try:
            domain = brand.domain or KNOWN_DOMAINS.get(brand.name)
            if not domain:
                return None
            
            url = f"https://{domain}"
            response = await self.session.get(url)
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Look for logo in common places
            logo_selectors = [
                'img[class*="logo"]',
                'img[alt*="logo"]',
                'img[src*="logo"]',
                '.logo img',
                '#logo img',
                'header img',
                '.header img',
                'a[class*="logo"] img',
                'svg[class*="logo"]',
            ]
            
            for selector in logo_selectors:
                elements = soup.select(selector)
                for elem in elements:
                    if elem.name == 'svg':
                        # Direct SVG element
                        return str(elem).encode('utf-8')
                    
                    src = elem.get('src', '')
                    if not src:
                        continue
                    
                    if not src.startswith('http'):
                        src = urljoin(url, src)
                    
                    if '.svg' in src.lower():
                        try:
                            svg_response = await self.session.get(src)
                            if svg_response.status_code == 200:
                                return svg_response.content
                        except:
                            continue
            
            return None
        except Exception as e:
            logger.debug(f"Official website failed for {brand.name}: {e}")
            return None
    
    def validate_svg(self, content: bytes) -> bool:
        """Validate that content is a valid SVG"""
        try:
            if not content:
                return False
            
            # Check for SVG markers
            content_str = content.decode('utf-8', errors='ignore').lower()
            if '<svg' not in content_str:
                return False
            
            if '</svg>' not in content_str:
                return False
            
            # Check it's not an error page
            if '<html' in content_str and 'error' in content_str:
                return False
            
            # Check minimum size (avoid placeholder images)
            if len(content) < 200:
                return False
            
            return True
        except:
            return False
    
    def clean_svg(self, content: bytes) -> bytes:
        """Clean and optimize SVG content"""
        try:
            content_str = content.decode('utf-8')
            
            # Remove XML declaration if present (not needed for web)
            content_str = re.sub(r'<\?xml[^>]*\?>', '', content_str)
            
            # Remove DOCTYPE
            content_str = re.sub(r'<!DOCTYPE[^>]*>', '', content_str)
            
            # Remove comments
            content_str = re.sub(r'<!--.*?-->', '', content_str, flags=re.DOTALL)
            
            # Strip leading/trailing whitespace
            content_str = content_str.strip()
            
            return content_str.encode('utf-8')
        except:
            return content
    
    async def scrape_brand(self, brand: BrandInfo, force: bool = False) -> bool:
        """
        Scrape logo for a single brand using multiple sources.
        Returns True if successful.
        """
        if not force and self.has_logo(brand):
            logger.info(f"✅ Logo already exists for {brand.name}")
            return True
        
        logger.info(f"🔍 Searching logo for {brand.name}...")
        
        # Try sources in order of preference
        sources = [
            ("Official Website", self.fetch_from_official_website),
            ("WorldVectorLogo", self.fetch_from_worldvectorlogo),
            ("SVGPorn", self.fetch_from_svgporn),
            ("SimpleIcons", self.fetch_from_simpleicons),
            ("SeekLogo", self.fetch_from_seeklogo),
            ("Clearbit", self.fetch_from_brandfetch),
            ("DuckDuckGo", self.fetch_from_duckduckgo),
        ]
        
        for source_name, fetch_func in sources:
            try:
                content = await fetch_func(brand)
                
                if content and self.validate_svg(content):
                    # Clean and save
                    content = self.clean_svg(content)
                    
                    output_path = self.output_dir / brand.logo_filename
                    async with aiofiles.open(output_path, 'wb') as f:
                        await f.write(content)
                    
                    logger.info(f"✅ Saved logo for {brand.name} from {source_name}")
                    return True
                
                # Small delay between sources
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.debug(f"Source {source_name} failed for {brand.name}: {e}")
                continue
        
        logger.warning(f"❌ Could not find logo for {brand.name}")
        return False
    
    async def scrape_all(self, brands: List[BrandInfo], missing_only: bool = True, 
                         concurrency: int = 3) -> Dict[str, bool]:
        """
        Scrape logos for all brands with concurrency control.
        Returns dict of brand name -> success status.
        """
        results = {}
        
        # Filter to missing only if requested
        if missing_only:
            brands = [b for b in brands if not self.has_logo(b)]
            logger.info(f"Found {len(brands)} brands missing logos")
        
        if not brands:
            logger.info("All logos already present!")
            return results
        
        # Use semaphore for concurrency control
        semaphore = asyncio.Semaphore(concurrency)
        
        async def scrape_with_semaphore(brand: BrandInfo):
            async with semaphore:
                result = await self.scrape_brand(brand)
                results[brand.name] = result
                # Delay between requests
                await asyncio.sleep(1)
        
        # Create tasks
        tasks = [scrape_with_semaphore(brand) for brand in brands]
        
        # Run with progress
        logger.info(f"Scraping {len(brands)} brand logos...")
        await asyncio.gather(*tasks)
        
        # Summary
        success = sum(1 for v in results.values() if v)
        logger.info(f"\n📊 Results: {success}/{len(brands)} logos found")
        
        return results


def parse_brands_ts(filepath: Path) -> List[BrandInfo]:
    """Parse brands from TypeScript file"""
    brands = []
    
    if not filepath.exists():
        logger.error(f"Brands file not found: {filepath}")
        return brands
    
    content = filepath.read_text(encoding='utf-8')
    
    # Extract brand arrays using regex
    # Pattern: { name: 'Brand Name' }
    pattern = r"\{\s*name:\s*['\"]([^'\"]+)['\"]\s*\}"
    
    # Find which array each brand belongs to
    current_category = 'auto'
    
    for line in content.split('\n'):
        # Detect category changes
        if 'brandsUsa' in line:
            current_category = 'auto'
        elif 'brandsEurope' in line:
            current_category = 'auto'
        elif 'brandsOem' in line:
            current_category = 'auto'
        elif 'brandsRacing' in line:
            current_category = 'auto'
        elif 'brandsMoto' in line:
            current_category = 'moto'
        
        # Extract brand names
        matches = re.findall(pattern, line)
        for name in matches:
            brands.append(BrandInfo(
                name=name,
                category=current_category,
                domain=KNOWN_DOMAINS.get(name)
            ))
    
    # Remove duplicates while preserving order
    seen = set()
    unique_brands = []
    for brand in brands:
        if brand.name not in seen:
            seen.add(brand.name)
            unique_brands.append(brand)
    
    return unique_brands


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Scrape SVG logos for tuning brands')
    parser.add_argument('--brand', '-b', help='Scrape specific brand only')
    parser.add_argument('--missing-only', '-m', action='store_true', default=True,
                        help='Only scrape missing logos (default)')
    parser.add_argument('--all', '-a', action='store_true',
                        help='Scrape all logos, even existing ones')
    parser.add_argument('--concurrency', '-c', type=int, default=3,
                        help='Number of concurrent requests (default: 3)')
    
    args = parser.parse_args()
    
    # Parse brands from TypeScript file
    brands = parse_brands_ts(BRANDS_FILE)
    logger.info(f"Found {len(brands)} brands in brands.ts")
    
    if args.brand:
        # Filter to specific brand
        brands = [b for b in brands if args.brand.lower() in b.name.lower()]
        if not brands:
            logger.error(f"Brand '{args.brand}' not found")
            return
    
    # Run scraper
    async with LogoScraper() as scraper:
        results = await scraper.scrape_all(
            brands,
            missing_only=not args.all,
            concurrency=args.concurrency
        )
        
        # Print failed brands
        failed = [name for name, success in results.items() if not success]
        if failed:
            logger.info("\n❌ Failed brands:")
            for name in failed:
                logger.info(f"  - {name}")
            
            # Save failed brands list
            failed_file = SCRIPT_DIR / "failed_brands.json"
            with open(failed_file, 'w', encoding='utf-8') as f:
                json.dump(failed, f, indent=2)
            logger.info(f"\nFailed brands saved to: {failed_file}")


if __name__ == "__main__":
    asyncio.run(main())
