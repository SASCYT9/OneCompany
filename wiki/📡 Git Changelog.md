---
tags: [changelog, git]
---

# 📡 Живий Журнал Змін (Git Changelog)

> [!info] Системний Журнал
> Цей файл оновлюється **автоматично** при кожному збереженні коду завдяки спеціальному Git Hook. Obsidian напряму бачить, що відбувається у матриці розробки.

---

## 🕒 Останні Оновлення Коду

<!-- HOOK_INJECT_MARKER -->

### 🟢 [2026-04-06 03:03] Commit `99a24ece`
**Автор**: 👤 SASCYT9

> feat(storefront): Stealth Wealth 2.0 upgrades (Audio visualizer, Tilt effects) & JSON-LD SEO Schema
> 
> - Integrated Web Audio API for Akrapovic
> 
> - Added Framer Motion tilt physics for Brabus
> 
> - Generated and injected JSON-LD Store and Organization metadata
> 
> - Finalized multi-warehouse inventory UI and schema migration

#### 📂 Змінені файли:
- **A**: `.agents/skills/gsap-skills`
- **A**: `.agents/skills/guanyang-skills`
- **A**: `.agents/skills/nextjs-architect/SKILL.md`
- **A**: `.agents/skills/obsidian-master/SKILL.md`
- **M**: `.agents/skills/pixel-perfect-ui/SKILL.md`
- **A**: `.agents/skills/rmyndharis-skills`
- **A**: `.agents/skills/rominirani-skills`
- **A**: `.agents/skills/sickn33-awesome-skills`
- **A**: `.agents/skills/ui-ux-pro-max-skill`
- **A**: `.agents/workflows/auto_audit.md`
- **M**: `.agents/workflows/project-rules.md`
- **M**: `AGENTS.md`
- **M**: `prisma/schema.prisma`
- **A**: `scripts/install-obsidian-plugin.ps1`
- **A**: `scripts/migrate-inventory.js`
- **M**: `src/app/[locale]/shop/akrapovic/page.tsx`
- **M**: `src/app/[locale]/shop/brabus/page.tsx`
- **M**: `src/app/[locale]/shop/components/AkrapovicSoundPlayer.tsx`
- **M**: `src/app/[locale]/shop/components/BrabusHomeSignature.tsx`
- **A**: `src/app/[locale]/shop/components/BrabusTiltCard.tsx`
- **M**: `src/app/[locale]/shop/data/do88HomeData.ts`
- **M**: `src/app/[locale]/shop/do88/page.tsx`
- **M**: `src/app/[locale]/shop/urban/page.tsx`
- **M**: `src/app/admin/shop/inventory/page.tsx`
- **M**: `src/app/admin/shop/orders/[id]/page.tsx`
- **M**: `src/app/admin/shop/page.tsx`
- **A**: `src/app/admin/shop/seo/page.tsx`
- **M**: `src/app/api/admin/shop/inventory/route.ts`
- **A**: `src/app/api/admin/shop/orders/[id]/stripe/route.ts`
- **A**: `src/app/api/admin/shop/seo-generate/route.ts`
- **A**: `src/app/api/admin/shop/seo-missing/route.ts`
- **A**: `src/app/api/webhooks/stripe/route.ts`
- **A**: `src/lib/jsonLd.tsx`
- **M**: `src/lib/shopAdminVariants.ts`
- **A**: `wiki/.gitignore`
- **M**: `wiki/.makemd/fileCache.mdc`
- **M**: `wiki/.makemd/superstate.mdc`
- **M**: `wiki/.obsidian/community-plugins.json`
- **M**: `wiki/.obsidian/graph.json`
- **A**: `wiki/.obsidian/plugins/obsidian-copilot/data.json`
- **A**: `wiki/.obsidian/plugins/obsidian-copilot/main.js`
- **A**: `wiki/.obsidian/plugins/obsidian-copilot/manifest.json`
- **A**: `wiki/.obsidian/plugins/obsidian-copilot/styles.css`
- **M**: `wiki/.obsidian/plugins/obsidian-excalidraw-plugin/data.json`
- **M**: `wiki/.obsidian/plugins/obsidian-excalidraw-plugin/main.js`
- **M**: `wiki/.obsidian/plugins/obsidian-excalidraw-plugin/manifest.json`
- **M**: `wiki/.obsidian/plugins/obsidian-excalidraw-plugin/styles.css`
- **M**: `wiki/.obsidian/plugins/obsidian-git/main.js`
- **A**: `wiki/.obsidian/plugins/obsidian-projects/data.json`
- **A**: `wiki/.obsidian/plugins/obsidian-projects/main.js`
- **A**: `wiki/.obsidian/plugins/obsidian-projects/manifest.json`
- **A**: `wiki/.obsidian/plugins/obsidian-projects/styles.css`
- **A**: `wiki/.obsidian/plugins/smart-connections/data.json`
- **A**: `wiki/.obsidian/plugins/smart-connections/main.js`
- **A**: `wiki/.obsidian/plugins/smart-connections/manifest.json`
- **A**: `wiki/.obsidian/plugins/smart-connections/styles.css`
- **M**: `wiki/.obsidian/workspace.json`
- **M**: `wiki/Tasks Kanban.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Clip Web Page.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Clip YouTube Transcript.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Emojify.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Explain like I am 5.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Fix grammar and spelling.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Generate glossary.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Generate table of contents.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Make longer.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Make shorter.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Remove URLs.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Rewrite as tweet thread.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Rewrite as tweet.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Simplify.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Summarize.md`
- **A**: `wiki/copilot/copilot-custom-prompts/Translate to Chinese.md`
- **A**: `"wiki/\360\237\217\233\357\270\217 \320\220\321\200\321\205\321\226\321\202\320\265\320\272\321\202\321\203\321\200\320\260 CRM.md"`
- **A**: `"wiki/\360\237\223\241 Code Map.md"`
- **M**: `"wiki/\360\237\223\241 Git Changelog.md"`
- **A**: `"wiki/\360\237\227\272\357\270\217 \320\223\320\273\320\276\320\261\320\260\320\273\321\214\320\275\320\260 \320\220\321\200\321\205\321\226\321\202\320\265\320\272\321\202\321\203\321\200\320\260.canvas"`
- **A**: `"wiki/\360\237\232\200 \320\223\320\276\320\273\320\276\320\262\320\275\320\260 (Dashboard).md"`

