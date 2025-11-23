import json
import re

# 1. Load the full list
with open('scripts/brands-list.json', 'r') as f:
    data = json.load(f)

all_brands = []
for category in data['categories'].values():
    all_brands.extend(category)

# 2. Load the fixed list (parse the TS file)
with open('scripts/fix-bad-logos.ts', 'r') as f:
    ts_content = f.read()

# Extract keys from MANUAL_OVERRIDES
# Look for: 'Brand Name': { ... }
fixed_brands = re.findall(r"^\s*'([^']+)'\s*:\s*\{", ts_content, re.MULTILINE)

# Normalize for comparison
def normalize(s):
    return s.lower().strip()

fixed_set = set(normalize(b) for b in fixed_brands)

remaining = []
for brand in all_brands:
    if normalize(brand) not in fixed_set:
        remaining.append(brand)

# Remove duplicates and sort
remaining = sorted(list(set(remaining)))

print(f"Total brands: {len(all_brands)}")
print(f"Fixed brands: {len(fixed_brands)}")
print(f"Remaining brands: {len(remaining)}")
print("-" * 20)
for brand in remaining:
    print(brand)
