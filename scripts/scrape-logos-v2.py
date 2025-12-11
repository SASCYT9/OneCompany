"""
🔍 Advanced Logo Scraper - Second pass with improved detection
Uses Selenium for JavaScript-rendered sites and better logo detection

Run: python scripts/scrape-logos-v2.py
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# Headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# Brands with known logo URLs (manually researched)
KNOWN_LOGO_URLS = {
    'ABT': 'https://www.abt-sportsline.com/fileadmin/assets/images/logo/abt_logo.svg',
    'AC Schnitzer': 'https://www.ac-schnitzer.de/media/image/fb/95/bb/ACS_Logo.svg',
    'APR': 'https://www.goapr.com/images/logo.svg',
    'Borla': 'https://www.borla.com/images/logo.svg',
    'Cobb tuning': 'https://www.cobbtuning.com/media/logo/websites/1/COBB_Tuning.svg',
    'CSF': 'https://www.csfrace.com/cdn/shop/files/CSF_LOGO_white.svg',
    'Eventuri': 'https://eventuri.net/wp-content/uploads/2021/03/eventuri-logo.svg',
    'Milltek': 'https://www.millteksport.com/static/version1733851392/frontend/Millteksport/milltek/en_GB/images/logo-retina.png',
    'Novitec': 'https://www.novitecgroup.com/typo3conf/ext/novitec_template/Resources/Public/Images/novitec-logo.svg',
    'Stoptech': 'https://www.stoptech.com/images/logo.svg',
    'Turner Motorsport': 'https://www.turnermotorsport.com/skin/frontend/turner/default/images/logo.svg',
    'Vorsteiner': 'https://www.vorsteiner.com/cdn/shop/files/Vorsteiner_Logo_White.svg',
    'Weistec Engineering': 'https://weistec.com/cdn/shop/files/weistec-logo.svg',
    '3D Design': 'https://3ddesign.jp/common/img/logo.svg',
    'Liberty Walk': 'https://libertywalk.shop/cdn/shop/files/lbworks-logo-white.svg',
    'Mansory': 'https://www.mansory.com/themes/custom/mansory/images/logo.svg',
    'BC Racing': 'https://www.bcracing.com/images/logo.svg',
    'Akrapovic': 'https://www.akrapovic.com/favicon.svg',
    'Renntech': 'https://renntechmercedes.com/images/renntech-logo.png',
    'ESS Tuning': 'https://esstuning.com/cdn/shop/files/ESS-Tuning-Logo-White.svg',
    'Seibon Carbon': 'https://seibon.com/cdn/shop/files/seibon-logo.svg',
    'VF Engineering': 'https://vfracing.com/cdn/shop/files/VF-Engineering-Logo.svg',
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

def download_image(url: str, dest_path: Path) -> bool:
    """Download image from URL with improved handling"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20, verify=False, stream=True)
        resp.raise_for_status()
        
        content = resp.content
        if len(content) < 100:
            return False
            
        # Check it's not HTML
        if b'<!DOCTYPE' in content[:100] or b'<html' in content[:100].lower():
            return False
        
        # Determine extension from content
        if b'<svg' in content[:500] or b'<?xml' in content[:100]:
            ext = '.svg'
        elif content[:8] == b'\x89PNG\r\n\x1a\n':
            ext = '.png'
        elif content[:2] == b'\xff\xd8':
            ext = '.jpg'
        elif content[:4] == b'RIFF' and content[8:12] == b'WEBP':
            ext = '.webp'
        else:
            # Use URL extension
            url_ext = Path(urlparse(url).path).suffix.lower()
            ext = url_ext if url_ext in ['.svg', '.png', '.jpg', '.jpeg', '.webp'] else '.png'
        
        dest_path = dest_path.with_suffix(ext)
        dest_path.write_bytes(content)
        return True
        
    except Exception as e:
        print(f"    Error: {e}")
        return False

