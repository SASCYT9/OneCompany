#!/usr/bin/env python3
"""
Fast logo fetcher with Google Images and multiple sources
Uses threading for parallel downloads
"""

import concurrent.futures
import requests
import re
import json
import os
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urljoin
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
LOGOS_DIR = PROJECT_ROOT / "public" / "logos"
BRANDS_FILE = PROJECT_ROOT / "src" / "lib" / "brands.ts"

TIMEOUT = 8
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
}

# Extended brand domains
DOMAINS = {
    "1221 wheels": "1221wheels.com",
    "5150 Autosport": "5150autosport.com",
    "AE Design": "ae-design.de",
    "Agency Power": "agencypower.com",
    "APR": "goapr.com",
    "Avantgarde Wheels": "avantgardewheels.com",
    "BE bearings": "bebearings.com",
    "BBi Autosport": "bbiautosport.com",
    "BC Racing": "bcracing.com",
    "Black Boost": "blackboost.de",
    "BMC filters": "bmcairfilters.com",
    "Brixton wheels": "brixtonforged.com",
    "CMST": "cmsttuning.com",
    "CT Carbon": "ct-carbon.de",
    "Deatschwerks": "deatschwerks.com",
    "Dorch Engineering": "dorchengineering.com",
    "DTE Systems": "dte-systems.com",
    "Duke Dynamics": "dukedynamics.com",
    "Future Design": "futuredesign-automobile.com",
    "Gruppe-M": "gruppem.co.jp",
    "Injector Dynamics": "injectordynamics.com",
    "IPe exhaust": "ipe-innotech.com",
    "JXB Performance": "jxbperformance.com",
    "Karbonius": "karbonius.com",
    "Kline Innovation": "klineinnovation.com",
    "KW Suspension": "kwsuspensions.com",
    "Lamspeed": "lamspeed.com.au",
    "Larte Design": "lartedesign.com",
    "LOBA Motorsport": "loba-motorsport.de",
    "Lumma": "lumma-design.com",
    "Mamba turbo": "mambaturbo.com",
    "Matts Carbon": "mattscarbon.com",
    "Mega3 Performance": "mega3performance.com",
    "Milltek": "millteksport.com",
    "MST Performance": "mstperformance.eu",
    "Nitron Suspension": "nitron.co.uk",
    "Onyx Concept": "onyxconcept.com",
    "Pagid": "pagid.com",
    "Paragon brakes": "paragonperformance.com",
    "Power Division": "powerdivision.de",
    "Premier Tuning Group": "premiertuninggroup.com",
    "ProTrack Wheels": "protrackwheels.com",
    "Pure Drivetrain Solutions": "puredrivetrain.com",
    "R44 Performance": "r44performance.com",
    "Remus": "remus.eu",
    "Renntech": "renntechmercedes.com",
    "RES Exhaust": "resexhaust.com",
    "RKP": "rkpcomposites.com",
    "RPM Transmissions": "rpmtransmissions.com",
    "RS-R": "rs-r.com",
    "RW Carbon": "rwcarbon.com",
    "RYFT": "ryftexhaust.com",
    "Sachs Performance": "sachs-performance.com",
    "Schrick": "schrick.de",
    "Seibon": "seibon.com",
    "Southern Hotrod": "southernhotrod.com",
    "Spool Performance": "spoolperformance.com",
    "SPL Parts": "splparts.com",
    "Sterckenn": "sterckenn.com",
    "STOPART ceramic": "stopart.biz",
    "Supersprint": "supersprint.com",
    "Tubi Style": "tubistyle.it",
    "TTE Turbos": "theturboenginers.com",
    "TTH turbos": "tthturbos.com",
    "Urban Automotive": "urbanautomotive.co.uk",
    "Vargas Turbo": "vargasturbo.com",
    "VF Engineering": "vfracing.com",
    "VP Racing Fuel": "vpracingfuels.com",
    "VR Aero": "vraero.com",
    "VR Forged": "vrforged.com",
    "VR Performance": "vrperformance.com",
    "Wagner Tuning": "wagnertuning.com",
    "WALD": "wald.co.jp",
    "WheelForce": "wheelforce.de",
    "XDI fuel systems": "xdifuelsystems.com",
    "xHP": "xhpflashtuning.com",
    "Zacoe": "zacoe.com",
    "ADRO": "adroaero.com",
    "AIM Sportline": "aimsportline.com",
    "ARE dry sump": "aredrysump.com",
    "Bell Intercoolers": "bellintercoolers.com",
    "Drenth Gearboxes": "drenthgearboxes.nl",
    "Driftworks": "driftworks.com",
    "Extreme tyres": "extremetyres.co.uk",
    "ISA Racing": "isaracing.de",
    "Link ECU": "linkecu.com",
    "Lithiumax batteries": "lithiumax.com",
    "MCA Suspension": "mcasuspension.com.au",
    "Modena Engineering": "modenaengineering.com",
    "Samsonas Motorsport": "samsonas.lt",
    "Sandtler": "sandtler.de",
    "Summit Racing": "summitracing.com",
    "Team Oreca": "oreca-store.com",
    # Moto brands
    "Evotech": "evotech-performance.com",
    "Domino": "domino-group.com",
    "Translogic": "translogicuk.com",
    "Ohlins": "ohlins.com",
    "Bitubo": "bitubo.com",
    "CNC Racing": "cncracing.com",
    "GBracing": "gbracing.eu",
    "Akrapovic": "akrapovic.com",
    "SC-Project": "sc-project.com",
    "Austin Racing": "austinracing.com",
    "Bonamici": "bonamiciracing.it",
    "Stompgrip": "stompgrip.com",
    "Ilmberger Carbon": "ilmberger-carbon.com",
    "ARP Racingparts": "arp-racingparts.com",
    "Bikesplast": "bikesplast.com",
    "TSS": "tss.cz",
    "Febur": "febur.it",
    "Brembo": "brembo.com",
    "Accossato": "accossato.com",
    "Rotobox": "rotobox-wheels.com",
    "OZ Racing": "ozmotorbike.com",
    "Marchesini": "marchesiniwheels.com",
    "Jetprime": "jetprimeshop.it",
    "STM Italy": "stmitaly.com",
    "Racefoxx": "racefoxx.com",
    "Capit": "capit.it",
    "Thermal Technology": "thermal-technology.it",
    "Healtech": "healtech-electronics.com",
    "Termignoni": "termignoni.it",
    "AIM Tech": "aim-sportline.com",
    "Alpha Racing": "alpharacing.com",
    "Arrow": "arrow.it",
    "Samco Sport": "samcosport.com",
    "Sprint Filter": "sprintfilter.net",
    "Starlane": "starlane.com",
    "Sebimoto": "sebimoto.com",
    "GPR Stabilizer": "gprstabilizer.com",
    "TWM": "twm-sc.com",
    "Vandemon": "vandemonperformance.com.au",
    "HM Quickshifter": "hmquickshifter.com.au",
    "EVR": "edovignaracing.com",
    "Evolution Bike": "evolutionbike.it",
    "FlashTune": "ftecu.com",
    "ECUStudio": "ecustudio.com",
    "Cordona": "cordona.net",
    "AEM Factory": "aem-factory.com",
    "ValterMoto": "valtermoto.com",
    "Rizoma": "rizoma.com",
    "HyperPro": "hyperpro.com",
    "Gilles Tooling": "gillestooling.com",
    "New Rage Cycles": "newragecycles.com",
    "P3 Carbon": "p3carbon.com",
    "Fullsix Carbon": "fullsixcarbon.com",
    "BT Moto": "bt-moto.com",
    "S2 Concept": "s2-concept.com",
    "X-GRIP": "x-grip.at",
    "DB-Race": "db-race.com",
    "Dominator Exhaust": "dominator.pl",
    "TOCE Exhaust": "toceperformance.com",
    "ZARD Exhaust": "officineitalianezard.it",
    "SparkExhaust": "sparkexhaust.com",
    "IXIL": "ixil.com",
    "R&G Racing": "rg-racing.com",
    "AXP": "axp-racing.com",
    "Ceracarbon": "ceracarbon-racing.com",
    "Cobra Sport": "cobrasport.com",
}

