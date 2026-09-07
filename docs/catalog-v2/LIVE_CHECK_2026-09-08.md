# Live catalog check — 2026-09-08

Baseline branch: `301a8044`, followed by the enum-parameter fix recorded with this report.
Read-only HTTP requests targeted localhost:3200 and onecompany.global. Local Next start
used the existing configured remote database; it was not a DB-less fixture. No deployment,
production migration, import, checkout, or source-data mutation was performed.

## Observations

Three sequential requests per scenario, from this workstation; this is a diagnostic sample,
not a percentile benchmark or a controlled before/after comparison of equal deployments.

| Scenario | Local branch | Production |
| --- | --- | --- |
| BMW M5 G90 search API, full response | 8.397 s first; 2.391 / 2.080 s repeated | 8.459 s first; 0.063 / 0.075 s repeated (CDN) |
| Search results | 24 on first page, 52 total | 24 on first page, 52 total |
| Direct V2 catalog HTML | 1 card; 1.823 / 1.136 / 0.957 s full body | Legacy shell; HTML timing is not product-ready timing |
| Burger S68 JB4 PDP HTML | 0.793 s single sample after rebuild | 0.274 / 0.078 / 0.074 s, cache HIT |

The local catalog started response headers in 31–32 ms on repeated requests, but full
HTML took roughly one second. Header timing must not be presented as product-loading time.
Images, hydration, device CPU and full visual readiness are not covered by these HTTP timings.

Server-Timing identified legacy vehicle resolution as the main API cost: 2,009.5 ms locally,
and 7,855.6 ms in the production response's cached origin timing. Local products/facets/count
took 47.7 / 40.8 / 85.3 ms; local total was 2,215.3 ms. Production origin total was 8,307.4 ms.
CDN response latency and origin processing latency must be kept separate.

## Defect discovered and fixed

The partial-selector SQL compared an enum column to a Prisma-bound text parameter,
causing PostgreSQL 42883 and HTTP 500. Added an explicit enum cast. The integration fixture
now uses actual enum columns and models Prisma's typed text binding; it reproduced the
failure before the fix and passed afterward. The production-shaped local build also passed.

After rebuilding, actual local HTTP requests returned:

- BMW/M5 chassis: HTTP 200, F90 and G90, explicitly partial coverage (1,019 ms first request).
- BMW/M5/G90 engines: HTTP 200, empty list, explicitly partial coverage (363 ms).
- Production BMW/M5 chassis returned four options in the earlier probe.

## Release implication

Full V2 activation is still unsuitable: the native SSR sample returned only one card while
the compatible search API returned 52 total products, and selector data is incomplete.
Keep the complete legacy-compatible search path available. There is no defensible overall
speedup multiplier or cost-saving percentage from this test. Prioritize vehicle-resolution
latency and result parity before expanding V2 traffic.
