"""
🔍 Logo Scraper v3 - Fast scraper with timeout handling and skip list
Skips known problematic domains and uses shorter timeouts.

Run: python scripts/scrape-logos-v3.py
"""

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path
import socket

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_DIR / "public" / "logos"

# Short timeout
TIMEOUT = 10

# Headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# Skip these domains - they either have DNS issues or are too slow
SKIP_DOMAINS = {
    'bigboostllc.com',
    'brixtonforged.com',
    'fragolaperformance.com',
    'gthaus.com',
    'paragonperformancebrakes.com',
    'abt-sportsline.com',  # Too slow, causes timeout
    'seibon.com',  # Very slow
    'fall-linemotorsports.com',  # 404
    'puredrivetrain.com',  # No logo found
    'lingenfelter.com',  # 404 on all images
}

# Known working logo URLs
KNOWN_LOGO_URLS = {
    'AC Schnitzer': 'https://www.ac-schnitzer.de/media/image/fb/95/bb/ACS_Logo.svg',
    'Akrapovic': 'https://www.akrapovic.com/static/version1735292063/frontend/Magento/default/en_US/images/logo.svg',
    'Eventuri': 'https://eventuri.net/wp-content/themes/eventuri/assets/images/header_logo_white.svg',
    'Liberty Walk': 'https://libertywalk.co.jp/en/wp-content/uploads/sites/3/2019/08/lbwk_logo_w.png',
    'Mansory': 'https://www.mansory.com/themes/custom/mansory/images/logo.svg',
    'Milltek': 'https://www.millteksport.com/static/version1735297261/frontend/Millteksport/milltek/en_GB/images/logo-retina.png',
    'Novitec': 'https://www.novitecgroup.com/fileadmin/user_upload/media/logos/novitec-black.png',
    'BC Racing': 'https://www.bcracing.com/wp-content/themes/bcracing/images/logo-white.png',
    'ESS Tuning': 'https://esstuning.com/cdn/shop/files/ESS-Tuning-Logo-White.svg',
    'Heico': 'https://heicosportiv.de/media/image/d6/9a/b3/heico-sportiv-tuning.png',
    'Lorinser': 'https://lorinser.com/media/logo/stores/1/lorinser-logo-dark.svg',
    'TopCar Design': 'https://topcardesign.com/media/logo/websites/1/Logo-Header-Topcar-380-min_1.png',
    'Seibon Carbon': 'https://www.seibon.com/media/logo/stores/1/seibon-logo.svg',
    'Urban Automotive': 'https://urbanautomotive.co.uk/cdn/shop/files/UrbanAutomotive_Logo_White.svg',
    'Renegade Design': 'https://renegade-design.net/wp-content/uploads/2023/02/logo-rd-white-1.png',
    'Sterckenn': 'https://www.sterckenn.com/cdn/shop/files/STERCKENN_Logo.svg',
    'Alpha-N': 'https://alpha-n.de/wp-content/themes/alpha-n/images/logo.svg',
    'CT Carbon': 'https://ctcarbon.co.uk/cdn/shop/files/CT_CARBON_LOGO_2.svg',
    'ARMA Speed': 'https://armaspeed.com/cdn/shop/files/ARMA_logo_white.svg',
    'Lingenfelter': 'https://www.lingenfelter.com/skin/frontend/lingenfelter/default/images/logo.png',
    'TireRack': 'https://www.tirerack.com/images/layout/logo_tire_rack_red.svg',
    'Turner Motorsport': 'https://www.turnermotorsport.com/skin/frontend/turner/default/images/logo_white.svg',
    'Weistec Engineering': 'https://www.weistec.com/cdn/shop/files/weistec-logo-white.svg',
    'Borla': 'https://www.borla.com/skin/frontend/borla/default/images/logo.svg',
    # Moto brands
    'Arrow': 'https://www.arrow.it/themes/custom/arrow/img/logo.svg',
    'Rizoma': 'https://www.rizoma.com/static/version1735297261/frontend/Rizoma/default/en_US/images/logo.svg',
    'SC-Project': 'https://sc-project.com/wp-content/uploads/2021/03/sc-project-logo.svg',
    'Termignoni': 'https://www.termignoni.it/wp-content/uploads/2023/01/logo-termignoni.svg',
    'Vandemon': 'https://vandemonperformance.com/cdn/shop/files/Vandemon_Logo_White.svg',
    'ZARD Exhaust': 'https://www.zfrex.it/media/logo/websites/1/logo-zard-header.png',
}

# Suppress SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def slugify(name):
    """Convert brand name to filename slug"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    return slug.strip('-')


def has_logo(name):
    """Check if logo already exists"""
    slug = slugify(name)
    for ext in ['.svg', '.png', '.webp', '.jpg', '.jpeg', '.gif']:
        if (LOGOS_DIR / f"{slug}{ext}").exists():
            return True
    return False


def download_image(url, dest_path):
    """Download image from URL"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, verify=False, stream=True)
        resp.raise_for_status()
        
        content_type = resp.headers.get('Content-Type', '').lower()
        
        # Check if it's an image
        if not any(t in content_type for t in ['image/', 'svg', 'octet-stream']):
            return False
        
        # Check size (skip if too small)
        content = resp.content
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
        
    except requests.exceptions.Timeout:
        print(f"    Timeout!")
        return False
    except (requests.exceptions.ConnectionError, TimeoutError, socket.timeout):
        print(f"    Connection/Timeout error")
        return False
    except Exception as e:
        print(f"    Error: {str(e)[:60]}")
        return False


