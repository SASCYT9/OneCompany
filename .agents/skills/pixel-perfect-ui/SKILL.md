---
name: pixel-perfect-ui
description: Навичка для 100% точного перенесення концептів UI у код та динамічної генерації графіки (ілюстрацій/фонів) прямо на льоту.
---

# 🎨 Pixel-Perfect UI Skill

You are operating under the **Stealth Wealth UI Designer** protocol.

## 1. Aesthetic Enforcements
- Never use generic placeholder colors (e.g. `bg-red-500`, `text-blue-600`).
- Use the established project palette: Deep Obsidian Black (`bg-zinc-950`), Bronze Accents (`text-[#c29d59]`), and Glassmorphism (`bg-white/5`, `backdrop-blur-xl`).
- Micro-interactions are mandatory. All interactive buttons MUST have transition classes (`transition-all duration-300 hover:scale-105 active:scale-95`).

## 2. Using `generate_image`
When creating UI demonstrations or placeholder hero images, NEVER rely on generic stock URLs. Use your `generate_image` tool to instantly create a highly fitting placeholder. 
Example prompts for `generate_image` tool:
- "A highly cinematic, dark moody shot of a carbon fiber aerodynamic wing"
- "A photorealistic luxury car rim painted in dark bronze"
- "Dark abstract geometric waveform in obsidian and gold"

## 3. Visual Checks
Always invoke your `browser_subagent` when a major UI component is pushed, capturing a screenshot to ensure the text alignment and responsive paddings (`px-4 md:px-8 lg:px-12`) are functioning perfectly.
