import os
import time
import requests
from duckduckgo_search import DDGS

# Full list of brands from src/lib/brands.ts
BRANDS = [
    # USA
    '1221 wheels', '1016 Industries', '5150 Autosport', 'AE Design', 'ADV.1 wheels', 
    'Agency Power', 'Airlift Performance', 'AL13 wheels', 'AMS / Alpha Performance', 
    'American Racing Headers', 'ANRKY wheels', 'APR', 'Avantgarde Wheels', 'BE bearings', 
    'BBi Autosport', 'Big Boost', 'BimmerWorld', 'BootMod3', 'Borla', 'Brixton wheels', 
    'Burger Motorsport', 'Circle D', 'Cobb tuning', 'CMST', 'CSF', 'DarwinPro', 
    'Deatschwerks', 'Dorch Engineering', 'Driveshaftshop', 'Duke Dynamics', 
    'Eterna Motorworks', 'Fabspeed', 'Fall-Line Motorsports', 'Fore Innovations', 
    'Fragola Performance Systems', 'Full-Race', 'Future Design', 'Girodisc', 
    'HRE wheels', 'Injector Dynamics', 'JXB Performance', 'Karbel', 'Killer B Motorsport', 
    'KLM Race', 'Kooks Headers', 'Lingenfelter', 'Mega3 Performance', 'Mickey Thompson', 
    'Motiv Motorsport', 'Moser Engineering', 'Mountune', 'MV Forged', 'Paragon brakes', 
    'Premier Tuning Group', 'Project 6GR', 'Pure Drivetrain Solutions', 'Pure Turbos', 
    'Renntech', 'RK Autowerks', 'RPM Transmissions', 'RKP', 'RYFT', 'Seibon', 
    'ShepTrans', 'Southern Hotrod', 'Spool Performance', 'SPL Parts', 'Strasse wheels', 
    'Stoptech', 'Stillen', 'Titan Motorsport', 'TireRack', 'Turner Motorsport', 
    'Vargas Turbo', 'Velos Wheels', 'VF Engineering', 'VP Racing Fuel', 'VR Aero', 
    'VR Bespoke', 'VR Forged', 'VR Performance', 'Vorsteiner', 'Wavetrac', 
    'Weistec Engineering', 'Whipple Superchargers', 'XDI fuel systems',

    # Europe
    '3D Design', 'ABT', 'AC Schnitzer', 'ADRO', 'Akrapovic', 'Alpha-N', 'ARMA Speed', 
    'Armytrix', 'Black Boost', 'BMC filters', 'Brabus', 'Brembo', 'BC Racing', 
    'Capristo', 'CT Carbon', 'Custom Cages', 'Dahler', 'DMC', 'do88', 'DTE Systems', 
    'ESS Tuning', 'Eventuri', 'FI Exhaust', 'GTHaus', 'Gruppe-M', 'Hamann', 'Hardrace', 
    'Harrop', 'IPe exhaust', 'ItalianRP', 'KAHN design', 'Karbonius', 'Keyvany', 
    'Kline Innovation', 'KW Suspension', 'Lamspeed', 'Larte Design', 'Liberty Walk', 
    'LOBA Motorsport', 'Lorinser', 'Lumma', 'Manhart', 'Mansory', 'Mamba turbo', 
    'Matts Carbon', 'Milltek', 'MST Performance', 'Novitec', 'Nitron Suspension', 
    'Onyx Concept', 'Pagid', 'Power Division', 'ProTrack Wheels', 'R44 Performance', 
    'Remus', 'RES Exhaust', 'RS-R', 'RW Carbon', 'Sachs Performance', 'Schrick', 
    'Sterckenn', 'STOPART ceramic', 'Supersprint', 'Tubi Style', 'TTE Turbos', 
    'TTH turbos', 'Urban Automotive', 'Wagner Tuning', 'WALD', 'WheelForce', 'xHP', 'Zacoe',

    # OEM
    'Aston Martin', 'Ferrari', 'Lamborghini', 'Maserati', 'McLaren', 'Rolls Royce',

    # Racing
    'AIM Sportline', 'ARE dry sump', 'Bell Intercoolers', 'Drenth Gearboxes', 
    'Driftworks', 'Extreme tyres', 'ISA Racing', 'Link ECU', 'Lithiumax batteries', 
    'MCA Suspension', 'Modena Engineering', 'Samsonas Motorsport', 'Sandtler', 
    'Summit Racing', 'Team Oreca',

    # Moto
    'Accossato', 'AEM Factory', 'Alpha Racing', 'Aprilia original parts and accessories', 
    'Arrow', 'Austin Racing', 'Bikesplast', 'Bitubo Suspension', 'Black-T', 'BMC', 
    'Bonamici', 'CNC Racing', 'Cordona', 'CRC Fairings', 'DBHolders', 'Domino', 
    'ECUStudio', 'EVR', 'Evotech', 'Evolution Bike', 'Febur', 'FlashTune', 'GBracing', 
    'Gilles Tooling', 'GPR Stabilizer', 'Healtech', 'HM Quickshifter', 'HyperPro', 
    'Ilmberger Carbon', 'Jetprime', 'New Rage Cycles', 'Racefoxx', 'Rotobox', 
    'SC-Project', 'Samco Sport', 'Starlane', 'STM Italy', 'Stompgrip', 'Termignoni', 
    'Translogic', 'TWM', 'ValterMoto', 'Vandemon', 'WRS'
]

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'logos')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Specific search queries to improve accuracy
SEARCH_OVERRIDES = {
    '1221 wheels': '1221 wheels brand logo',
    '5150 Autosport': '5150 Autosport racing logo',
    'AE Design': 'AE Design automotive logo',
    'Airlift Performance': 'Airlift Performance suspension logo',
    'AL13 wheels': 'AL13 wheels forged logo',
    'Alpha-N': 'Alpha-N Performance logo',
    'ANRKY wheels': 'ANRKY wheels logo',
    'ARE dry sump': 'ARE dry sump systems logo',
    'ADRO': 'ADRO aerodynamic logo',
    '3D Design': '3D Design BMW tuning logo',
    'AIM Sportline': 'AIM Sportline racing data logo',
    'AMS / Alpha Performance': 'AMS Performance logo',
    'American Racing Headers': 'American Racing Headers logo',
    'APR': 'APR performance tuning logo',
    'Big Boost': 'Big Boost turbo logo',
    'Black-T': 'Black-T suspension logo',
    'BMC': 'BMC air filters logo',
    'BMC filters': 'BMC air filters logo',
    'BootMod3': 'BootMod3 tuning logo',
    'Circle D': 'Circle D Specialties logo',
    'CMST': 'CMST tuning logo',
    'CSF': 'CSF radiators logo',
    'CT Carbon': 'CT Carbon kit logo',
    'Dahler': 'Dahler competition line logo',
    'DarwinPro': 'DarwinPro Aerodynamics logo',
    'Deatschwerks': 'Deatschwerks fuel systems logo',
    'Dorch Engineering': 'Dorch Engineering BMW logo',
    'Driveshaftshop': 'The Driveshaft Shop logo',
    'Duke Dynamics': 'Duke Dynamics body kit logo',
    'Eterna Motorworks': 'Eterna Motorworks logo',
    'Evolution Bike': 'Evolution Bike racing logo',
    'Extreme tyres': 'Extreme tyres motorsport logo',
    'Fabspeed': 'Fabspeed Motorsport logo',
    'Fall-Line Motorsports': 'Fall-Line Motorsports logo',
    'FI Exhaust': 'Frequency Intelligent Exhaust logo',
    'FlashTune': 'FTECU FlashTune logo',
    'Fore Innovations': 'Fore Innovations fuel logo',
    'Fragola Performance Systems': 'Fragola Performance Systems logo',
    'Full-Race': 'Full-Race Motorsports logo',
    'Future Design': 'Future Design carbon logo',
    'G-Force': 'G-Force Racing Gear logo',
    'GBracing': 'GBracing motorcycle protection logo',
    'Girodisc': 'Girodisc racing brakes logo',
    'GPR Stabilizer': 'GPR Stabilizer logo',
    'GTHaus': 'GTHaus Meisterschaft logo',
    'Gruppe-M': 'GruppeM Racing logo',
    'Hamann': 'Hamann Motorsport logo',
    'Hardrace': 'Hardrace suspension logo',
    'Harrop': 'Harrop Engineering logo',
    'Healtech': 'Healtech Electronics logo',
    'HM Quickshifter': 'HM Quickshifter logo',
    'HRE wheels': 'HRE Performance Wheels logo',
    'HyperPro': 'HyperPro suspension logo',
    'Ilmberger Carbon': 'Ilmberger Carbon Parts logo',
    'Injector Dynamics': 'Injector Dynamics logo',
    'IPe exhaust': 'Innotech Performance Exhaust logo',
    'ISA Racing': 'ISA Racing GmbH logo',
    'ItalianRP': 'ItalianRP connecting rods logo',
    'Jetprime': 'Jetprime motorcycle parts logo',
    'JXB Performance': 'JXB Performance logo',
    'KAHN design': 'Kahn Design logo',
    'Karbel': 'Karbel Carbon logo',
    'Karbonius': 'Karbonius Composites logo',
    'Keyvany': 'Keyvany GmbH logo',
    'Killer B Motorsport': 'Killer B Motorsport Subaru logo',
    'Kline Innovation': 'Kline Innovation exhaust logo',
    'KLM Race': 'KLM Race fabrication logo',
    'Kooks Headers': 'Kooks Headers and Exhaust logo',
    'KW Suspension': 'KW automotive logo',
    'Lamspeed': 'Lamspeed Racing logo',
    'Larte Design': 'Larte Design tuning logo',
    'Liberty Walk': 'Liberty Walk LB Performance logo',
    'Link ECU': 'Link Engine Management logo',
    'Lithiumax batteries': 'Lithiumax batteries logo',
    'LOBA Motorsport': 'LOBA Motorsport turbo logo',
    'Lorinser': 'Sportservice Lorinser logo',
    'Lumma': 'Lumma Design logo',
    'Mamba turbo': 'Mamba Turbocharger logo',
    'Manhart': 'Manhart Performance logo',
    'Mansory': 'Mansory Design logo',
    'Matts Carbon': 'Matts Carbon logo',
    'MCA Suspension': 'MCA Suspension logo',
    'Mega3 Performance': 'Mega3 Performance logo',
    'Mickey Thompson': 'Mickey Thompson Tires logo',
    'Milltek': 'Milltek Sport logo',
    'Modena Engineering': 'Modena Engineering gears logo',
    'Moser Engineering': 'Moser Engineering logo',
    'Motiv Motorsport': 'Motiv Motorsport tuning logo',
    'Mountune': 'Mountune performance logo',
    'MST Performance': 'MST Performance intake logo',
    'MV Forged': 'MV Forged wheels logo',
    'New Rage Cycles': 'New Rage Cycles logo',
    'Nitron Suspension': 'Nitron Racing Systems logo',
    'Novitec': 'Novitec Group logo',
    'Onyx Concept': 'Onyx Concept cars logo',
    'Pagid': 'Pagid Racing logo',
    'Paragon brakes': 'Paragon Performance brakes logo',
    'Power Division': 'Power Division MG Motorsport logo',
    'Premier Tuning Group': 'Premier Tuning Group logo',
    'Project 6GR': 'Project 6GR wheels logo',
    'ProTrack Wheels': 'ProTrack Wheels logo',
    'Pure Drivetrain Solutions': 'Pure Drivetrain Solutions logo',
    'Pure Turbos': 'Pure Turbos logo',
    'R44 Performance': 'R44 Performance BMW logo',
    'Racefoxx': 'Racefoxx logo',
    'Remus': 'Remus Innovation logo',
    'Renntech': 'Renntech Mercedes logo',
    'RES Exhaust': 'RES Exhaust logo',
    'RK Autowerks': 'RK Autowerks logo',
    'RKP': 'RKP Composites logo',
    'Rotobox': 'Rotobox wheels logo',
    'RPM Transmissions': 'RPM Transmissions logo',
    'RS-R': 'RS-R suspension logo',
    'RW Carbon': 'RW Carbon logo',
    'RYFT': 'RYFT exhaust logo',
    'Sachs Performance': 'Sachs Performance clutch logo',
    'Samco Sport': 'Samco Sport hoses logo',
    'Samsonas Motorsport': 'Samsonas Motorsport transmission logo',
    'Sandtler': 'Sandtler logo',
    'SC-Project': 'SC-Project exhaust logo',
    'Schrick': 'Dr. Schrick Nockenwellen logo',
    'Seibon': 'Seibon Carbon logo',
    'ShepTrans': 'ShepTrans transmission logo',
    'Southern Hotrod': 'Southern Hotrod transmission logo',
    'SPL Parts': 'SPL Parts suspension logo',
    'Spool Performance': 'Spool Performance fuel logo',
    'Starlane': 'Starlane Electronics logo',
    'Steeda': 'Steeda Autosports logo',
    'Sterckenn': 'Sterckenn carbon logo',
    'Stillen': 'Stillen performance logo',
    'STM Italy': 'STM Italy slipper clutch logo',
    'Stompgrip': 'Stompgrip tank pads logo',
    'STOPART ceramic': 'STOPART ceramic brakes logo',
    'Stoptech': 'StopTech braking systems logo',
    'Strasse wheels': 'Strasse Wheels logo',
    'Summit Racing': 'Summit Racing Equipment logo',
    'Supersprint': 'Supersprint Exhaust logo',
    'Team Oreca': 'Oreca Racing logo',
    'Termignoni': 'Termignoni exhaust logo',
    'TireRack': 'Tire Rack logo',
    'Titan Motorsport': 'Titan Motorsports logo',
    'Translogic': 'Translogic Systems logo',
    'TTE Turbos': 'The Turbo Engineers logo',
    'TTH turbos': 'TTH Turbo Technik Hamburg logo',
    'Tubi Style': 'Tubi Style exhaust logo',
    'Turner Motorsport': 'Turner Motorsport logo',
    'TWM': 'TWM Special Components logo',
    'Urban Automotive': 'Urban Automotive logo',
    'ValterMoto': 'Valter Moto Components logo',
    'Vandemon': 'Vandemon Performance logo',
    'Vargas Turbo': 'Vargas Turbo Technologies logo',
    'Velos Wheels': 'Velos Designwerks logo',
    'VF Engineering': 'VF Engineering supercharger logo',
    'Vorsteiner': 'Vorsteiner logo',
    'VP Racing Fuel': 'VP Racing Fuels logo',
    'VR Aero': 'VR Aero body kit logo',
    'VR Bespoke': 'VR Bespoke logo',
    'VR Forged': 'VR Forged wheels logo',
    'VR Performance': 'VR Performance logo',
    'Wagner Tuning': 'Wagner Tuning logo',
    'WALD': 'WALD International logo',
    'Wavetrac': 'Wavetrac differentials logo',
    'Weistec Engineering': 'Weistec Engineering logo',
    'WheelForce': 'WheelForce Wheels logo',
    'Whipple Superchargers': 'Whipple Superchargers logo',
    'WRS': 'WRS windscreens logo',
    'XDI fuel systems': 'XDI Xtreme-DI logo',
    'xHP': 'xHP Flashtool logo',
    'Zacoe': 'Zacoe Performance logo',
}

