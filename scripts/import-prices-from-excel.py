import pandas as pd
import json
import os
import subprocess
import sys

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass # python 2 or old environment
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    excel_path = os.path.join(root_dir, "akrapovic_moto_prices.xlsx")
    scratch_dir = os.path.join(root_dir, "scratch")
    os.makedirs(scratch_dir, exist_ok=True)
    temp_json_path = os.path.join(scratch_dir, "temp_prices.json")

    print("📖 Reading akrapovic_moto_prices.xlsx...")
    if not os.path.exists(excel_path):
        print(f"❌ Error: File {excel_path} not found.")
        sys.exit(1)

    try:
        # Load the sheet, skipping the first 3 rows of headers/metadata
        # Header is on row 4 (0-indexed 3)
        df = pd.read_excel(excel_path, sheet_name="Akrapovič Moto", skiprows=3)
        
        # Columns in df:
        # Column 0: Марка
        # Column 1: Модель
        # Column 2: Артикул (SKU)
        # Column 3: Назва українською (UA)
        # Column 4: Назва англійською (EN)
        # Column 5: Ціна на сайті (EUR)
        # Column 6: Коригування ціни (EUR)
        # Column 7: Справжнє джерело ціни & Пояснення
        
        sku_col = df.columns[2]
        site_price_col = df.columns[5]
        manual_price_col = df.columns[6]

        updates = []
        for index, row in df.iterrows():
            sku = str(row[sku_col]).strip()
            # Skip empty or NaN SKU
            if pd.isna(row[sku_col]) or not sku or sku.lower() == "nan":
                continue

            try:
                # Parse manual correction price (Column G / index 6)
                manual_price = None
                raw_manual = str(row[manual_price_col]).replace('€', '').replace(' ', '').replace(',', '').strip()
                if raw_manual and raw_manual.lower() not in ["nan", "none", ""]:
                    try:
                        manual_price = float(raw_manual)
                        if manual_price <= 0:
                            manual_price = None
                    except Exception:
                        manual_price = None

                # Parse site price (Column F / index 5)
                site_price = 0
                raw_site = str(row[site_price_col]).replace('€', '').replace(' ', '').replace(',', '').strip()
                try:
                    site_price = float(raw_site)
                except Exception:
                    site_price = 0

                if site_price <= 0:
                    continue

                # Determine final selling price (manual override has priority, fallback to site_price * 0.95)
                price = manual_price if manual_price is not None else (site_price * 0.95)
                if price <= 0:
                    continue

                updates.append({
                    "sku": sku,
                    "priceEur": int(round(price)),
                    "compareAtEur": int(round(site_price))
                })
            except Exception as e:
                print(f"⚠️ Warning: Could not parse price for SKU {sku} (Error: {e})")

        if not updates:
            print("❌ No valid updates found in Excel sheet.")
            sys.exit(1)

        print(f"Saving {len(updates)} updates to temp JSON...")
        with open(temp_json_path, 'w', encoding='utf-8') as f:
            json.dump(updates, f, indent=2)

        # Trigger Node.js runner to perform DB updates
        node_script = os.path.join(root_dir, "scripts", "db-update-prices.ts")
        print(f"Executing database update script: {node_script}...")
        
        # Run node subprocess
        result = subprocess.run(["npx", "tsx", node_script], cwd=root_dir, capture_output=True, encoding="utf-8", shell=True)
        
        print("\n=== Subprocess Output ===")
        print(result.stdout)
        
        if result.returncode != 0:
            print("❌ Error during DB update:")
            print(result.stderr)
            sys.exit(1)
            
        print("🎉 Database successfully updated from Excel sheet!")

    except Exception as e:
        print(f"❌ An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
