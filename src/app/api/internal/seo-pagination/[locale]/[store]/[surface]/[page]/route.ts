import { NextRequest, NextResponse } from "next/server";

const LISTING_PATHS = new Set([
  "adro/collections",
  "brabus/products",
  "burger/products",
  "csf/collections",
  "girodisc/catalog",
  "ipe/collections",
  "ohlins/catalog",
  "racechip/catalog",
]);

type Context = {
  params: Promise<{ locale: string; store: string; surface: string; page: string }>;
};

export function GET(request: NextRequest, context: Context) {
  return redirectLegacyPagination(request, context);
}

export function HEAD(request: NextRequest, context: Context) {
  return redirectLegacyPagination(request, context);
}

async function redirectLegacyPagination(request: NextRequest, { params }: Context) {
  const { locale, store, surface, page: rawPage } = await params;
  const listingKey = `${store}/${surface}`;
  const page = Number(rawPage);

  if (
    !["ua", "en"].includes(locale) ||
    !LISTING_PATHS.has(listingKey) ||
    !/^[1-9]\d*$/.test(rawPage) ||
    !Number.isSafeInteger(page)
  ) {
    return new NextResponse(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, follow" },
    });
  }

  const destination = request.nextUrl.clone();
  destination.pathname =
    page === 1 ? `/${locale}/shop/${listingKey}` : `/${locale}/shop/${listingKey}/page/${page}`;
  destination.searchParams.delete("page");

  return NextResponse.redirect(destination, 308);
}