def find_logo_in_page(soup, base_url):
    """Find logo URL in page HTML"""
    logo_selectors = [
        'header img[src*="logo"]',
        'header .logo img',
        'nav img[src*="logo"]',
        '.header img[src*="logo"]',
        '#logo img',
        '.logo img',
        'a[href="/"] img',
        'img.logo',
        'img[alt*="logo" i]',
        'img[class*="logo" i]',
        'img[src*="logo"]',
    ]
    
    for selector in logo_selectors:
        img = soup.select_one(selector)
        if img and img.get('src'):
            return urljoin(base_url, img['src'])
    
    # Try og:image
    og_image = soup.select_one('meta[property="og:image"]')
    if og_image and og_image.get('content'):
        img_url = og_image['content']
        if 'logo' in img_url.lower():
            return urljoin(base_url, img_url)
    
    return None


def scrape_brand_logo(name, website):
    """Try to scrape logo from brand website"""
    slug = slugify(name)
    dest_path = LOGOS_DIR / slug
    
    # Check if domain should be skipped
    try:
        domain = urlparse(website).netloc.replace('www.', '')
        if domain in SKIP_DOMAINS:
            print(f"  ⏭️  Skipping (known problematic domain)")
            return False
    except:
        pass
    
    # Try known URL first
    if name in KNOWN_LOGO_URLS:
        print(f"  Trying known URL...")
        if download_image(KNOWN_LOGO_URLS[name], dest_path):
            return True
    
    # Try common logo paths
    common_paths = [
        '/images/logo.svg', '/images/logo.png',
        '/img/logo.svg', '/img/logo.png',
        '/assets/images/logo.svg', '/assets/logo.svg',
        '/logo.svg', '/logo.png',
        '/cdn/shop/files/logo.svg',
        f'/images/{slug}-logo.svg', f'/images/{slug}-logo.png',
    ]
    
    parsed = urlparse(website)
    base = f"{parsed.scheme}://{parsed.netloc}"
    
    for path in common_paths:
        url = base + path
        print(f"  Trying: {path}...")
        if download_image(url, dest_path):
            return True
    
    # Scrape the page
    try:
        print(f"  Scraping page...")
        resp = requests.get(website, headers=HEADERS, timeout=TIMEOUT, verify=False, allow_redirects=True)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'lxml')
        logo_url = find_logo_in_page(soup, website)
        
        if logo_url:
            print(f"  Found: {logo_url[:50]}...")
            if download_image(logo_url, dest_path):
                return True
                
    except requests.exceptions.Timeout:
        print(f"  ⏱️  Page timeout")
    except Exception as e:
        print(f"  Scrape error: {str(e)[:60]}")
    
    return False


def load_brands():
    """Load brands from brands.ts - all brands including European and moto"""
    brands_file = PROJECT_DIR / "src" / "lib" / "brands.ts"
    content = brands_file.read_text(encoding='utf-8')
    
    brands = []
    
    # Pattern 1: USA brands with country field
    pattern1 = r'{\s*name:\s*[\'"]([^\'"]+)[\'"].*?website:\s*[\'"]([^\'"]*)[\'"]'
    for match in re.finditer(pattern1, content, re.DOTALL):
        name = match.group(1)
        website = match.group(2)
        if website and 'http' in website:
            brands.append((name, website))
    
    # Also try JSON-style
    pattern2 = r'"name":\s*"([^"]+)".*?"website":\s*"([^"]*)"'
    for match in re.finditer(pattern2, content, re.DOTALL):
        name = match.group(1)
        website = match.group(2)
        if website and 'http' in website:
            # Avoid duplicates
            if (name, website) not in brands:
                brands.append((name, website))
    
    # Remove duplicates by name
    seen = set()
    unique_brands = []
    for name, website in brands:
        if name not in seen:
            seen.add(name)
            unique_brands.append((name, website))
    
    return unique_brands


def main():
    print("=" * 70)
    print("🔍 LOGO SCRAPER v3 - Fast mode with skip list")
    print("=" * 70)
    
    # Load brands
    brands = load_brands()
    
    # Filter to only those without logos
    missing = [(n, w) for n, w in brands if not has_logo(n)]
    
    print(f"\n📋 Found {len(missing)} brands still missing logos\n")
    
    downloaded = 0
    failed = []
    
    for i, (name, website) in enumerate(missing, 1):
        print(f"\n[{i}/{len(missing)}] {name} ({website})")
        
        if scrape_brand_logo(name, website):
            print(f"  ✅ Downloaded!")
            downloaded += 1
        else:
            print(f"  ❌ Failed")
            failed.append(name)
        
        time.sleep(0.3)  # Small delay
    
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
        with open(SCRIPT_DIR / "failed-v3.json", "w") as f:
            json.dump(failed, f, indent=2)


if __name__ == "__main__":
    main()
