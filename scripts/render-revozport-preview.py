"""Render the generated Revozport JSON preview as a browsable local gallery."""

from __future__ import annotations

import html
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "revozport-catalog-preview.json"
OUTPUT = ROOT / ".tmp" / "revozport-preview.html"


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def card(product: dict) -> str:
    source = product.get("source") or {}
    image = product.get("image")
    status = product.get("status", "DRAFT")
    status_label = "Готово до перевірки" if status == "ACTIVE" else "Чернетка"
    price = product.get("priceUsd")
    sea = source.get("seaShippingUsd")
    image_html = (
        f'<img src="{esc(image)}" alt="{esc(product.get("titleEn"))}" loading="lazy">'
        if image
        else '<div class="no-image">Фото потребує перевірки</div>'
    )
    return f'''<article class="card" data-search="{esc((product.get("sku", "") + " " + product.get("titleEn", "") + " " + product.get("titleUa", "")).lower())}" data-status="{esc(status)}">
  <div class="media">{image_html}<span class="badge {"ready" if status == "ACTIVE" else "draft"}">{esc(status_label)}</span></div>
  <div class="body">
    <div class="sku">{esc(product.get("sku"))}</div>
    <h2>{esc(product.get("titleEn"))}</h2>
    <p class="ua">{esc(product.get("titleUa"))}</p>
    <div class="facts">
      <span>{"$" + format(float(price), ",.2f") if price is not None else "Ціна уточнюється"}</span>
      <span>{"SEA UA: $" + format(float(sea), ",.2f") if sea is not None else "SEA UA: уточнюється"}</span>
    </div>
    <div class="meta">{esc(source.get("sheet"))} · {"Фото є" if image else "Без фото"}</div>
  </div>
</article>'''


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    products = data["products"]
    cards = "\n".join(card(product) for product in products)
    counts = data.get("counts", {})
    document = f'''<!doctype html>
<html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revozport catalog preview</title>
<style>
:root{{color-scheme:dark;--bg:#0b0c0f;--card:#15171c;--muted:#9da3af;--gold:#d3ad68;--line:#2a2e37}}
*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(circle at 50% -10%,#30312d 0,#0b0c0f 42%);color:#f5f5f4;font:14px/1.45 Inter,Arial,sans-serif}}
header{{position:sticky;top:0;z-index:5;padding:28px clamp(18px,4vw,56px) 20px;background:rgba(11,12,15,.92);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}}
.eyebrow{{color:var(--gold);font-size:11px;letter-spacing:.18em;text-transform:uppercase}}h1{{margin:8px 0 4px;font-size:clamp(24px,4vw,42px);font-weight:400;letter-spacing:.03em}}.sub{{margin:0;color:var(--muted)}}
.stats{{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}}.stat{{padding:8px 12px;border:1px solid var(--line);border-radius:999px;color:#d5d7dc}}.stat b{{color:#fff;margin-right:4px}}
.toolbar{{display:flex;gap:10px;flex-wrap:wrap}}input,button{{border:1px solid var(--line);background:#111318;color:#f5f5f4;border-radius:10px;padding:11px 13px;font:inherit}}input{{min-width:280px;flex:1}}button{{cursor:pointer}}button.active,button:hover{{border-color:var(--gold);color:var(--gold)}}
main{{padding:28px clamp(18px,4vw,56px) 60px}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}}.card{{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:.2s transform,.2s border-color}}.card:hover{{transform:translateY(-3px);border-color:#7a6540}}.media{{height:220px;position:relative;background:#22252b;display:grid;place-items:center;overflow:hidden}}.media img{{width:100%;height:100%;object-fit:cover}}.no-image{{padding:24px;color:var(--muted);text-align:center}}.badge{{position:absolute;top:10px;left:10px;padding:5px 8px;border-radius:999px;font-size:11px;background:#4d3032;color:#ffb6b9}}.badge.ready{{background:#24402f;color:#bde6c8}}.body{{padding:15px}}.sku{{color:var(--gold);font-size:11px;letter-spacing:.13em}}h2{{margin:7px 0;font-size:16px;line-height:1.25;font-weight:500}}.ua{{margin:0;min-height:40px;color:#b6bbc5;font-size:13px}}.facts{{display:flex;justify-content:space-between;gap:8px;margin-top:13px;font-size:12px;color:#fff}}.facts span:last-child{{color:#d0b77f;text-align:right}}.meta{{margin-top:12px;color:#737a86;font-size:11px}}.empty{{padding:60px;text-align:center;color:var(--muted);display:none}}
</style></head><body>
<header><div class="eyebrow">One Company · Revozport</div><h1>Каталог Revozport</h1><p class="sub">Візуальний предпросмотр усіх зібраних SKU перед імпортом у сайт</p>
<div class="stats"><span class="stat"><b>{len(products)}</b> SKU</span><span class="stat"><b>{counts.get("publish_candidates", 0)}</b> готові до перевірки</span><span class="stat"><b>{counts.get("draft_products", 0)}</b> чернетки</span><span class="stat"><b>{counts.get("products_with_sea_quote", 0)}</b> з SEA UA</span></div>
<div class="toolbar"><input id="search" placeholder="Пошук за SKU або назвою…"><button class="active" data-filter="all">Усі</button><button data-filter="ACTIVE">Готові</button><button data-filter="DRAFT">Чернетки</button></div></header>
<main><div id="grid" class="grid">{cards}</div><div id="empty" class="empty">Нічого не знайдено.</div></main>
<script>
const cards=[...document.querySelectorAll('.card')],input=document.querySelector('#search'),buttons=[...document.querySelectorAll('button')],empty=document.querySelector('#empty');let filter='all';
function render(){{const q=input.value.trim().toLowerCase();let visible=0;cards.forEach(c=>{{const ok=(filter==='all'||c.dataset.status===filter)&&(!q||c.dataset.search.includes(q));c.style.display=ok?'':'none';if(ok)visible++}});empty.style.display=visible?'none':'block'}}
input.addEventListener('input',render);buttons.forEach(b=>b.addEventListener('click',()=>{{filter=b.dataset.filter;buttons.forEach(x=>x.classList.toggle('active',x===b));render()}}));
</script></body></html>'''
    OUTPUT.write_text(document, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
