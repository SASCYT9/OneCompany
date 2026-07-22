# Stock Fitment Audit

Generated: 2026-07-21T21:54:18.224Z

## Overall coverage

| Signal            | Products | Coverage |
| ----------------- | -------: | -------: |
| Make              |    13901 |    92.6% |
| Model             |    13378 |    89.1% |
| Chassis           |     5070 |    33.8% |
| Year              |    10876 |    72.4% |
| High confidence   |    12395 |    82.6% |
| Medium confidence |     1012 |     6.7% |
| Low confidence    |      494 |     3.3% |
| Unknown           |     1114 |     7.4% |

## Scope coverage

| Scope | Products |  Make | Model | Chassis | Unknown |
| ----- | -------: | ----: | ----: | ------: | ------: |
| Auto  |    14611 | 92.4% | 88.9% |   34.7% |    7.6% |
| Moto  |      404 | 99.3% | 97.3% |    0.0% |    0.7% |

## Workflow classification

| Status                | Products | Share |
| --------------------- | -------: | ----: |
| Inferred              |    13188 | 87.8% |
| Universal             |      678 |  4.5% |
| Needs review          |     1149 |  7.7% |
| Parent-dependent      |      285 |  1.9% |
| Parent SKU derived    |      276 | 96.8% |
| Parent product exists |      213 | 74.7% |
| Orphan parent SKU     |       63 | 22.1% |
| Parent SKU missing    |        9 |  3.2% |
| Verified              |        0 |  0.0% |

## Coverage by brand

| Brand              | Total | Make | Model | Chassis | Year | Unknown |
| ------------------ | ----: | ---: | ----: | ------: | ---: | ------: |
| RaceChip           |  5181 | 5181 |  5108 |    1252 | 5181 |       0 |
| Remus              |  3849 | 3847 |  3795 |    1480 | 3797 |       2 |
| DO88               |  1230 |  541 |   491 |     195 |  268 |     689 |
| Brabus             |   977 |  977 |   917 |     518 |   70 |       0 |
| GiroDisc           |   958 |  752 |   624 |     342 |  227 |     206 |
| Burger Motorsports |   666 |  597 |   507 |     313 |  176 |      69 |
| OHLINS             |   489 |  386 |   326 |     213 |  170 |     103 |
| AKRAPOVIC          |   419 |  411 |   397 |     298 |  269 |       8 |
| Ilmberger Carbon   |   339 |  336 |   336 |       0 |  325 |       3 |
| CSF                |   297 |  263 |   275 |     129 |  134 |      34 |
| Urban Automotive   |   259 |  259 |   253 |     153 |   17 |       0 |
| ADRO               |   240 |  240 |   240 |      99 |  132 |       0 |
| iPE exhaust        |   111 |  111 |   109 |      78 |  110 |       0 |

## Consistency checks

- Model/chassis review signals: 159 across 133 products
- Multi-family Porsche 911 products needing correlated applications: 70
- Overly broad inferred fitments: 130
- Canonical vehicle applications: 0
- Verified canonical applications: 0 (0.0%)
- Canonical model/chassis conflicts: 0
- Canonical applications missing make/model/chassis: 0/0/0

Unknown product samples are available in `fitment-audit.json`.