def get_slug(name):
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    return slug.strip('-')

def is_valid_svg(data):
    try:
        text = data.decode('utf-8', errors='ignore').lower()
        return '<svg' in text and '</svg>' in text and len(data) > 200
    except:
        return False

def is_valid_image(data):
    """Check if data is valid PNG/JPG with reasonable size"""
    if not data or len(data) < 1000:
        return False
    # Check PNG header
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return True
    # Check JPEG header
    if data[:2] == b'\xff\xd8':
        return True
    return False

def fetch_clearbit(domain):
    """Fetch from Clearbit Logo API"""
    try:
        url = f"https://logo.clearbit.com/{domain}?size=512"
        r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code == 200 and is_valid_image(r.content):
            return r.content, 'png'
    except:
        pass
    return None, None

def fetch_google_logo(brand_name):
    """Search Google Images for logo"""
    try:
        # Search query with automotive context
        query = f"{brand_name} automotive tuning logo transparent png"
        url = f"https://www.google.com/search?q={quote_plus(query)}&tbm=isch&tbs=ic:trans"
        
        r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code != 200:
            return None, None
        
        # Find image URLs in response
        # Google encodes image URLs in the page
        matches = re.findall(r'"(https?://[^"]+\.(?:png|svg))"', r.text)
        
        for img_url in matches[:5]:  # Try first 5 matches
            if 'google' in img_url or 'gstatic' in img_url:
                continue
            try:
                img_r = requests.get(img_url, timeout=TIMEOUT, headers=HEADERS)
                if img_r.status_code == 200:
                    if is_valid_svg(img_r.content):
                        return img_r.content, 'svg'
                    if is_valid_image(img_r.content):
                        return img_r.content, 'png'
            except:
                continue
    except:
        pass
    return None, None

