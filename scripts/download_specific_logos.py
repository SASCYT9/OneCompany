import os
import requests

LOGOS = {
    "akrapovic.svg": "https://upload.wikimedia.org/wikipedia/commons/0/01/Akrapovi%C4%8D_logo.svg",
    "hre.svg": "https://upload.wikimedia.org/wikipedia/commons/c/c4/HRE_Performance_Wheels_logo.svg",
    "brembo.svg": "https://upload.wikimedia.org/wikipedia/commons/1/17/Brembo_logo.svg",
    "vorsteiner.svg": "https://seeklogo.com/images/V/vorsteiner-logo-0B0D7D7F5E-seeklogo.com.svg", 
    "armytrix.svg": "https://seeklogo.com/images/A/armytrix-logo-4F4F4F4F4F-seeklogo.com.svg",
    "csf.svg": "https://cdn.worldvectorlogo.com/logos/csf.svg",
    "manhart.svg": "https://cdn.worldvectorlogo.com/logos/manhart-performance.svg",
    "renntech.svg": "https://cdn.worldvectorlogo.com/logos/renntech.svg",
    "velos.svg": "https://cdn.worldvectorlogo.com/logos/velos.svg",
    "weistec.svg": "https://cdn.worldvectorlogo.com/logos/weistec.svg"
}

# Fallback URLs if the above fail or are placeholders
FALLBACKS = {
    "vorsteiner.svg": "https://cdn.worldvectorlogo.com/logos/vorsteiner.svg",
    "armytrix.svg": "https://cdn.worldvectorlogo.com/logos/armytrix.svg"
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'logos')
os.makedirs(OUTPUT_DIR, exist_ok=True)

def download_logo(filename, url):
    print(f"Downloading {filename} from {url}...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            # Check if it looks like an SVG
            if b'<svg' in response.content or b'<?xml' in response.content:
                filepath = os.path.join(OUTPUT_DIR, filename)
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                print(f"Successfully saved {filename}")
                return True
            else:
                print(f"Warning: Content for {filename} does not look like an SVG.")
        else:
            print(f"Failed to download {filename}: Status {response.status_code}")
    except Exception as e:
        print(f"Error downloading {filename}: {e}")
    return False

def main():
    for filename, url in LOGOS.items():
        success = download_logo(filename, url)
        if not success and filename in FALLBACKS:
            print(f"Trying fallback for {filename}...")
            download_logo(filename, FALLBACKS[filename])

if __name__ == "__main__":
    main()
