---
description: Automated Self-Audit Macro for AI Agent
---

# 🕵️‍♂️ Auto-Audit Workflow

**Goal**: To automatically verify code health (TypeScript types & ESLint) without bothering the user to check it manually.

If the user asks you to "run an audit", "check if everything is ok", or "verify your code", you must automatically execute this workflow.

// turbo-all
1. Run `npx tsc --noEmit` to verify type safety across the entire repository.
2. Run `npm run lint` or `npx eslint .` to check for style violations or unused variables.
3. If errors are found, you must immediately read the failing files, use your `replace_file_content` tool to FIX the errors, and run step 1 again. 
4. DO NOT report back to the user until you have achieved a clean compilation state, or if the errors are fundamentally blocked by a missing library or external API dependency.
5. Create a `wiki/✅ Audit Report.md` summarizing what you checked and fixed.
