#!/usr/bin/env python3
"""Fast parallel logo fetcher using threads instead of async"""

import concurrent.futures
import requests
import re
import os
from pathlib import Path
from urllib.parse import quote_plus

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_ROOT / "public" / "logos"
BRANDS_FILE = PROJECT_ROOT / "src" / "lib" / "brands.ts"

# Timeout for requests
TIMEOUT = 10

# Brand domains
DOMAINS = {
    "1016 Industries": "1016industries.com",
    "ABT": "abt-sportsline.com",
    "AC Schnitzer": "ac-schnitzer.de",
    "Akrapovic": "akrapovic.com",
    "Armytrix": "armytrix.com",
    "Borla": "borla.com",
    "Brabus": "brabus.com",
    "Brembo": "brembo.com",
    "Cobb tuning": "cobbtuning.com",
    "Eventuri": "eventuri.net",
    "FI Exhaust": "fi-exhaust.com",
    "HRE wheels": "hrewheels.com",
    "KW Suspension": "kwsuspensions.com",
    "Liberty Walk": "libertywalk.co.jp",
    "Mansory": "mansory.com",
    "Novitec": "novitec.com",
    "Stoptech": "stoptech.com",
    "Vorsteiner": "vorsteiner.com",
    "Vossen": "vfracing.com",
}

def get_slug(name):
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def fetch_clearbit(domain):
    """Fetch from Clearbit"""
    try:
        url = f"https://logo.clearbit.com/{domain}?size=512"
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code == 200 and len(r.content) > 1000:
            return r.content, 'png'
    except:
        pass
    return None, None

def fetch_worldvector(name):
    """Fetch from WorldVectorLogo"""
    try:
        search_url = f"https://worldvectorlogo.com/search/{quote_plus(name)}"
        r = requests.get(search_url, timeout=TIMEOUT, headers={'User-Agent': 'Mozilla/5.0'})
        if r.status_code != 200:
            return None, None
        
        # Find first logo link
        match = re.search(r'href="(/logo/[^"]+)"', r.text)
        if not match:
            return None, None
        
        logo_url = f"https://worldvectorlogo.com{match.group(1)}"
        r2 = requests.get(logo_url, timeout=TIMEOUT, headers={'User-Agent': 'Mozilla/5.0'})
        if r2.status_code != 200:
            return None, None
        
        # Find SVG download
        match = re.search(r'href="([^"]+\.svg)"', r2.text)
        if not match:
            return None, None
        
        svg_url = match.group(1)
        if not svg_url.startswith('http'):
            svg_url = f"https://worldvectorlogo.com{svg_url}"
        
        r3 = requests.get(svg_url, timeout=TIMEOUT)
        if r3.status_code == 200 and b'<svg' in r3.content.lower():
            return r3.content, 'svg'
    except:
        pass
    return None, None

def fetch_simpleicons(name):
    """Fetch from Simple Icons"""
    try:
        icon_name = re.sub(r'[^a-z0-9]', '', name.lower())
        url = f"https://cdn.simpleicons.org/{icon_name}"
        r = requests.get(url, timeout=TIMEOUT)
        if r.status_code == 200 and b'<svg' in r.content:
            return r.content, 'svg'
    except:
        pass
    return None, None

def fetch_brand(name):
    """Fetch logo for a single brand"""
    slug = get_slug(name)
    
    # Check if exists
    for ext in ['svg', 'png']:
        path = LOGOS_DIR / f"{slug}.{ext}"
        if path.exists() and path.stat().st_size > 500:
            return name, 'exists', ext
    
    # Try WorldVectorLogo first (SVG)
    data, fmt = fetch_worldvector(name)
    if data:
        path = LOGOS_DIR / f"{slug}.{fmt}"
        path.write_bytes(data)
        return name, 'WorldVectorLogo', fmt
    
    # Try Simple Icons
    data, fmt = fetch_simpleicons(name)
    if data:
        path = LOGOS_DIR / f"{slug}.{fmt}"
        path.write_bytes(data)
        return name, 'SimpleIcons', fmt
    
    # Try Clearbit (PNG fallback)
    domain = DOMAINS.get(name)
    if domain:
        data, fmt = fetch_clearbit(domain)
        if data:
            path = LOGOS_DIR / f"{slug}.{fmt}"
            path.write_bytes(data)
            return name, 'Clearbit', fmt
    
    return name, None, None

def parse_brands():
    """Extract brand names from TypeScript file"""
    content = BRANDS_FILE.read_text(encoding='utf-8')
    pattern = r"name:\s*['\"]([^'\"]+)['\"]"
    matches = re.findall(pattern, content)
    return list(dict.fromkeys(matches))  # Remove duplicates

def main():
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    brands = parse_brands()
    print(f"Fetching logos for {len(brands)} brands with 20 threads...\n")
    
    success = 0
    failed = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_brand, brand): brand for brand in brands}
        
        for future in concurrent.futures.as_completed(futures):
            name, source, fmt = future.result()
            if source == 'exists':
                print(f"  ✓ {name} (cached)")
                success += 1
            elif source:
                print(f"  ✅ {name} <- {source} ({fmt})")
                success += 1
            else:
                print(f"  ❌ {name}")
                failed.append(name)
    
    print(f"\n{'='*50}")
    print(f"Results: {success}/{len(brands)} logos")
    print(f"Failed: {len(failed)}")
    
    if failed:
        (SCRIPT_DIR / "failed_brands.json").write_text(
            str(failed), encoding='utf-8'
        )

if __name__ == "__main__":
    main()