def find_all_images(soup: BeautifulSoup, base_url: str) -> list:
    """Find all potential logo images"""
    images = []
    
    # Check various image sources
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
        if src and not src.startswith('data:'):
            alt = (img.get('alt') or '').lower()
            cls = ' '.join(img.get('class', [])).lower()
            
            score = 0
            if 'logo' in src.lower(): score += 3
            if 'logo' in alt: score += 2
            if 'logo' in cls: score += 2
            if img.find_parent(['header', 'nav']): score += 2
            if '.svg' in src.lower(): score += 1
            
            images.append((urljoin(base_url, src), score))
    
    # Check link tags for icons
    for link in soup.find_all('link', rel=lambda x: x and 'icon' in str(x)):
        href = link.get('href')
        if href and not href.startswith('data:'):
            images.append((urljoin(base_url, href), 1))
    
    # Sort by score
    images.sort(key=lambda x: x[1], reverse=True)
    return [url for url, score in images if score > 0]

def scrape_with_fallback(name: str, website: str) -> bool:
    """Try multiple methods to get logo"""
    slug = slugify(name)
    dest_path = LOGOS_DIR / f"{slug}.png"
    
    # Ensure protocol
    if not website.startswith('http'):
        website = 'https://' + website
    
    # Method 1: Known URL
    if name in KNOWN_LOGO_URLS:
        print(f"  Trying known URL...")
        if download_image(KNOWN_LOGO_URLS[name], dest_path):
            return True
    
    # Method 2: Try common logo paths
    domain = urlparse(website).netloc
    common_paths = [
        '/images/logo.svg',
        '/images/logo.png', 
        '/assets/images/logo.svg',
        '/assets/logo.svg',
        '/img/logo.svg',
        '/img/logo.png',
        '/logo.svg',
        '/logo.png',
        f'/cdn/shop/files/{slug}-logo.svg',
        f'/cdn/shop/files/{slug}_logo.svg',
        f'/images/{slug}-logo.svg',
        f'/images/{slug}-logo.png',
    ]
    
    for path in common_paths:
        url = f"https://{domain}{path}"
        try:
            resp = requests.head(url, headers=HEADERS, timeout=5, verify=False, allow_redirects=True)
            if resp.status_code == 200:
                print(f"  Trying common path: {path}")
                if download_image(url, dest_path):
                    return True
        except:
            pass
    
    # Method 3: Scrape page
    try:
        resp = requests.get(website, headers=HEADERS, timeout=15, verify=False, allow_redirects=True)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            images = find_all_images(soup, resp.url)
            
            for img_url in images[:5]:  # Try top 5 candidates
                print(f"  Trying: {img_url[:60]}...")
                if download_image(img_url, dest_path):
                    return True
    except Exception as e:
        print(f"  Scrape error: {e}")
    
    return False

def get_missing_brands() -> dict:
    """Get brands that still need logos"""
    # Read failed brands from previous run
    failed_file = SCRIPT_DIR / 'failed-logo-downloads.json'
    if not failed_file.exists():
        return {}
    
    with open(failed_file, 'r', encoding='utf-8') as f:
        failed = json.load(f)
    
    # Filter to only those without logos
    existing = set()
    if LOGOS_DIR.exists():
        for f in LOGOS_DIR.iterdir():
            if f.suffix.lower() in ['.svg', '.png', '.webp', '.jpg', '.jpeg']:
                if f.stat().st_size > 500:
                    existing.add(f.stem.lower())
    
    missing = {}
    for item in failed:
        slug = slugify(item['name'])
        if slug not in existing:
            missing[item['name']] = item['website']
    
    return missing

def main():
    print("=" * 70)
    print("🔍 ADVANCED LOGO SCRAPER - Second pass with improved detection")
    print("=" * 70)
    
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    missing = get_missing_brands()
    print(f"\n📋 Found {len(missing)} brands still missing logos\n")
    
    if not missing:
        print("✅ All brands have logos!")
        return
    
    success = 0
    failed = 0
    
    for i, (name, website) in enumerate(missing.items(), 1):
        print(f"\n[{i}/{len(missing)}] {name} ({website})")
        
        if scrape_with_fallback(name, website):
            print(f"  ✅ Downloaded!")
            success += 1
        else:
            print(f"  ❌ Failed")
            failed += 1
        
        time.sleep(0.5)
    
    print("\n" + "=" * 70)
    print(f"📊 RESULTS")
    print(f"   ✅ Downloaded: {success}")
    print(f"   ❌ Failed: {failed}")
    print("=" * 70)
    
    # Regenerate brandLogos.ts
    print("\n🔄 Regenerating brandLogos.ts...")
    os.system('node scripts/generate-brand-logos-map.js')

if __name__ == '__main__':
    main()
