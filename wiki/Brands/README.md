# Brand research notes

> This section is a research index, not a live catalog status dashboard. Supplier
> pages, prices, availability, image rights, and scraping behavior can change; verify
> them at the time of each import or customer-facing edit.

Create `wiki/Brands/<BrandName>.md` only when there is durable historical context
worth retaining. Include:

- date checked and exact source URLs;
- which facts came from an official manufacturer, distributor, or internal decision;
- fitment/SKU identity and locale/source caveats;
- price currency, VAT inclusion, market, and any approved transformation formula;
- media provenance and usage restrictions;
- parser/API limitations, rate limits, CAPTCHA or lazy-loading behavior;
- known discrepancies and how they were verified.

Never infer that a brand is “live” merely because a scraper, page, asset directory,
or old note exists. The active storefront route registry, PostgreSQL catalog, admin
state, and rendered UA/EN pages are the current evidence.

Do not store credentials, customer data, raw production exports, or undocumented
write instructions in the vault.

## Related

- [[../Index|Index]]
- [[../Shop/README|Shop]]
