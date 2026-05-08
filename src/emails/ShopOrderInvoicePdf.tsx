/* eslint-disable react-hooks/rules-of-hooks */
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import * as React from 'react';

type InvoiceItem = {
  title: string;
  quantity: number;
  price: number;
  total: number;
};

type InvoiceShipping = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
} | null;

type Props = {
  orderNumber: string;
  createdAt: string | Date;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  items: InvoiceItem[];
  customer: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    vatNumber?: string | null;
  };
  shipping: InvoiceShipping;
  storeName?: string;
  storeAddress?: string;
  storeContact?: string;
  locale?: 'ua' | 'en';
};

const T = {
  ua: {
    invoice: 'РАХУНОК / INVOICE',
    orderLabel: 'Замовлення',
    dateLabel: 'Дата',
    billTo: 'Платник',
    shipTo: 'Доставка',
    items: 'Найменування',
    qty: 'К-сть',
    price: 'Ціна',
    line: 'Сума',
    subtotal: 'Підсумок товарів',
    shipping: 'Доставка',
    tax: 'Податки',
    total: 'РАЗОМ',
    thanks: 'Дякуємо за замовлення в One Company.',
    note: 'Цей документ згенеровано автоматично і дійсний без підпису.',
  },
  en: {
    invoice: 'INVOICE',
    orderLabel: 'Order',
    dateLabel: 'Date',
    billTo: 'Bill to',
    shipTo: 'Ship to',
    items: 'Items',
    qty: 'Qty',
    price: 'Price',
    line: 'Subtotal',
    subtotal: 'Items subtotal',
    shipping: 'Shipping',
    tax: 'Tax',
    total: 'TOTAL',
    thanks: 'Thank you for your order at One Company.',
    note: 'Auto-generated document, valid without signature.',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111',
    backgroundColor: '#fff',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#0a0a0a' },
  storeMeta: { color: '#555', marginTop: 2 },
  invoiceLabel: { fontSize: 11, color: '#888', letterSpacing: 2 },
  invoiceTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metaCell: { flex: 1 },
  metaCellRight: { flex: 1, alignItems: 'flex-end' },
  metaLabel: { fontSize: 8, color: '#888', letterSpacing: 1.5, textTransform: 'uppercase' },
  metaValue: { fontSize: 11, marginTop: 2, color: '#111' },
  parties: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  party: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#e5e5e5' },
  partyLabel: { fontSize: 8, color: '#888', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  partyLine: { fontSize: 10, marginTop: 1, color: '#111' },
  table: { borderWidth: 1, borderColor: '#e5e5e5', marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: 8 },
  tableRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  colItem: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.4, textAlign: 'right' },
  colLine: { flex: 1.4, textAlign: 'right' },
  totals: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totalsBox: { width: '50%' },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalsLabel: { color: '#555' },
  totalsValue: { color: '#111' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#0a0a0a',
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  grandTotalValue: { fontSize: 12, fontWeight: 'bold' },
  footer: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 30,
    color: '#888',
    fontSize: 8,
    textAlign: 'center',
  },
});

function formatMoney(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return '—';
  return `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(value: string | Date, locale: 'ua' | 'en') {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale === 'ua' ? 'uk-UA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ShopOrderInvoicePdf({
  orderNumber,
  createdAt,
  currency,
  subtotal,
  shippingCost,
  taxAmount,
  total,
  items,
  customer,
  shipping,
  storeName = 'One Company',
  storeAddress = 'вул. Басейна 21Б, Київ 01024, Україна',
  storeContact = '+380 66 077 17 00 · onecompany.global',
  locale = 'ua',
}: Props) {
  const t = T[locale];
  const shipLines: string[] = [];
  if (shipping?.name) shipLines.push(shipping.name);
  if (shipping?.line1) shipLines.push(shipping.line1);
  if (shipping?.line2) shipLines.push(shipping.line2);
  const cityLine = [shipping?.city, shipping?.region, shipping?.postcode].filter(Boolean).join(', ');
  if (cityLine) shipLines.push(cityLine);
  if (shipping?.country) shipLines.push(shipping.country);
  if (shipping?.phone) shipLines.push(shipping.phone);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>{storeName}</Text>
            <Text style={styles.storeMeta}>{storeAddress}</Text>
            <Text style={styles.storeMeta}>{storeContact}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceLabel}>{t.invoice}</Text>
            <Text style={styles.invoiceTitle}>#{orderNumber}</Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{t.dateLabel}</Text>
            <Text style={styles.metaValue}>{formatDate(createdAt, locale)}</Text>
          </View>
          <View style={styles.metaCellRight}>
            <Text style={styles.metaLabel}>{t.orderLabel}</Text>
            <Text style={styles.metaValue}>{orderNumber}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{t.billTo}</Text>
            {customer.fullName ? <Text style={styles.partyLine}>{customer.fullName}</Text> : null}
            {customer.companyName ? <Text style={styles.partyLine}>{customer.companyName}</Text> : null}
            {customer.vatNumber ? <Text style={styles.partyLine}>VAT: {customer.vatNumber}</Text> : null}
            {customer.email ? <Text style={styles.partyLine}>{customer.email}</Text> : null}
            {customer.phone ? <Text style={styles.partyLine}>{customer.phone}</Text> : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>{t.shipTo}</Text>
            {shipLines.length === 0 ? (
              <Text style={styles.partyLine}>—</Text>
            ) : (
              shipLines.map((line, i) => (
                <Text style={styles.partyLine} key={i}>
                  {line}
                </Text>
              ))
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colItem, { fontWeight: 'bold' }]}>{t.items}</Text>
            <Text style={[styles.colQty, { fontWeight: 'bold' }]}>{t.qty}</Text>
            <Text style={[styles.colPrice, { fontWeight: 'bold' }]}>{t.price}</Text>
            <Text style={[styles.colLine, { fontWeight: 'bold' }]}>{t.line}</Text>
          </View>
          {items.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colItem}>{item.title}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatMoney(item.price, currency)}</Text>
              <Text style={styles.colLine}>{formatMoney(item.total, currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t.subtotal}</Text>
              <Text style={styles.totalsValue}>{formatMoney(subtotal, currency)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{t.shipping}</Text>
              <Text style={styles.totalsValue}>{formatMoney(shippingCost, currency)}</Text>
            </View>
            {taxAmount > 0 ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>{t.tax}</Text>
                <Text style={styles.totalsValue}>{formatMoney(taxAmount, currency)}</Text>
              </View>
            ) : null}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>{t.total}</Text>
              <Text style={styles.grandTotalValue}>{formatMoney(total, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {t.thanks} · {t.note}
        </Text>
      </Page>
    </Document>
  );
}
