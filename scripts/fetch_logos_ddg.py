import os
import time
import requests
from duckduckgo_search import DDGS

# List of brands to fetch
BRANDS = [
    'Akrapovic',
    'Eventuri',
    'KW',
    'HRE',
    'Brembo',
    'Vorsteiner',
    'Armytrix',
    'CSF',
    'Manhart',
    'Renntech',
    'Velos',
    'Weistec'
]

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'logos')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def search_and_download_logo(brand):
    print(f"Searching for {brand} logo...")
    query = f"{brand} logo filetype:svg"
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=5))
            
        if not results:
            print(f"No results found for {brand}")
            return None

        # Try to download the first valid SVG
        for result in results:
            url = result['image']
            if not url.lower().endswith('.svg'):
                continue
                
            print(f"Attempting to download: {url}")
            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    # Check if it's actually an SVG (sometimes headers lie or it's HTML)
                    content = response.content
                    if b'<svg' in content or b'<?xml' in content:
                        filename = f"{brand.lower().replace(' ', '-')}.svg"
                        filepath = os.path.join(OUTPUT_DIR, filename)
                        with open(filepath, 'wb') as f:
                            f.write(content)
                        print(f"Successfully saved to {filepath}")
                        return filename
                    else:
                        print("Content was not a valid SVG")
            except Exception as e:
                print(f"Failed to download {url}: {e}")
                
    except Exception as e:
        print(f"Search failed for {brand}: {e}")
        
    return None

def main():
    print("Starting logo download...")
    mapping = {}
    
    for brand in BRANDS:
        filename = search_and_download_logo(brand)
        if filename:
            mapping[brand] = f"/logos/{filename}"
        time.sleep(1) # Be nice to the API

    print("\nDownload complete.")
    print("\nAdd this to src/lib/brandLogos.ts:")
    for brand, path in mapping.items():
        print(f"  '{brand}': '{path}',")

if __name__ == "__main__":
    main()
