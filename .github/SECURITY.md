# Security Policy

## Supported Versions

Only the latest version deployed to production (the `master` branch) receives
security updates. We do not maintain prior versions.

| Version           | Supported          |
| ----------------- | ------------------ |
| `master` (latest) | :white_check_mark: |
| Older commits     | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them via one of the following private channels:

1. **GitHub Security Advisories** (preferred):
   <https://github.com/SASCYT9/OneCompany/security/advisories/new>
2. **Email**: `security@onecompany.global`

Include the following in your report:

- Type of vulnerability (e.g., XSS, SQL injection, auth bypass, secret leak)
- Affected component or endpoint (file path, URL, or feature)
- Steps to reproduce, including any required preconditions
- Proof of concept or exploit code, if available
- Impact assessment — what an attacker could achieve

## Response Timeline

| Phase             | Target                                                |
| ----------------- | ----------------------------------------------------- |
| Acknowledgement   | Within **3 business days** of receipt                 |
| Initial triage    | Within **7 business days**                            |
| Status updates    | Every **7 days** until resolution                     |
| Fix & disclosure  | Coordinated with reporter; typically **30–90 days**   |

## Scope

**In scope:**

- The OneCompany application source code in this repository
- The production deployment at `https://onecompany.global`
- API endpoints under `/api/*`
- The `/admin` interface

**Out of scope:**

- Third-party dependencies (please report upstream; we will update once a fix is released)
- Social engineering, physical attacks, or phishing
- Denial-of-service attacks
- Issues in vendor infrastructure (Vercel, Prisma Cloud, Resend, etc.) — report directly to the vendor

## Disclosure Policy

We follow **coordinated disclosure**. Please give us reasonable time to fix
the issue before any public disclosure. We will credit reporters in the
release notes unless they request anonymity.

## Safe Harbor

Good-faith security research conducted within the rules above will not result
in legal action by OneCompany. Activities that fall outside this policy
(data exfiltration, service disruption, account takeover of real users,
etc.) are not covered.