# Blacklist of terms that indicate a bad result
BLACKLIST_TERMS = [
    'hot wheels', 'lada', 'canada dry', 'ducati performance', '3m', 'akro', 
    'generic', 'stock photo', 'shutterstock', 'istock', 'dreamstime', 'alamy'
]

def search_and_download_logo(brand):
    print(f"Searching for {brand} logo...")
    
    # Use override query if available, otherwise default
    query = SEARCH_OVERRIDES.get(brand, f"{brand} logo filetype:svg")
    if brand not in SEARCH_OVERRIDES and 'logo' not in query:
        query += " logo"
    
    # Add 'automotive' or 'performance' context if not present and not a known big brand
    if brand not in ['BMW', 'Audi', 'Ford', 'Honda', 'Toyota', 'Ferrari', 'Lamborghini', 'Porsche']:
         if 'automotive' not in query and 'performance' not in query and 'racing' not in query and 'wheels' not in query and 'exhaust' not in query:
             query += " automotive"

    print(f"  Query: {query}")

    try:
        with DDGS() as ddgs:
            # Fetch more results to filter bad ones
            results = list(ddgs.images(query, max_results=10))
            
        if not results:
            print(f"  No results found for {brand}")
            return None

        for result in results:
            url = result['image']
            title = result['title'].lower()
            
            # Check blacklist
            if any(term in title for term in BLACKLIST_TERMS):
                print(f"  Skipping blacklisted result: {title}")
                continue
                
            # Prefer SVG, but accept PNG if high res
            ext = 'svg' if url.lower().endswith('.svg') else 'png'
            
            print(f"  Attempting to download: {url}")
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    content = response.content
                    
                    # Basic validation
                    if ext == 'svg':
                        if b'<svg' not in content and b'<?xml' not in content:
                            print("  Content was not a valid SVG")
                            continue
                    
                    filename = f"{brand.lower().replace(' ', '-').replace('/', '-').replace('.', '')}.{ext}"
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    print(f"  ✅ Successfully saved to {filepath}")
                    return filename
            except Exception as e:
                print(f"  Failed to download {url}: {e}")
                
    except Exception as e:
        print(f"  Search failed for {brand}: {e}")
        
    return None

