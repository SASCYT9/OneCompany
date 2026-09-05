# Production vehicle selector audit — 2026-09-05

Read-only snapshot of /api/shop/stock/fitment for both scopes and every returned make: 68 auto makes and 2 moto makes, 1,025 input labels.

After normalization: 922 choices across the same make/scope lists. 14 incorrect or incomplete labels are excluded from selectors; products and stored compatibility records are not deleted or rewritten. This is selector/query normalization, not a supplier database repair. Newly imported ambiguous labels still require evidence before mapping to a vehicle.

Aliases are shared by cascading fitment, legacy matching, ORM filters, SQL catalog queries, ordering and facet queries. Regression tests preserve reachability for every selectable source label, clause correlation, body styles and performance variants. Generation aliases broaden the model family only; separate chassis/year constraints remain in effect.

Wrong-make evidence: [Škoda Enyaq Coupé](https://www.skoda-auto.com/models/range/new-enyaq-coupe), [Subaru BRZ](https://www.subaru.com/vehicles/brz.html). Audi spelling: [Q4 Sportback e-tron](https://www.audi.com/en/electric-suvs-in-the-premium-compact-segment-the-audi-q4-e-tron-and-q4-sportback-e-tron-until-2026-13887/electric-efficient-and-emotionally-appealing-audi-q4-e-tron-and-q4-sportback-e-tron-13890).

| Scope | Make | Before | After | Excluded labels |
|---|---|---:|---:|---|
| auto | Abarth | 3 | 3 | — |
| auto | Acura | 1 | 1 | — |
| auto | Alfa Romeo | 16 | 16 | — |
| auto | Alpine | 3 | 2 | — |
| auto | Aston Martin | 7 | 6 | — |
| auto | Audi | 40 | 38 | ATECA, ENYAQ iV Coupe |
| auto | Bentley | 4 | 4 | — |
| auto | BMW | 63 | 49 | — |
| auto | BYD | 1 | 1 | — |
| auto | Cadillac | 5 | 5 | — |
| auto | Chevrolet | 18 | 18 | — |
| auto | Chrysler | 2 | 2 | — |
| auto | Citroën | 28 | 27 | — |
| auto | Cupra | 7 | 7 | — |
| auto | Dacia | 5 | 5 | — |
| auto | Daewoo | 1 | 1 | — |
| auto | Dodge | 8 | 8 | — |
| auto | DS | 6 | 7 | — |
| auto | Ferrari | 16 | 17 | — |
| auto | Fiat | 31 | 31 | — |
| auto | Ford | 42 | 35 | — |
| auto | Genesis | 1 | 1 | — |
| auto | Honda | 13 | 10 | fr, hr |
| auto | Hyundai | 32 | 29 | h |
| auto | Infiniti | 10 | 12 | — |
| auto | Isuzu | 3 | 3 | — |
| auto | Iveco | 4 | 4 | — |
| auto | Jaguar | 10 | 10 | — |
| auto | Jeep | 9 | 8 | — |
| auto | Kia | 20 | 20 | — |
| auto | Lamborghini | 12 | 12 | — |
| auto | Lancia | 9 | 9 | — |
| auto | Land Rover | 9 | 9 | — |
| auto | LDV | 1 | 1 | — |
| auto | Lexus | 5 | 4 | — |
| auto | Lotus | 5 | 5 | — |
| auto | Maruti | 3 | 3 | — |
| auto | Maserati | 10 | 8 | — |
| auto | Mazda | 9 | 7 | bt, cx |
| auto | McLaren | 13 | 13 | — |
| auto | Mercedes-Benz | 98 | 93 | — |
| auto | MINI | 17 | 12 | — |
| auto | Mitsubishi | 16 | 14 | — |
| auto | Morgan | 2 | 2 | — |
| auto | NIO | 2 | 2 | — |
| auto | Nissan | 27 | 26 | — |
| auto | Opel | 24 | 24 | — |
| auto | Peugeot | 32 | 30 | — |
| auto | Polestar | 1 | 1 | — |
| auto | Porsche | 33 | 28 | — |
| auto | Renault | 28 | 25 | — |
| auto | Saab | 1 | 0 | 9 |
| auto | Scion | 3 | 2 | BRZ |
| auto | SEAT | 18 | 15 | GOLF VII Estate |
| auto | Skoda | 23 | 16 | — |
| auto | Smart | 7 | 7 | — |
| auto | Ssangyong | 6 | 6 | — |
| auto | Subaru | 10 | 8 | GR86 |
| auto | Suzuki | 13 | 11 | — |
| auto | Tata | 5 | 5 | — |
| auto | Tesla | 3 | 3 | — |
| auto | Toyota | 33 | 30 | BRZ, rav |
| auto | Vauxhall | 14 | 13 | — |
| auto | Volkswagen | 67 | 54 | Born |
| auto | Volvo | 23 | 19 | — |
| auto | Wiesmann | 4 | 4 | — |
| auto | Xiaomi | 1 | 1 | — |
| auto | Zeekr | 2 | 2 | — |
| moto | BMW | 13 | 9 | — |
| moto | Ducati | 14 | 9 | — |
