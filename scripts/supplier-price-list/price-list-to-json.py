"""Normalise a Dinan / APR dealer price list (xlsx) into JSON.

Both brands ship the same sheet: Brand, Category, Item, Item_Status, MAP, Retail,
Description, UPC, Length, Width, Height (inches), Weight (POUNDS), COI, HTS_Code,
Prop_65_Required, Emissions_Code, Emission_Description, EO_Number.

Usage: python -I -X utf8 scripts/supplier-price-list/price-list-to-json.py <price-list.xlsx> <out.json>
"""
import json
import os
import sys

import openpyxl


def number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def text(value):
    return str(value).strip() if value not in (None, "") else None


def main():
    source, target = sys.argv[1], sys.argv[2]
    sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).worksheets[0]
    rows = list(sheet.iter_rows(values_only=True))
    header = [str(cell).strip() for cell in rows[0]]
    items = []
    for raw in rows[1:]:
        if not any(raw):
            continue
        row = dict(zip(header, raw))
        items.append({
            "sku": text(row.get("Item")),
            "brand": text(row.get("Brand")),
            "category": text(row.get("Category")),
            "status": text(row.get("Item_Status")),
            "mapUsd": number(row.get("MAP")),
            "retailUsd": number(row.get("Retail")),
            "description": text(row.get("Description")),
            "upc": text(row.get("UPC")),
            "lengthIn": number(row.get("Length")),
            "widthIn": number(row.get("Width")),
            "heightIn": number(row.get("Height")),
            "weightLb": number(row.get("Weight")),
            "countryOfOrigin": text(row.get("COI")),
            "htsCode": text(row.get("HTS_Code")),
            "emissionsCode": text(row.get("Emissions_Code")),
            "emissionsDescription": text(row.get("Emission_Description")),
        })
    payload = {
        "schemaVersion": 1,
        "sourceFile": os.path.basename(source),
        "items": [item for item in items if item["sku"]],
    }
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
    print(f"{len(payload['items'])} rows -> {target}")


main()