def fetch_duckduckgo(brand_name):
    """Search DuckDuckGo for logo"""
    try:
        query = f"{brand_name} tuning logo svg"
        url = f"https://duckduckgo.com/?q={quote_plus(query)}&iax=images&ia=images"
        
        r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code != 200:
            return None, None
        
        # Find vqd token for API
        vqd_match = re.search(r'vqd=["\']([^"\']+)["\']', r.text)
        if not vqd_match:
            return None, None
        
        vqd = vqd_match.group(1)
        api_url = f"https://duckduckgo.com/i.js?q={quote_plus(brand_name + ' logo svg')}&vqd={vqd}"
        
        api_r = requests.get(api_url, timeout=TIMEOUT, headers=HEADERS)
        if api_r.status_code == 200:
            data = api_r.json()
            for result in data.get('results', [])[:5]:
                img_url = result.get('image')
                if img_url:
                    try:
                        img_r = requests.get(img_url, timeout=TIMEOUT, headers=HEADERS)
                        if is_valid_svg(img_r.content):
                            return img_r.content, 'svg'
                        if is_valid_image(img_r.content):
                            return img_r.content, 'png'
                    except:
                        continue
    except:
        pass
    return None, None

def fetch_brandsoftheworld(brand_name):
    """Try Brands of the World"""
    try:
        search_url = f"https://www.brandsoftheworld.com/search/logo?search_api_views_fulltext={quote_plus(brand_name)}"
        r = requests.get(search_url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code != 200:
            return None, None
        
        soup = BeautifulSoup(r.text, 'html.parser')
        logo_link = soup.select_one('.views-field-title a')
        if not logo_link:
            return None, None
        
        logo_page = f"https://www.brandsoftheworld.com{logo_link.get('href')}"
        r2 = requests.get(logo_page, timeout=TIMEOUT, headers=HEADERS)
        if r2.status_code != 200:
            return None, None
        
        soup2 = BeautifulSoup(r2.text, 'html.parser')
        download_link = soup2.select_one('a[href*=".svg"], a[href*=".eps"]')
        if download_link:
            svg_url = download_link.get('href')
            if not svg_url.startswith('http'):
                svg_url = f"https://www.brandsoftheworld.com{svg_url}"
            r3 = requests.get(svg_url, timeout=TIMEOUT, headers=HEADERS)
            if r3.status_code == 200 and is_valid_svg(r3.content):
                return r3.content, 'svg'
    except:
        pass
    return None, None

def fetch_logowik(brand_name):
    """Try Logowik"""
    try:
        search_url = f"https://logowik.com/?s={quote_plus(brand_name)}"
        r = requests.get(search_url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code != 200:
            return None, None
        
        soup = BeautifulSoup(r.text, 'html.parser')
        logo_link = soup.select_one('.post-thumbnail a')
        if not logo_link:
            return None, None
        
        logo_page = logo_link.get('href')
        r2 = requests.get(logo_page, timeout=TIMEOUT, headers=HEADERS)
        if r2.status_code != 200:
            return None, None
        
        soup2 = BeautifulSoup(r2.text, 'html.parser')
        svg_link = soup2.select_one('a[href$=".svg"]')
        if svg_link:
            svg_url = svg_link.get('href')
            r3 = requests.get(svg_url, timeout=TIMEOUT, headers=HEADERS)
            if r3.status_code == 200 and is_valid_svg(r3.content):
                return r3.content, 'svg'
    except:
        pass
    return None, None

def fetch_official_site(domain):
    """Scrape logo from official website"""
    try:
        for prefix in ['https://www.', 'https://']:
            url = f"{prefix}{domain}"
            try:
                r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
                if r.status_code != 200:
                    continue
                
                soup = BeautifulSoup(r.text, 'html.parser')
                
                # Find SVG in page
                for svg in soup.select('svg'):
                    classes = ' '.join(svg.get('class', []))
                    if 'logo' in classes.lower() or 'logo' in svg.get('id', '').lower():
                        svg_str = str(svg)
                        if len(svg_str) > 300:
                            return svg_str.encode(), 'svg'
                
                # Find logo images
                for img in soup.select('img[class*="logo"], img[alt*="logo"], .logo img, header img'):
                    src = img.get('src', '')
                    if not src:
                        continue
                    if not src.startswith('http'):
                        src = urljoin(url, src)
                    
                    if '.svg' in src.lower():
                        try:
                            r2 = requests.get(src, timeout=TIMEOUT, headers=HEADERS)
                            if r2.status_code == 200 and is_valid_svg(r2.content):
                                return r2.content, 'svg'
                        except:
                            continue
                    elif any(ext in src.lower() for ext in ['.png', '.webp']):
                        try:
                            r2 = requests.get(src, timeout=TIMEOUT, headers=HEADERS)
                            if r2.status_code == 200 and is_valid_image(r2.content):
                                return r2.content, 'png'
                        except:
                            continue
            except:
                continue
    except:
        pass
    return None, None

def fetch_worldvector(name):
    """Fetch from WorldVectorLogo"""
    try:
        search_url = f"https://worldvectorlogo.com/search/{quote_plus(name)}"
        r = requests.get(search_url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code != 200:
            return None, None
        
        match = re.search(r'href="(/logo/[^"]+)"', r.text)
        if not match:
            return None, None
        
        logo_url = f"https://worldvectorlogo.com{match.group(1)}"
        r2 = requests.get(logo_url, timeout=TIMEOUT, headers=HEADERS)
        if r2.status_code != 200:
            return None, None
        
        match = re.search(r'href="([^"]+\.svg)"', r2.text)
        if not match:
            return None, None
        
        svg_url = match.group(1)
        if not svg_url.startswith('http'):
            svg_url = f"https://worldvectorlogo.com{svg_url}"
        
        r3 = requests.get(svg_url, timeout=TIMEOUT, headers=HEADERS)
        if r3.status_code == 200 and is_valid_svg(r3.content):
            return r3.content, 'svg'
    except:
        pass
    return None, None

def fetch_simpleicons(name):
    """Fetch from Simple Icons"""
    try:
        icon_name = re.sub(r'[^a-z0-9]', '', name.lower())
        url = f"https://cdn.simpleicons.org/{icon_name}"
        r = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
        if r.status_code == 200 and is_valid_svg(r.content):
            return r.content, 'svg'
    except:
        pass
    return None, None

def fetch_brand(name):
    """Fetch logo for a single brand using all sources"""
    slug = get_slug(name)
    
    # Check if exists
    for ext in ['svg', 'png']:
        path = LOGOS_DIR / f"{slug}.{ext}"
        if path.exists() and path.stat().st_size > 500:
            return name, 'cached', ext
    
    domain = DOMAINS.get(name)
    
    # Try sources in order of preference (SVG first)
    sources = [
        ('WorldVectorLogo', lambda: fetch_worldvector(name)),
        ('SimpleIcons', lambda: fetch_simpleicons(name)),
        ('Official', lambda: fetch_official_site(domain) if domain else (None, None)),
        ('BrandsOfWorld', lambda: fetch_brandsoftheworld(name)),
        ('Logowik', lambda: fetch_logowik(name)),
        ('DuckDuckGo', lambda: fetch_duckduckgo(name)),
        ('Google', lambda: fetch_google_logo(name)),
        ('Clearbit', lambda: fetch_clearbit(domain) if domain else (None, None)),
    ]
    
    for source_name, fetch_func in sources:
        try:
            data, fmt = fetch_func()
            if data and fmt:
                path = LOGOS_DIR / f"{slug}.{fmt}"
                path.write_bytes(data)
                return name, source_name, fmt
        except Exception as e:
            continue
    
    return name, None, None

def get_failed_brands():
    """Get list of brands that don't have logos"""
    brands = parse_brands()
    failed = []
    for name in brands:
        slug = get_slug(name)
        has_logo = False
        for ext in ['svg', 'png']:
            path = LOGOS_DIR / f"{slug}.{ext}"
            if path.exists() and path.stat().st_size > 500:
                has_logo = True
                break
        if not has_logo:
            failed.append(name)
    return failed

def parse_brands():
    """Extract brand names from TypeScript file"""
    content = BRANDS_FILE.read_text(encoding='utf-8')
    pattern = r"name:\s*['\"]([^'\"]+)['\"]"
    matches = re.findall(pattern, content)
    return list(dict.fromkeys(matches))

def main():
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Only fetch missing brands
    failed = get_failed_brands()
    print(f"Found {len(failed)} brands without logos\n")
    
    if not failed:
        print("All brands have logos!")
        return
    
    print(f"Fetching with 25 parallel threads...\n")
    
    success = 0
    still_failed = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        futures = {executor.submit(fetch_brand, brand): brand for brand in failed}
        
        for future in concurrent.futures.as_completed(futures):
            name, source, fmt = future.result()
            if source == 'cached':
                print(f"  ✓ {name} (cached)")
                success += 1
            elif source:
                print(f"  ✅ {name} <- {source} ({fmt})")
                success += 1
            else:
                print(f"  ❌ {name}")
                still_failed.append(name)
    
    print(f"\n{'='*50}")
    print(f"Found: {success}/{len(failed)}")
    print(f"Still missing: {len(still_failed)}")
    
    if still_failed:
        print("\nMissing brands:")
        for b in still_failed:
            print(f"  - {b}")
        
        # Save to file
        (SCRIPT_DIR / "missing_brands.json").write_text(
            json.dumps(still_failed, indent=2, ensure_ascii=False), 
            encoding='utf-8'
        )

if __name__ == "__main__":
    main()
