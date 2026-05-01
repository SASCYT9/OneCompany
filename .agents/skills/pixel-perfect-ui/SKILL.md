---
name: pixel-perfect-ui
description: Storefront UI implementation rules — palette, motion, imagery.
---

# Pixel-perfect UI

## Palette
- Surface: `bg-zinc-950`, `bg-black`. Text: `text-zinc-100`, `text-zinc-200`, muted `text-zinc-400`.
- Accent: bronze `#c29d59` — use as `text-[#c29d59]`, `border-[#c29d59]/25`, etc. Per-shop accents (Burger red, Akrapovic gold) live in that shop's CSS, don't hardcode them globally.
- Glassmorphism (`bg-white/5 backdrop-blur-xl`) only for premium overlay panels — never for primary content backgrounds.
- No generic Tailwind colors (`bg-red-500`, `text-blue-600`) on customer-facing UI.

## Motion
- Interactive controls get `transition-colors` or `transition-all duration-300` with a hover and active state. Use Framer Motion for layout/orchestrated motion, not for simple hover tints.
- Animate compositor-friendly props (`transform`, `opacity`). Avoid animating `width`, `height`, `top`, `left`.
- Respect `prefers-reduced-motion` for non-essential motion.

## Imagery
- Real official brand assets only. No stock filler, no AI-generated imagery on storefront pages — see project rule in `.agents/workflows/project-rules.md`.
- If an official asset isn't on hand, find another official one rather than substituting a placeholder.

## Responsive padding
- Page-level horizontal padding pattern: `px-4 md:px-8 lg:px-12` (or per-shop equivalent already in that shop's CSS).
