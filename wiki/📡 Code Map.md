---
tags: [architecture, technical, map]
date_created: "2026-04-06"
---

# 📡 Codebase Map (Compass)

> **Agent Note**: Read this file to instantly orient yourself in the codebase. Do not guess where files are located.

##  Core Domains

### 🛍️ Storefront (B2C & B2B)
- `src/app/[locale]/shop` — The main Next.js App Router for the storefront.
- `src/app/[locale]/shop/products/[slug]` — Product detail pages.
- `src/app/[locale]/shop/components` — Shared, highly reusable client/server components.
- `src/app/api/webhooks/` — Webhooks (Stripe, WhitePay, Shopify).

### 🏢 Admin Panel
- `src/app/admin` — The protected admin dashboard.
- `src/app/admin/shop/` — The E-commerce CMS (Catalog, Orders, Customers, SEO Machine, Pricing).
- `src/app/api/admin/` — Admin-only secured API routes (e.g., SEO Generation, Fetching integrations).

### ⚙️ Lib & Utilities
- `src/lib/turn14.ts` & `src/lib/turn14Sync.ts` — Heavy lifting for B2B API integrations (Turn14 network).
- `src/lib/prisma.ts` — The global Prisma Client standard singleton.
- `prisma/schema.prisma` — The beating heart of the data layer. Every DB mod starts here.

## Styling, 3D & Theme
- `src/app/globals.css` — Global Tailwind resets and Stealth Wealth color variables.
- `tailwind.config.ts` — Custom breakpoints, animations, and color palettes.
- Див. [[🎨 3D & Animation Stack]] — Деталі про R3F (React Three Fiber), GSAP та Framer Motion.

## 📂 Автоматизація та Скрипти (Scripts)
- `scripts/` — Понад 100 утиліт для парсингу (scraping), імпорту товарів, перекладів (через Gemini/DeepL) та адміністрування БД. 
- Детальніше: [[📂 Scripts Encyclopedia]]

## 🤖 AI Agent Syndicate
- `.agents/handoffs/` — Shared memory / task exchange between AI agents.
- `.agents/workflows/multi-agent.md` — Multi-agent orchestration workflow.
- `.agents/scripts/litellm_config.yaml` — LiteLLM proxy config (routes all Claude models → local Gemma 4:26b).
- `.agents/scripts/Start-LocalClaude.ps1` — PowerShell launcher for Claude Code on local LLM.
- `.agents/mcp-servers/ollama-bridge/` — MCP server bridging to Ollama API.
- `wiki/AI Agent Syndicate.md` — Full documentation of the agent system.

## 💬 Telegram Bot
- Бот для спілкування та сапорту на базі фреймворку `grammy`.
- `scripts/telegram-bot-polling.js` — Локальний запуск (Polling).
- `src/app/api/webhooks/telegram/` — Webhooks для Production.
- Детальніше: [[🤖 Telegram Bot]]

## 📄 Архіви та Документація
- `docs/` — Історичні бекапи, статуси по інтеграції з Shopify, презентації для інвесторів (PDF/HTML), та старі плани розробки. Більшість ключових знань мігрує сюди у `wiki/`.
- `tests/` — Юніт, інтеграційні та E2E тести (Playwright/Node test runner).