---


### 🟢 [2026-04-06 01:26] Commit `91ff70ed`
**Автор**: 👤 SASCYT9

> feat(obsidian): add Ideas Hub and Git Changelog Automation

#### 📂 Змінені файли:
- **A**: `.agents/scripts/obsidian_git_changelog.js`
- **A**: `.agents/workflows/add_new_brand.md`
- **A**: `.agents/workflows/system_audit.md`
- **M**: `.gitignore`
- **M**: `AGENTS.md`
- **A**: `fixUrbanDb.mjs`
- **A**: `replaceUrbanImages.ts`
- **M**: `src/app/[locale]/shop/adro/adro-shop.css`
- **M**: `src/app/[locale]/shop/akrapovic/akrapovic-shop.css`
- **M**: `src/app/[locale]/shop/akrapovic/collections/page.tsx`
- **M**: `src/app/[locale]/shop/burger/burger-shop.css`
- **M**: `src/app/[locale]/shop/checkout/ShopCheckoutClient.tsx`
- **M**: `src/app/[locale]/shop/components/AdroHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/AkrapovicHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/BrabusHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/BrabusShopProductDetailLayout.tsx`
- **M**: `src/app/[locale]/shop/components/BurgerShopProductDetailLayout.tsx`
- **M**: `src/app/[locale]/shop/components/BurgerStoreHome.tsx`
- **M**: `src/app/[locale]/shop/components/BurgerVehicleFilter.tsx`
- **M**: `src/app/[locale]/shop/components/CSFHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/GiroDiscHomeSignature.tsx`
- **A**: `src/app/[locale]/shop/components/IpeAudioConsole.tsx`
- **M**: `src/app/[locale]/shop/components/IpeHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/OhlinsHomeSignature.tsx`
- **M**: `src/app/[locale]/shop/components/OurStoresPortal.module.css`
- **M**: `src/app/[locale]/shop/components/RacechipShopProductDetailLayout.tsx`
- **M**: `src/app/[locale]/shop/components/RacechipVehicleFilter.tsx`
- **A**: `src/app/[locale]/shop/components/ScrollRevealClient.tsx`
- **M**: `src/app/[locale]/shop/components/UrbanHomeSignature.tsx`
- **A**: `src/app/[locale]/shop/components/UrbanVehicleFilter.tsx`
- **A**: `src/app/[locale]/shop/components/canvas/AdroCanvas.tsx`
- **A**: `src/app/[locale]/shop/components/canvas/CSFCanvas.tsx`
- **A**: `src/app/[locale]/shop/components/canvas/IpeWaveCanvas.tsx`
- **A**: `src/app/[locale]/shop/components/canvas/OhlinsCanvas.tsx`
- **M**: `src/app/[locale]/shop/csf/collections/page.tsx`
- **M**: `src/app/[locale]/shop/csf/csf-shop.css`
- **M**: `src/app/[locale]/shop/girodisc/collections/page.tsx`
- **M**: `src/app/[locale]/shop/girodisc/girodisc-shop.css`
- **M**: `src/app/[locale]/shop/ipe/ipe-shop.css`
- **M**: `src/app/[locale]/shop/ohlins/collections/page.tsx`
- **M**: `src/app/[locale]/shop/ohlins/ohlins-shop.css`
- **M**: `src/app/[locale]/shop/racechip/catalog/page.tsx`
- **A**: `src/app/[locale]/shop/urban/products/page.tsx`
- **M**: `src/app/globals.css`
- **M**: `src/components/admin/MessagesPanel.tsx`
- **M**: `src/components/layout/Header.tsx`
- **M**: `src/components/sections/BrandLogosGrid.tsx`
- **A**: `src/hooks/useOptimizedCanvas.ts`
- **A**: `src/hooks/useScrollReveal.ts`
- **M**: `src/lib/shopCatalogServer.ts`
- **M**: `src/styles/uh7-theme.css`
- **M**: `src/styles/urban-collections.css`
- **M**: `src/styles/urban-shop.css`
- **M**: `tailwind.config.ts`
- **M**: `wiki/.makemd/fileCache.mdc`
- **M**: `wiki/.makemd/superstate.mdc`
- **M**: `wiki/.obsidian/graph.json`
- **M**: `wiki/.obsidian/workspace.json`
- **M**: `wiki/Home.md`
- **A**: `wiki/SOP - Standard Operating Procedures.md`
- **A**: `wiki/Shop Master Plan.md`
- **A**: `wiki/Tasks Kanban.md`
- **A**: `wiki/Templates/Idea Template.md`
- **A**: `"wiki/\360\237\223\241 Git Changelog.md"`

---


