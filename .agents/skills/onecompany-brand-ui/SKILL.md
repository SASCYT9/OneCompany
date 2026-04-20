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
- Never hardcode visible text. Pull all UI copy from `src/lib/messages/` via existing localization flow.
- Preserve UA/EN parity: new strings must be added to both locales at the same time.
- Keep typography expressive but restrained; if a new font token is needed, justify it in one sentence in the PR notes.

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

