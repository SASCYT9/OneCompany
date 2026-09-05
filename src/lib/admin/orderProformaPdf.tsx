import React from "react";
import { Document, Page, Text, View, Image, Font, renderToBuffer } from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { proformaLabels, type ProformaOrder, type ProformaSeller } from "./orderProforma";
import { orderAddressText, orderItemSnapshotDetails } from "@/lib/shopOrderPresentation";

Font.register({
  family: "Proforma",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/proforma/NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public/fonts/proforma/NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);
const line = {
  borderBottomWidth: 0.5,
  borderBottomColor: "#e3e5e7",
  paddingVertical: 7,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
};
async function productImage(src: string | null | undefined): Promise<Buffer | null> {
  if (!src) return null;
  try {
    // Product media is served by the CDN, never bundled from the whole public tree.
    // Only the fixed logo/font paths below belong in the serverless function.
    if (src.startsWith("//") || src.includes("\\")) return null;
    const url = src.startsWith("/") ? new URL(src, "https://onecompany.global") : new URL(src);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "onecompany.global" ||
        url.hostname === "cdn.shopify.com" ||
        url.hostname.endsWith(".public.blob.vercel-storage.com")
      )
    )
      return null;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(4000) });
    if (!response.ok || !/^image\/(png|jpeg)/.test(response.headers.get("content-type") || ""))
      return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length <= 5000000 ? bytes : null;
  } catch {
    return null;
  }
}
export async function renderOrderProformaPdf(
  order: ProformaOrder,
  seller: ProformaSeller,
  locale: "ua" | "en"
) {
  const t = proformaLabels[locale];
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "de-DE", {
      style: "currency",
      currency: order.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  const logo = await readFile(path.join(process.cwd(), "public/branding/proforma-logo.png"));
  const pictures: (Buffer | null)[] = [];
  for (let i = 0; i < order.items.length; i += 4)
    pictures.push(
      ...(await Promise.all(order.items.slice(i, i + 4).map((item) => productImage(item.image))))
    );
  const adjustment =
    Math.round((order.total - order.subtotal - order.shippingCost - order.taxAmount) * 100) / 100;
  const totals: [string, string][] = [
    [t.subtotal, fmt(order.subtotal)],
    [t.shipping, order.shippingCost === 0 ? t.noShipping : fmt(order.shippingCost)],
    ...(adjustment ? [[t.adjustment, fmt(adjustment)] as [string, string]] : []),
    [t.net, fmt(order.total - order.taxAmount)],
    [t.tax, order.taxAmount === 0 ? t.noTax : fmt(order.taxAmount)],
    [t.total, fmt(order.total)],
    ...(order.amountPaid > 0
      ? ([
          [t.paid, fmt(order.amountPaid)],
          [t.due, fmt(Math.max(0, order.total - order.amountPaid))],
        ] as [string, string][])
      : []),
  ];
  const company = seller.fopCompanyName || seller.appCompanyName || "OneCompany";
  const method =
    order.paymentMethod === "FOP"
      ? locale === "ua"
        ? "Банківський переказ"
        : "Bank transfer"
      : order.paymentMethod;
  const label = { fontWeight: 700 as const, fontSize: 9, marginBottom: 9 };
  return renderToBuffer(
    <Document title={`${t.title} ${order.orderNumber}`} author="OneCompany">
      <Page
        size="A4"
        style={{
          fontFamily: "Proforma",
          fontSize: 9,
          color: "#303235",
          paddingTop: 38,
          paddingHorizontal: 40,
          paddingBottom: 42,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 32 }}>
          <Image src={logo} style={{ width: 175, height: 65, objectFit: "contain" }} />
          <View style={{ width: 250 }}>
            <Text style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.title}</Text>
            <Text>
              {t.order}: {order.orderNumber}
            </Text>
            <Text>
              {t.date}:{" "}
              {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv" }).format(
                new Date(order.createdAt)
              )}
            </Text>
            <Text>
              {t.payment}: {method}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 28 }}>
          <View style={{ width: "50%" }}>
            <Text style={label}>{t.bill}</Text>
            {order.customer?.companyName && <Text>{order.customer.companyName}</Text>}
            <Text>{order.customerName}</Text>
            {order.customer?.vatNumber && <Text>VAT: {order.customer.vatNumber}</Text>}
            <Text>{order.email}</Text>
            <Text>{order.phone || ""}</Text>
          </View>
          <View style={{ width: "50%" }}>
            <Text style={label}>{t.ship}</Text>
            <Text>{order.customerName}</Text>
            <Text>{orderAddressText(order.shippingAddress) || t.missing}</Text>
          </View>
        </View>
        <View style={{ ...line, borderTopWidth: 1.5, borderTopColor: "#444", fontWeight: 700 }}>
          <Text style={{ width: "58%" }}>{t.item}</Text>
          <Text style={{ width: "8%", textAlign: "right" }}>{t.qty}</Text>
          <Text style={{ width: "17%", textAlign: "right" }}>{t.price}</Text>
          <Text style={{ width: "17%", textAlign: "right" }}>{t.total}</Text>
        </View>
        {order.items.map((item, i) => (
          <View key={i} wrap={false} style={{ ...line, alignItems: "center", paddingVertical: 15 }}>
            <View
              style={{
                width: "58%",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingRight: 8,
              }}
            >
              {pictures[i] && (
                <Image src={pictures[i]!} style={{ width: 64, height: 58, objectFit: "contain" }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 700 }}>{item.title}</Text>
                <Text style={{ fontSize: 8, color: "#777", marginTop: 4 }}>
                  {orderItemSnapshotDetails(order.pricingSnapshot, item).sku || ""}
                </Text>
              </View>
            </View>
            <Text style={{ width: "8%", textAlign: "right" }}>{item.quantity}</Text>
            <Text style={{ width: "17%", textAlign: "right" }}>{fmt(item.price)}</Text>
            <Text style={{ width: "17%", textAlign: "right" }}>{fmt(item.total)}</Text>
          </View>
        ))}
        <View
          wrap={false}
          style={{
            flexDirection: "row",
            gap: 24,
            borderBottomWidth: 1.5,
            borderBottomColor: "#444",
            paddingBottom: 8,
          }}
        >
          <View style={{ width: "50%", paddingTop: 10 }}>
            <Text style={label}>{t.notes}</Text>
            <Text>{t.taxes}</Text>
            <Text style={{ marginTop: 8 }}>{order.conversionNote || order.currency}</Text>
          </View>
          <View style={{ width: "50%" }}>
            {totals.map(([name, value]) => (
              <View key={name} style={line}>
                <Text style={{ fontWeight: name === t.total ? 700 : 400 }}>{name}</Text>
                <Text style={{ fontWeight: name === t.total ? 700 : 400 }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        <View wrap={false}>
          <Text style={{ textAlign: "center", fontSize: 8, marginVertical: 20 }}>{t.contact}</Text>
          <View style={{ flexDirection: "row", gap: 24 }}>
            <View style={{ width: "50%", textAlign: "right", fontSize: 8, lineHeight: 1.6 }}>
              <Text>{company}</Text>
              <Text>{seller.appAddress || ""}</Text>
              <Text>
                {t.code}: {seller.fopEdrpou || ""}
              </Text>
              <Text>{seller.appContactEmail || "info@onecompany.global"}</Text>
              <Text style={{ marginTop: 15 }}>
                {seller.paymentPurpose
                  ? locale === "ua"
                    ? "Призначення платежу:"
                    : "Payment reference (use exactly as written):"
                  : t.transfer}
              </Text>
              <Text style={{ fontWeight: 700 }}>{seller.paymentPurpose || order.orderNumber}</Text>
              <Text style={{ marginTop: 10 }}>IBAN: {seller.fopIban || ""}</Text>
              <Text>{seller.fopBankName || ""}</Text>
            </View>
            <Text style={{ width: "50%", fontSize: 21, fontWeight: 700 }}>
              {t.thanks.replace("<br>", "\n")}
            </Text>
          </View>
          <Text style={{ textAlign: "center", fontWeight: 700, marginTop: 24 }}>
            onecompany.global
          </Text>
          <Text style={{ textAlign: "center", fontSize: 7, color: "#777", marginTop: 6 }}>
            {t.note}
          </Text>
        </View>
        <Text
          fixed
          style={{
            position: "absolute",
            bottom: 18,
            left: 40,
            right: 40,
            fontSize: 7,
            textAlign: "right",
            color: "#777",
          }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
