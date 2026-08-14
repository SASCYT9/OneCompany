# Local skill references

Reviewed on 2026-08-14. These files are optional repository-local references; they
are not automatically active and do not override the root `AGENTS.md`, current code,
or an installed Codex skill.

## Maintained OneCompany references

- `nextjs-architect`: current Next.js 16 and repository routing/data boundaries.
- `onecompany-brand-ui`: OneCompany storefront design and UA/EN rules.
- `onecompany-commerce-domain`: pricing, checkout, orders, integrations, and
  side-effect boundaries.
- `onecompany-product-workflows`: PostgreSQL catalog, admin editing, overrides,
  cache, and storefront product flow.
- `pixel-perfect-ui`: compact visual implementation reference.

## Generic references

`baseline-ui`, `compress-images`, `e2e-testing-patterns`, `i18n-localization`,
`prisma-expert`, `scroll-experience`, `seo`, and `threejs-loaders` are imported
generic guidance. Use one only when it matches the task, and verify version-specific
advice against `package.json` and the existing implementation.

`brainstorming` is a legacy workflow reference and is not a mandatory gate for
normal implementation work.

Do not load this entire directory into context. Read the smallest relevant file.
