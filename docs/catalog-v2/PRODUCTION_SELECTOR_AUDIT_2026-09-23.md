# Production vehicle selector response audit

Date: 2026-09-23. Production deployment: `700a415e384520d574e31455df4ba6827ad38404`.

This audit makes read-only GET requests to the public fitment API. It measures the options the API returned; it does not prove that those options include every source-backed fitment.

## Auto scope

The API returned 40 makes, 276 make/model pairs, and 480 chassis options across 276 chassis queries. All 40 model responses and all 276 chassis responses declared partial coverage. 56 model queries returned no chassis options. These empty lists need to be compared with source evidence before being classified as missing data.

| Make | Models | Models with chassis | Models with no chassis |
| --- | ---: | ---: | ---: |
| Alpine | 2 | 1 | 1 |
| Audi | 28 | 27 | 1 |
| Bentley | 1 | 0 | 1 |
| BMW | 31 | 30 | 1 |
| BYD | 1 | 0 | 1 |
| Cupra | 4 | 4 | 0 |
| Dacia | 1 | 1 | 0 |
| Dodge | 2 | 0 | 2 |
| DS | 2 | 2 | 0 |
| Ferrari | 8 | 0 | 8 |
| Alfa Romeo | 2 | 2 | 0 |
| Fiat | 18 | 16 | 2 |
| Aston Martin | 1 | 0 | 1 |
| Ford | 25 | 16 | 9 |
| Honda | 2 | 2 | 0 |
| Genesis | 1 | 1 | 0 |
| Hyundai | 2 | 2 | 0 |
| Infiniti | 3 | 3 | 0 |
| Iveco | 2 | 0 | 2 |
| Lamborghini | 10 | 4 | 6 |
| Land Rover | 7 | 7 | 0 |
| Lotus | 2 | 0 | 2 |
| McLaren | 3 | 0 | 3 |
| Mercedes-Benz | 28 | 25 | 3 |
| MINI | 3 | 3 | 0 |
| Mitsubishi | 1 | 1 | 0 |
| Morgan | 2 | 0 | 2 |
| NIO | 2 | 0 | 2 |
| Porsche | 24 | 24 | 0 |
| Renault | 3 | 2 | 1 |
| SEAT | 4 | 4 | 0 |
| Nissan | 3 | 3 | 0 |
| Skoda | 2 | 2 | 0 |
| Subaru | 3 | 3 | 0 |
| Tesla | 3 | 3 | 0 |
| Toyota | 7 | 6 | 1 |
| Volkswagen | 26 | 26 | 0 |
| Wiesmann | 4 | 0 | 4 |
| Xiaomi | 1 | 0 | 1 |
| Zeekr | 2 | 0 | 2 |

## Moto scope

The public makes selector returned HTTP 503 `SELECTOR_NOT_READY`; no moto makes or downstream options could be enumerated.

## Interpretation

The response metadata confirms that the storefront cannot claim complete selector coverage. The auto matrix is a useful baseline for source-to-selector reconciliation. It is not a coverage pass: model/chassis expectations still need comparison with every published source and verified compatibility clause.
