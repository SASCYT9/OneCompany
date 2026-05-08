# Archive

Historical artifacts from the project root. **Nothing here is part of the
production build** — `archive/` is excluded from `tsconfig.json` and not
imported by `src/` code.

Kept under version control so historical context, sample data, and one-off
debugging scripts are not lost.

## Layout

| Folder           | Contents                                                       |
| ---------------- | -------------------------------------------------------------- |
| `screenshots/`   | UI snapshots from past audits (Adro, IPE, GiroDisc catalogs)   |
| `data-dumps/`    | One-time catalog and product JSON / CSV exports                |
| `logs/`          | Debug logs and snapshot reports                                |
| `scratch/`       | Ad-hoc JS / TS / HTML scripts used during exploration          |
| `blender/`       | Blender add-ons and procedural generation scripts              |

## Policy

- **New scratch work goes here**, not in the project root.
- Files in `archive/` are exempt from lint and typecheck.
- Anything unused for 12+ months may be candidate for removal — but only
  remove if there's no chance of needing the historical context.
