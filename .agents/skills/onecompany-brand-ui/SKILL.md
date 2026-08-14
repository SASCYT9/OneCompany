---
name: onecompany-brand-ui
description: Стандарт бренду та UI для OneCompany: преміум-автосегмент, obsidian/bronze, точність UX і локалізований досвід UA/EN.
---

# OneCompany Brand UI Standard

Use these rules for all storefront and product-facing interface work.

## 1. Visual System

- Keep the premium automotive direction:
  - Obsidian dark surfaces (наприклад `bg-zinc-900`, `bg-black`, `text-zinc-200`/`text-zinc-100`).
  - Bronze accent (`text-[#c29d59]`, `border-[#c29d59]/25`) as the primary accent.
  - Restrained glassmorphism for premium panels only (`bg-white/5`, `backdrop-blur-xl`) and never for the main content background.
- Use actual brand assets only; do not introduce placeholder, stock, or AI-generated hero/product imagery.
- Prefer existing component primitives before creating new variants.
- Keep spacing and rhythm deliberate; avoid “generic landing page” layouts.

## 2. Copy and Localization

- Customer-facing shared UI copy belongs in `src/lib/messages/{ua,en}.json` and must
  preserve UA/EN parity. Product/catalog copy may instead come from paired localized
  database fields; follow the owning flow rather than duplicating it in messages.
- Small internal/admin-only labels may follow the existing unlocalized admin pattern,
  but do not leak them into the storefront.
- Keep typography expressive but restrained; reuse current font tokens before adding
  another typeface.

## 3. Motion and Interaction

- Keep motion purposeful: page transition + entry reveals only where they improve comprehension.
- Respect reduced motion and avoid non-essential loops.
- Animate only composited properties (`transform`, `opacity`) for interactive feedback.

## 4. Commerce Surface Specifics

- Product cards, carts, pricing, and checkouts should have a clear visual hierarchy and one primary action.
- Always provide empty-state guidance with a clear next action.
- Do not add decorative controls that compete with price, stock, and CTA areas.

## 5. Accessibility and Quality

- Keyboard focus and semantics are mandatory for interactive components.
- Include `aria-label` for icon-only controls.
- Use `h-dvh` for viewport-height layouts.
- Use `text-balance` for headings and `text-pretty` for body text where available.
