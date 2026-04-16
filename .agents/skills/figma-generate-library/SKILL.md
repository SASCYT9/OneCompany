---
name: figma-generate-library
description: Build or update a design system library in Figma from a codebase
---

# figma-generate-library

This skill parses local UI components (e.g., from `src/app/[locale]/shop/components`) and generates or updates a centralized Figma library containing their representations using the Figma CLI/`figma-use`.

## Usage Guidelines
- First, extract the API or React component structure.
- Construct semantic definitions based on `figma-use`'s ComponentSet methodology.
- Create all variations within a dedicated Design System document in Figma.
