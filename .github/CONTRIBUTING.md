# Contributing to OneCompany

Thanks for your interest. This is a proprietary project (see [LICENSE](../LICENSE)),
but we accept contributions from invited collaborators and bug reports from the public.

## Reporting issues

- **Bugs**: open a [Bug Report](https://github.com/SASCYT9/OneCompany/issues/new?template=bug_report.yml)
- **Feature ideas**: open a [Feature Request](https://github.com/SASCYT9/OneCompany/issues/new?template=feature_request.yml)
- **Security vulnerabilities**: see [SECURITY.md](SECURITY.md) — **do not** open a public issue
- **Brand catalog findings**: use the [Brand Audit Finding](https://github.com/SASCYT9/OneCompany/issues/new?template=brand-audit-finding.yml) template

## Development workflow

### Prerequisites

- **Node.js** 20.x or later (LTS recommended)
- **npm** 10.x or later
- A local `.env.local` with required environment variables (see [README](../README.md))

### Setup

```bash
git clone https://github.com/SASCYT9/OneCompany.git
cd OneCompany
npm install
cp .env.example .env.local   # then fill in your values
npm run dev
```

### Branching strategy

| Branch              | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `master`            | Production. Deployed to Vercel automatically. Protected.            |
| `feature/<topic>`   | New features. Branch off `master`, PR into `master`.                |
| `fix/<topic>`       | Bug fixes.                                                          |
| `chore/<topic>`     | Tooling, CI, infra, docs.                                           |
| `refactor/<topic>`  | Refactors with no behavior change.                                  |

### Commit message format — Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) so that
[release-please](https://github.com/googleapis/release-please) can generate
the changelog automatically. Commit messages are validated by `commitlint` in CI.

```
<type>(<scope>)?: <short summary>

[optional body]

[optional footer(s)]
```

**Types:**

| Type        | Use for                                                  | Bumps version |
| ----------- | -------------------------------------------------------- | ------------- |
| `feat`      | New user-facing feature                                  | minor         |
| `fix`       | Bug fix                                                  | patch         |
| `perf`      | Performance improvement                                  | patch         |
| `refactor`  | Code change without behavior change                      | none          |
| `docs`      | Documentation only                                       | none          |
| `test`      | Adding or updating tests                                 | none          |
| `build`     | Build system, dependencies                               | none          |
| `ci`        | CI configuration                                         | none          |
| `chore`     | Tooling, maintenance, no production code change          | none          |
| `revert`    | Reverting a previous commit                              | (per type)    |

**Breaking changes** — append `!` after the type, or include `BREAKING CHANGE:`
in the footer. Bumps **major** version.

**Examples:**

```
feat(shop): add tiered shipping calculator for premium brands
fix(cart): prevent double-submit on checkout button
chore(deps): bump next from 16.2.4 to 16.3.0
refactor(brands)!: rename Brand.slug to Brand.handle

BREAKING CHANGE: API consumers using `slug` must migrate to `handle`.
```

### Pull requests

1. Branch off `master`.
2. Make focused changes — one logical change per PR.
3. Run `npm run lint` and ensure CI passes.
4. Fill in the PR template.
5. Request review from `@SASCYT9`.
6. Squash-merge once approved and all checks pass.

### What CI runs on every PR

- `eslint` lint
- `tsc --noEmit` typecheck
- `prisma validate` schema check
- `commitlint` on all commits in the PR
- CodeQL security scan
- Dependabot dependency PRs auto-merge once checks pass

## Code style

- Follow existing patterns in the file you're editing.
- Prefer editing existing files to creating new ones.
- No comments unless the **why** is non-obvious.
- No backwards-compatibility shims for unreleased features.
- Validate at system boundaries (user input, external APIs); trust internal code.

## Questions?

Open a [Discussion](https://github.com/SASCYT9/OneCompany/discussions) or email
`info@onecompany.global`.
