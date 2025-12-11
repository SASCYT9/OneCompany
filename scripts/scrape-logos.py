"""
🔍 Logo Scraper - Downloads logos directly from brand websites
Uses requests + BeautifulSoup to find and download logos

Run: python scripts/scrape-logos.py
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"
BRANDS_FILE = PROJECT_DIR / "src" / "lib" / "brands.ts"

# Headers to mimic browser
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

# Moto brands to skip
MOTO_BRANDS = {
    'Accossato', 'AEM Factory', 'AGV', 'AIM Sportline', 'AIM Tech', 'Akrapovic',
    'Alpha Racing', 'Alpinestars', 'Arai', 'Arrow', 'Austin Racing', 'AXP',
    'Bikesplast', 'Bitubo', 'Bonamici', 'BT Moto', 'Capit', 'CNC Racing',
    'Cordona', 'Dainese', 'DB-Race', 'Dominator Exhaust', 'Domino', 'ECUStudio',
    'Evolution Bike', 'Evotech', 'EVR', 'Extreme tyres', 'Febur', 'FlashTune',
    'Gilles Tooling', 'Givi', 'HP Corse', 'Icon', 'Klim', 'LeoVince', 'Lightech',
    'Mivv', 'Öhlins', 'Pirelli Moto', 'Pista Performance', 'Racefoxx', 'Remus Moto',
    'Rev\'It', 'Rizoma', 'SC-Project', 'Scorpion', 'Sena', 'Shoei', 'SW-Motech',
    'Termignoni', 'Yoshimura', 'ZARD Exhaust'
}

def slugify(name: str) -> str:
    """Convert brand name to filename slug"""
    name = name.lower()
    name = re.sub(r'[öó]', 'o', name)
    name = re.sub(r'[č]', 'c', name)
    name = re.sub(r'[&]', 'and', name)
    name = re.sub(r"[']", '', name)
    name = re.sub(r'[/]', '-', name)
    name = re.sub(r'[^a-z0-9]+', '-', name)
    return name.strip('-')

def parse_brands_ts() -> dict:
    """Parse brands.ts to extract brand names and websites"""
    content = BRANDS_FILE.read_text(encoding='utf-8')
    
    brands = {}
    
    # Match brand objects with name and website
    pattern = r'\{\s*name:\s*[\'"]([^\'"]+)[\'"]\s*,\s*description:[^}]*?website:\s*[\'"]([^\'"]+)[\'"]'
    for match in re.finditer(pattern, content, re.DOTALL):
        name = match.group(1)
        website = match.group(2)
        if name not in MOTO_BRANDS:
            brands[name] = website
    
    # Also try reversed order (website before description)
    pattern2 = r'\{\s*name:\s*[\'"]([^\'"]+)[\'"]\s*,[^}]*?website:\s*[\'"]([^\'"]+)[\'"]'
    for match in re.finditer(pattern2, content, re.DOTALL):
        name = match.group(1)
        website = match.group(2)
        if name not in MOTO_BRANDS and name not in brands:
            brands[name] = website
    
    return brands

def get_existing_logos() -> set:
    """Get set of brand slugs that already have logos"""
    existing = set()
    if LOGOS_DIR.exists():
        for f in LOGOS_DIR.iterdir():
            if f.suffix.lower() in ['.svg', '.png', '.webp', '.jpg', '.jpeg']:
                if f.stat().st_size > 500:  # Skip tiny/empty files
                    existing.add(f.stem.lower())
    return existing

def find_logo_url(soup: BeautifulSoup, base_url: str) -> str | None:
    """Find logo URL in parsed HTML"""
    
    # Priority 1: Look for SVG logos
    selectors = [
        'header img[src*="logo"]',
        'header img[alt*="logo" i]',
        'header svg',
        '.logo img',
        '#logo img',
        'a.logo img',
        'img.logo',
        'img[class*="logo"]',
        'img[id*="logo"]',
        'img[src*="logo"]',
        'img[alt*="logo" i]',
        '.header img',
        '.navbar img',
        'nav img',
        'header picture source',
        'header picture img',
    ]
    
    for selector in selectors:
        elements = soup.select(selector)
        for el in elements:
            src = None
            
            if el.name == 'img':
                src = el.get('src') or el.get('data-src') or el.get('data-lazy-src')
            elif el.name == 'source':
                src = el.get('srcset', '').split(',')[0].split()[0] if el.get('srcset') else None
            elif el.name == 'svg':
                # Inline SVG - we'll handle this separately
                continue
            
            if src:
                # Skip data URIs and tiny images
                if src.startswith('data:'):
                    continue
                    
                full_url = urljoin(base_url, src)
                
                # Prefer SVG
                if '.svg' in full_url.lower():
                    return full_url
                    
                # Accept PNG/JPG/WebP
                if any(ext in full_url.lower() for ext in ['.png', '.jpg', '.jpeg', '.webp']):
                    return full_url
    
    # Priority 2: Check Open Graph image
    og_image = soup.find('meta', property='og:image')
    if og_image and og_image.get('content'):
        return urljoin(base_url, og_image['content'])
    
    # Priority 3: Check favicon as last resort (often high quality)
    for link in soup.find_all('link', rel=lambda x: x and 'icon' in ' '.join(x).lower()):
        href = link.get('href')
        if href and not href.startswith('data:'):
            # Prefer apple-touch-icon (usually 180x180)
            if 'apple' in str(link.get('rel', [])):
                return urljoin(base_url, href)
    
    return None

def download_image(url: str, dest_path: Path, timeout: int = 15) -> bool:
    """Download image from URL"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, verify=False, stream=True)
        resp.raise_for_status()
        
        content_type = resp.headers.get('content-type', '').lower()
        
        # Determine correct extension
        if 'svg' in content_type or url.lower().endswith('.svg'):
            ext = '.svg'
        elif 'png' in content_type or url.lower().endswith('.png'):
            ext = '.png'
        elif 'webp' in content_type or url.lower().endswith('.webp'):
            ext = '.webp'
        elif 'jpeg' in content_type or 'jpg' in content_type or any(url.lower().endswith(e) for e in ['.jpg', '.jpeg']):
            ext = '.jpg'
        else:
            ext = '.png'  # Default
        
        # Update destination with correct extension
        dest_path = dest_path.with_suffix(ext)
        
        # Check content
        content = resp.content
        if len(content) < 200:
            return False
            
        # Verify it's not HTML error page
        if b'<!DOCTYPE' in content[:100] or b'<html' in content[:100]:
            return False
        
        # For SVG, verify it's valid
        if ext == '.svg':
            if b'<svg' not in content and b'<?xml' not in content:
                return False
        
        dest_path.write_bytes(content)
        return True
        
    except Exception as e:
        return False

