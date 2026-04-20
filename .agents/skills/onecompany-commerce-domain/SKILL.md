---
name: onecompany-commerce-domain
description: Бізнес-орієнтована навігація рішень для OneCompany: B2B/B2C сегментація, WhitePay, Turn14 та операційна модель магазину.
---

# OneCompany Commerce Domain Skill

Use this whenever product, pricing, order, account, payment, catalog-sync, or fulfillment logic is touched.

## 1. Core Business Boundaries
- Respect explicit B2B/B2C separation in pricing, approvals, permissions, and account behavior.
- Never mix B2B and B2C data paths without intentional migration notes and migration-safe guards.
- Preserve `WhitePay` as the active payment direction. Do not reintroduce removed payment providers unless explicitly requested and architecture supports it.
- Never assume external API is source-of-truth for operational state; rely on local DB patterns already used in the project.

## 2. Source-of-Truth Discipline
- `prisma/schema.prisma` is the canonical data contract for model changes.
- For storefront building blocks, follow existing patterns in `src/app/[locale]/shop/components`.
- For pricing/amount formatting and tax/VAT wording, use current shop currency helpers and existing helper utilities.

## 3. Product and Order Thinking
- Track catalog lifecycle as: supplier update → local normalization → storefront surface.
- Preserve supplier and inventory constraints; validate stock/availability before allowing checkout progression.
- Keep order state transitions explicit and auditable; avoid implicit status guessing in UI components.
- Never bypass existing domain service layers for business-critical actions.

## 4. Integration Safety
- Turn14 sync changes must be reviewed end-to-end: connector input → persistence model → storefront/CRM usage.
- When changing any integration boundary, document assumptions and fallback behavior for third-party failures.
- Keep webhook, cron, and external caller paths idempotent where possible.

## 5. Delivery Checklist
- Any commerce change should confirm:
  - B2B/B2C behavior not merged
  - pricing/tax copy still sourced through helpers
  - localization key exists for new UI copy
  - payment path stays in WhitePay flow
  - error states have concrete user recovery action

