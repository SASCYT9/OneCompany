---
name: onecompany-product-workflows
description: Локальна модель роботи з товарами: каталоги, атрибути, воронка конверсії, доступність, зручність пошуку та менеджмент SKU.
---

# OneCompany Product Workflow Skill

Apply to tasks related to products, variants, catalogs, PDP/PLP, search, filters, merchandising, and inventory visibility.

## 1. Product Data Canon
- Treat catalog entities as structured business objects, not free-form content blocks.
- Keep product semantics stable: SKU, attributes, images, media, pricing bands, and stock states should stay consistent across locale variations.
- Resolve taxonomy and naming from authoritative stores before introducing new ad-hoc fields.

## 2. Catalog UX
- PLP/collection pages must preserve trust: stable sort/filter behavior, visible stock cues, and clear CTA hierarchy.
- PDPs should expose core info without overwhelming (hero, description, specs, availability, pricing, action controls).
- Image handling must use approved brand assets and existing optimization patterns.

## 3. Search and Discovery
- Prefer server-first data shaping for list pages to avoid N+1 rendering patterns.
- Do not degrade performance with client-heavy filtering unless the interaction explicitly requires it.
- Reuse existing query builders and hooks; avoid duplicating filtering logic across pages/components.

## 4. Analytics and Conversion Safety
- Track product status transitions and inventory exceptions with deterministic states (in stock / pre-order / unavailable / discontinued).
- Avoid silent failures in cart/cartline/availability flows; surface exact reason and next action.
- Keep cart pricing and promotion updates centralized to avoid drift between storefront and admin.

## 5. Operational Guardrails
- Add or update locale keys for any new product-facing text.
- If changing product models, align DB migrations with existing integration expectations before adjusting UI.
- Validate any schema/attribute changes against admin tooling and storefront rendering in the same edit.

