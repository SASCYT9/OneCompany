---
description: Critical project rules and restrictions
---

# Project Rules

## 🚫 AIRTABLE — READ ONLY (ABSOLUTE PROHIBITION)

**Under NO circumstances may ANY code write to, modify, update, or delete data in Airtable.**

- All Airtable interaction is **READ-ONLY** — fetching data only
- No POST, PUT, PATCH, DELETE requests to the Airtable API — EVER
- All data changes happen **locally** in our PostgreSQL database only
- CRM sync pulls data FROM Airtable → INTO local DB (one-way read)

This rule applies to:
- All API routes
- All sync services
- All background jobs
- All manual scripts

**Violation of this rule is critical and unacceptable.**

## 🚫 ALL EXTERNAL APIs — READ ONLY

**For the time being, ALL external APIs in the project (including Turn14, Airtable, etc.) must be treated as READ-ONLY.**

- Do not write, post, update, or delete any data on external platforms.
- Only FETCH / GET data from APIs.
- All modifications to state or records must be saved LOCALLY in the PostgreSQL database only.

## 🚫 ANTI-PATTERNS (CRIMINAL CODE)

**The AI must NEVER write code using the following anti-patterns:**
1. **No CSS-in-JS**: Never install or use `styled-components` or `emotion`. We strictly use Tailwind CSS + inline classes.
2. **No Redux / Global Context for Data**: Never scaffold a global React Context for server data. Use React Server Components and pass props, or rely on URL searchParams for stateless filters.
3. **No Direct DOM Manipulation**: Do not use `document.getElementById` or `window.location.reload()`. Use React `useRef` and Next.js `useRouter` / `revalidatePath`.
4. **No Console Errors**: Never leave unused variables, unhandled Promise rejections, or raw `console.log` statements in production components.
5. **No Blind Imports**: Do not import packages that are not in `package.json`. Always check before using a third-party library.
