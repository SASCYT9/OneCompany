# OneCompany Premium Design System

## Design Principles
- **Monolithic luxury**: lean into deep obsidian surfaces accented with warm copper and electric blues.
- **Precision layout**: generous grid (12/16 columns) with 32px baseline, 64/80px breathing room on hero sections.
- **Cinematic motion**: ease-out 450–700 ms transitions, parallax up to 8px, blur/shimmer for brand cues.
- **Material layering**: combine glassmorphism (backdrop-blur-xl) with radial gradients, noise overlays, and hairline borders (1px/0.5px).

## Palette
| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `222 59% 2%` | Global body background (obsidian).
| `--surface` | `222 48% 6%` | Cards, panels, navigation.
| `--surface-elevated` | `220 60% 10%` | Modal/glass overlays.
| `--accent-amber` | `36 96% 56%` (#ffb347) | Primary CTAs, highlights.
| `--accent-blue` | `209 94% 60%` (#5cbcff) | Secondary CTAs, hover glows.
| `--muted` | `220 15% 40%` | Body copy.
| `--border` | linear gradient hairlines with `rgba(255,255,255,0.08)`.

## Typography
- **Primary font**: Space Grotesk (300–600).
- **Headline scale**: Clamp from 32px → 96px with tight tracking (-0.02em) for hero logotype.
- **Supporting**: IBM Plex Mono for stats/pills.
- Use uppercase microcopy with 0.3em tracking, 0.75rem size.

## Components
- **Nav bar**: fixed, glass panel with glowing pill CTA, animated active indicator.
- **Hero split**: Each tile gets:
  - Cinematic video background with gradient overlays.
  - Top-left label pill, bottom stats grid with separators.
  - Hover lifts opacity + reveals CTA arrow.
- **Buttons**: gradient background (amber→coral) with inset border + glow drop shadow.
- **Cards**: use `bg-[radial-gradient(...)]` overlays + noise texture.

## Motion & Effects
- Use `backdrop-blur-2xl` + `shadow-[0_0_80px_rgba(255,179,71,0.35)]` for CTAs.
- Stats counters animate using `framer-motion` fade-up.
- Global noise layer (`body::before`) at 4% opacity for tactility.

## Implementation Checklist
1. Update global tokens & fonts in `globals.css` / `layout.tsx`.
2. Rebuild `Header` to glass nav with CTA + locale-aware links.
3. Refresh `Footer` with gradient divider + card grid.
4. Upgrade `[locale]/page.tsx` hero to follow the cinematic card spec.
5. Sweep shared UI components (cards, CTA buttons) to align with new tokens.
