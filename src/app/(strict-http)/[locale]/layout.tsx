// The same locale layout without the `loading.tsx` boundaries of `[locale]`
// and `[locale]/shop`. Under those boundaries the response has already
// started streaming as 200 when a page calls redirect() or notFound(), so a
// redirect becomes a meta refresh and a missing page a soft 404. Routes whose
// answer can be a redirect or a 404 (product pages, legacy /products and
// /shop/brand URLs, collection handles, /categories/<slug>) live here.
export { generateStaticParams } from "@/app/[locale]/layout";
export { default } from "@/app/[locale]/layout";