def scrape_brand_logo(name: str, website: str) -> tuple[str, bool, str]:
    """Scrape logo from brand website"""
    slug = slugify(name)
    dest_path = LOGOS_DIR / f"{slug}.png"  # Extension will be corrected by download_image
    
    # Ensure website has protocol
    if not website.startswith('http'):
        website = 'https://' + website
    
    try:
        # Fetch homepage
        resp = requests.get(website, headers=HEADERS, timeout=15, verify=False, allow_redirects=True)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Find logo URL
        logo_url = find_logo_url(soup, resp.url)
        
        if not logo_url:
            return name, False, "No logo found"
        
        # Download logo
        if download_image(logo_url, dest_path):
            return name, True, logo_url
        else:
            return name, False, f"Download failed: {logo_url}"
            
    except requests.exceptions.Timeout:
        return name, False, "Timeout"
    except requests.exceptions.SSLError:
        return name, False, "SSL Error"
    except requests.exceptions.ConnectionError:
        return name, False, "Connection Error"
    except Exception as e:
        return name, False, str(e)[:50]

def main():
    print("=" * 70)
    print("🔍 LOGO SCRAPER - Downloading logos from brand websites")
    print("=" * 70)
    
    # Suppress SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Parse brands
    brands = parse_brands_ts()
    print(f"\n📋 Found {len(brands)} auto brands with websites")
    
    # Get existing logos
    existing = get_existing_logos()
    print(f"📁 Found {len(existing)} existing logos")
    
    # Filter to brands without logos
    missing = {name: url for name, url in brands.items() 
               if slugify(name) not in existing}
    print(f"🔎 Need to download {len(missing)} logos\n")
    
    if not missing:
        print("✅ All brands already have logos!")
        return
    
    # Ensure logos directory exists
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Download logos
    success = 0
    failed = 0
    results = []
    
    # Use ThreadPoolExecutor for parallel downloads
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(scrape_brand_logo, name, url): name 
                   for name, url in missing.items()}
        
        for i, future in enumerate(as_completed(futures), 1):
            name, ok, msg = future.result()
            
            if ok:
                print(f"[{i}/{len(missing)}] ✅ {name}")
                success += 1
            else:
                print(f"[{i}/{len(missing)}] ❌ {name}: {msg}")
                failed += 1
                results.append({'name': name, 'website': brands.get(name, ''), 'error': msg})
            
            # Small delay between batches
            if i % 10 == 0:
                time.sleep(1)
    
    print("\n" + "=" * 70)
    print(f"📊 RESULTS")
    print(f"   ✅ Downloaded: {success}")
    print(f"   ❌ Failed: {failed}")
    print("=" * 70)
    
    # Save failed brands for manual download
    if results:
        failed_file = SCRIPT_DIR / 'failed-logo-downloads.json'
        with open(failed_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n📝 Failed brands saved to: {failed_file.name}")
    
    # Regenerate brandLogos.ts
    print("\n🔄 Regenerating brandLogos.ts...")
    os.system('node scripts/generate-brand-logos-map.js')

if __name__ == '__main__':
    main()