def main():
    print("Starting smart logo download...")
    mapping = {}
    
    # Create a backup of the current mapping if possible, or just overwrite
    # We will generate a new mapping file content
    
    for brand in BRANDS:
        filename = search_and_download_logo(brand)
        if filename:
            mapping[brand] = f"/logos/{filename}"
        else:
            print(f"❌ Could not find logo for {brand}")
        
        time.sleep(1.5) # Respect rate limits

    # Generate the TypeScript file content
    ts_content = "// Auto-generated by scripts/smart_logo_fetcher.py\n\n"
    ts_content += "export const BRAND_LOGO_MAP: Record<string, string> = {\n"
    
    # Sort keys for consistent output
    for brand in sorted(mapping.keys()):
        ts_content += f"  '{brand}': '{mapping[brand]}',\n"
    
    ts_content += "};\n\n"
    
    ts_content += """const NORMALIZED_BRAND_LOGO_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(BRAND_LOGO_MAP).map(([key, value]) => [key.toLowerCase(), value])
);

export const getBrandLogo = (brandName: string): string => {
  if (!brandName) return '/logos/placeholder.svg';
  const normalizedName = brandName.trim().toLowerCase();
  return BRAND_LOGO_MAP[brandName] || NORMALIZED_BRAND_LOGO_MAP[normalizedName] || '/logos/placeholder.svg';
};
"""

    output_ts_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'lib', 'brandLogos.ts')
    with open(output_ts_path, 'w', encoding='utf-8') as f:
        f.write(ts_content)
    
    print(f"\nUpdated {output_ts_path}")

if __name__ == "__main__":
    main()
