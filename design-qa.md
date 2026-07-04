source visual truth path: C:/Users/sascy/AppData/Local/Temp/codex-clipboard-7be5387d-8fa6-4502-9038-c61bfe617078.png
implementation screenshot path: C:/Users/sascy/AppData/Local/Temp/onecompany-stock-card-mobile-footer.png
viewport: 390x844 mobile, also checked 1440x900 desktop
state: /ua/shop/stock, grid view, default filters

full-view comparison evidence:

- Source card is a compact dark marketplace product card with product image, top action icons, brand, title, SKU, fitment pill, small attributes, green stock state, large price, quantity stepper, and blue cart button.
- Implementation now renders the same structural stack in the One Company dark style. Desktop and mobile screenshots show the card footer visible with stock, price, quantity, and cart CTA.

focused region comparison evidence:

- Mobile card footer was checked because it is the densest region. Quantity controls and "У кошик" button are visible and do not overflow.

findings:

- No actionable P0/P1/P2 findings.

patches made since previous QA pass:

- Replaced stock grid cards with compact Rozetka-like dark cards.
- Added brand logo/SKU/title/fitment/attribute/stock/price/quantity/cart structure.
- Added optional quantity support to AddToCartButton.
- Tightened card height and image ratio so the footer remains visible.

follow-up polish:

- P3: Currency display still follows the current stock-page price formatting. A later pricing pass can align it to selected storefront currency, for example UAH/EUR, if desired.

final result: passed
