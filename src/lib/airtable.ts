/**
 * Airtable CRM Client for "Tuning Delivery Database"
 * 
 * Base ID: app70wZOSKU5xSoGX
 * 
 * Key Tables:
 * - Контрагенты (tbl9b8G7z2Ceks72Y) — Customers/Suppliers
 * - Заказы на продажу (tblGqCJfbkSEEcide) — Sales Orders
 * - Позиции заказа (продажи) (tbldUbSsYhMMjZfBu) — Order Items
 * - Товары/Услуги (tblJk07VK1kk1AK1L) — Products
 * - Посылки (tbl4EAgUgZEggtW11) — Shipments
 * - Бренды товаров (tbl3P8Hvb0k4ip2AS) — Product Brands
 * - Валюты (tblRZVHqe81P7KdIP) — Currencies
 */

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'app70wZOSKU5xSoGX';
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

// Table IDs
export const AIRTABLE_TABLES = {
  CUSTOMERS: 'tbl9b8G7z2Ceks72Y',        // Контрагенты
  SALES_ORDERS: 'tblGqCJfbkSEEcide',     // Заказы на продажу
  ORDER_ITEMS: 'tbldUbSsYhMMjZfBu',      // Позиции заказа (продажи)
  PRODUCTS: 'tblJk07VK1kk1AK1L',         // Товары/Услуги
  SHIPMENTS: 'tbl4EAgUgZEggtW11',        // Посылки
  BRANDS: 'tbl3P8Hvb0k4ip2AS',           // Бренды товаров
  CURRENCIES: 'tblRZVHqe81P7KdIP',       // Валюты
  ADDRESSES: 'tbl8vZihSoQNnpa6M',        // Адреса
  PURCHASE_ORDERS: 'tblthoNz0Dnn51F6k',  // Заказы на закупку
  FINANCE_OPS: 'tbl3PmlZwthd48GC3',      // Финансовые операции
  EMPLOYEES: 'tblR73DZETuu6GHMW',        // Сотрудники
  VEHICLE_MODELS: 'tblMrLyq6OCrSiMY5',   // Модели авто/мото
} as const;

// ═══════════════════════════════════════
// Core Airtable API Client
// ═══════════════════════════════════════

async function airtableFetch(
  tableId: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: any;
    recordId?: string;
  } = {}
): Promise<any> {
  const { method = 'GET', params, body, recordId } = options;

  let url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${tableId}`;
  if (recordId) url += `/${recordId}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${AIRTABLE_PAT}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Airtable API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

// ═══════════════════════════════════════
// Customers (Контрагенты)
// ═══════════════════════════════════════

export type AirtableCustomer = {
  id: string;
  name: string;
  email: string | null;
  businessName: string | null;
  tags: string[];
  totalProfit: number;
  totalSales: number;
  totalPayments: number;
  balance: number;
  whoOwes: string;
  orderIds: string[];
};

export async function fetchAirtableCustomers(
  options: { maxRecords?: number; filterFormula?: string; offset?: string } = {}
): Promise<{ records: AirtableCustomer[]; offset?: string }> {
  const params: Record<string, string> = {};
  if (options.maxRecords) params.maxRecords = options.maxRecords.toString();
  if (options.filterFormula) params.filterByFormula = options.filterFormula;
  if (options.offset) params.offset = options.offset;

  const data = await airtableFetch(AIRTABLE_TABLES.CUSTOMERS, { params });

  const records: AirtableCustomer[] = data.records.map((rec: any) => ({
    id: rec.id,
    name: rec.fields['Название'] || '',
    email: rec.fields['Email'] || null,
    businessName: rec.fields['Название бизнеса'] || null,
    tags: rec.fields['Тэг'] || [],
    totalProfit: rec.fields['Общая прибыль'] || 0,
    totalSales: rec.fields['Сумма наших продаж'] || 0,
    totalPayments: rec.fields['Сумма их оплат'] || 0,
    balance: rec.fields['Итоговый баланс'] || 0,
    whoOwes: rec.fields['Кто кому должен?'] || '',
    orderIds: rec.fields['Заказы'] || [],
  }));

  return { records, offset: data.offset };
}

export async function fetchAirtableCustomerById(recordId: string): Promise<AirtableCustomer | null> {
  try {
    const rec = await airtableFetch(AIRTABLE_TABLES.CUSTOMERS, { recordId });
    return {
      id: rec.id,
      name: rec.fields['Название'] || '',
      email: rec.fields['Email'] || null,
      businessName: rec.fields['Название бизнеса'] || null,
      tags: rec.fields['Тэг'] || [],
      totalProfit: rec.fields['Общая прибыль'] || 0,
      totalSales: rec.fields['Сумма наших продаж'] || 0,
      totalPayments: rec.fields['Сумма их оплат'] || 0,
      balance: rec.fields['Итоговый баланс'] || 0,
      whoOwes: rec.fields['Кто кому должен?'] || '',
      orderIds: rec.fields['Заказы'] || [],
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// Sales Orders (Заказы на продажу)
// ═══════════════════════════════════════

export type AirtableOrder = {
  id: string;
  number: number;
  name: string;
  orderStatus: string;
  paymentStatus: string;
  orderDate: string | null;
  completionDate: string | null;
  purchaseCost: number;
  additionalCosts: number;
  fullCost: number;
  totalAmount: number;
  totalRounded: number;
  clientTotal: number;
  profit: number;
  marginality: number;
  customerIds: string[];
  itemIds: string[];
  shipmentIds: string[];
  tag: string;
  allShipped: string;
  itemCount: number;
};

export async function fetchAirtableOrders(
  options: { maxRecords?: number; filterFormula?: string; offset?: string; sort?: { field: string; direction: 'asc' | 'desc' }[] } = {}
): Promise<{ records: AirtableOrder[]; offset?: string }> {
  const params: Record<string, string> = {};
  if (options.maxRecords) params.maxRecords = options.maxRecords.toString();
  if (options.filterFormula) params.filterByFormula = options.filterFormula;
  if (options.offset) params.offset = options.offset;
  if (options.sort) {
    options.sort.forEach((s, i) => {
      params[`sort[${i}][field]`] = s.field;
      params[`sort[${i}][direction]`] = s.direction;
    });
  }

  const data = await airtableFetch(AIRTABLE_TABLES.SALES_ORDERS, { params });

  const records: AirtableOrder[] = data.records.map((rec: any) => ({
    id: rec.id,
    number: rec.fields['Номер'] || 0,
    name: rec.fields['Название'] || '',
    orderStatus: rec.fields['Статус заказа'] || '',
    paymentStatus: rec.fields['Статус оплаты'] || '',
    orderDate: rec.fields['Дата заказа'] || null,
    completionDate: rec.fields['Дата выполнения заказа'] || null,
    purchaseCost: rec.fields['Закупочная стоимость'] || 0,
    additionalCosts: rec.fields['Сопутствующие расходы'] || 0,
    fullCost: rec.fields['Полная себестоимость заказа'] || 0,
    totalAmount: rec.fields['Сумма позиций (точная)'] || 0,
    totalRounded: rec.fields['Сумма заказа (округленная)'] || 0,
    clientTotal: rec.fields['Итого к оплате клиентом'] || 0,
    profit: rec.fields['Прибыль'] || 0,
    marginality: rec.fields['Маржинальность заказа'] || 0,
    customerIds: rec.fields['Клиент'] || [],
    itemIds: rec.fields['Позиции'] || [],
    shipmentIds: rec.fields['Посылки'] || [],
    tag: rec.fields['Тэг'] || '',
    allShipped: rec.fields['Все ли отгружено?'] || 'Нет',
    itemCount: rec.fields['Кол-во позиций'] || 0,
  }));

  return { records, offset: data.offset };
}

export async function fetchAirtableOrderById(recordId: string): Promise<AirtableOrder | null> {
  try {
    const rec = await airtableFetch(AIRTABLE_TABLES.SALES_ORDERS, { recordId });
    return {
      id: rec.id,
      number: rec.fields['Номер'] || 0,
      name: rec.fields['Название'] || '',
      orderStatus: rec.fields['Статус заказа'] || '',
      paymentStatus: rec.fields['Статус оплаты'] || '',
      orderDate: rec.fields['Дата заказа'] || null,
      completionDate: rec.fields['Дата выполнения заказа'] || null,
      purchaseCost: rec.fields['Закупочная стоимость'] || 0,
      additionalCosts: rec.fields['Сопутствующие расходы'] || 0,
      fullCost: rec.fields['Полная себестоимость заказа'] || 0,
      totalAmount: rec.fields['Сумма позиций (точная)'] || 0,
      totalRounded: rec.fields['Сумма заказа (округленная)'] || 0,
      clientTotal: rec.fields['Итого к оплате клиентом'] || 0,
      profit: rec.fields['Прибыль'] || 0,
      marginality: rec.fields['Маржинальность заказа'] || 0,
      customerIds: rec.fields['Клиент'] || [],
      itemIds: rec.fields['Позиции'] || [],
      shipmentIds: rec.fields['Посылки'] || [],
      tag: rec.fields['Тэг'] || '',
      allShipped: rec.fields['Все ли отгружено?'] || 'Нет',
      itemCount: rec.fields['Кол-во позиций'] || 0,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// Order Items (Позиции заказа)
// ═══════════════════════════════════════

export type AirtableOrderItem = {
  id: string;
  positionNumber: number;
  productId: string | null;
  productIds: string[];
  productName: string[];
  brand: string[];
  category: string[];
  quantity: number;
  rrpPerUnit: number;
  clientPricePerUnit: number;
  clientTotal: number;
  actualSalePrice: number;
  actualSaleTotal: number;
  purchasePrice: number;
  purchaseTotal: number;
  profitPerItem: number;
  marginality: number;
  status: string;
  source: string;
  orderIds: string[];
};

export async function fetchAirtableOrderItems(
  options: { filterFormula?: string; offset?: string } = {}
): Promise<{ records: AirtableOrderItem[]; offset?: string }> {
  const params: Record<string, string> = {};
  if (options.filterFormula) params.filterByFormula = options.filterFormula;
  if (options.offset) params.offset = options.offset;

  const data = await airtableFetch(AIRTABLE_TABLES.ORDER_ITEMS, { params });

  const records: AirtableOrderItem[] = data.records.map((rec: any) => ({
    id: rec.id,
    positionNumber: rec.fields['Номер позиции в заказе'] || 0,
    productId: rec.fields['Товар/Услуга']?.[0] || null,
    productIds: rec.fields['Товар/Услуга'] || [],
    productName: rec.fields['Название товара/услуги'] || [],
    brand: rec.fields['Бренд (from Товар)'] || [],
    category: rec.fields['Категория (from Товар)'] || [],
    quantity: rec.fields['Кол-во заказано'] || 0,
    rrpPerUnit: rec.fields['РРЦ за шт'] || 0,
    clientPricePerUnit: rec.fields['Цена клиента за шт($)'] || 0,
    clientTotal: rec.fields['Итоговая цена клиента($)'] || 0,
    actualSalePrice: rec.fields['Фактическая цена продажи за шт($)'] || 0,
    actualSaleTotal: rec.fields['Итоговая фактическая цена продажи($)'] || 0,
    purchasePrice: rec.fields['Цена закупки за шт($)'] || 0,
    purchaseTotal: rec.fields['Итоговая цена закупки($)'] || 0,
    profitPerItem: rec.fields['Прибыль по позиции($)'] || 0,
    marginality: rec.fields['Маржинальність'] || 0,
    status: rec.fields['Статус позиции'] || '',
    source: rec.fields['Источник'] || '',
    orderIds: rec.fields['Заказ'] || [],
  }));

  return { records, offset: data.offset };
}

// ═══════════════════════════════════════
// Shipments (Посылки)
// ═══════════════════════════════════════

export type AirtableShipment = {
  id: string;
  fields: Record<string, any>;
};

export async function fetchAirtableShipments(
  options: { filterFormula?: string; offset?: string } = {}
): Promise<{ records: AirtableShipment[]; offset?: string }> {
  const params: Record<string, string> = {};
  if (options.filterFormula) params.filterByFormula = options.filterFormula;
  if (options.offset) params.offset = options.offset;

  const data = await airtableFetch(AIRTABLE_TABLES.SHIPMENTS, { params });
  return {
    records: data.records.map((r: any) => ({ id: r.id, fields: r.fields })),
    offset: data.offset,
  };
}

// ═══════════════════════════════════════
// Products (Товары/Услуги)
// ═══════════════════════════════════════

export type AirtableProductLite = {
  id: string;
  sku: string;
};

/**
 * Fetch a batch of Products by their Record IDs to extract their SKUs
 */
export async function fetchAirtableProductsByIds(recordIds: string[]): Promise<AirtableProductLite[]> {
  if (recordIds.length === 0) return [];
  
  const uniqueIds = Array.from(new Set(recordIds));
  const CHUNK_SIZE = 50; // Keep formula string within Airtable's safe URL limits
  let allProducts: AirtableProductLite[] = [];

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const formula = `OR(${chunk.map(id => `RECORD_ID()="${id}"`).join(',')})`;
    
    const chunkResult = await fetchAllAirtableRecords<AirtableProductLite>((opts) => {
      const params: Record<string, string> = {
        filterByFormula: formula
      };
      if (opts.offset) params.offset = opts.offset;
      
      return airtableFetch(AIRTABLE_TABLES.PRODUCTS, { params }).then(data => ({
        records: data.records.map((r: any) => ({
          id: r.id,
          sku: r.fields['Парт-номер производителя'] || ''
        })),
        offset: data.offset
      }));
    });
    
    allProducts = allProducts.concat(chunkResult);
  }
  
  return allProducts;
}

export type AirtableProductStock = {
  id: string;
  sku: string;
  quantity: number;
};

/**
 * Fetch all products from Airtable to sync their available stock.
 */
export async function fetchAirtableProductsWithStocks(): Promise<AirtableProductStock[]> {
  return fetchAllAirtableRecords<AirtableProductStock>((opts) => {
    const params: Record<string, string> = {
      // Only fetch records that actually have an SKU assigned so we skip empty rows
      filterByFormula: "NOT({Парт-номер производителя} = '')",
      fields: ['Парт-номер производителя', 'Кол-во в наличии']
    };
    if (opts.offset) params.offset = opts.offset;
    
    // Pass the arrays properly for the fields param to URL
    const queryStringData: Record<string, string> = { ...params };
    delete queryStringData.fields;
    
    // Overriding the exact airtableFetch here since we have array fields
    const searchParams = new URLSearchParams(queryStringData);
    searchParams.append('fields[]', 'Парт-номер производителя');
    searchParams.append('fields[]', 'Кол-во в наличии');
    
    return fetch(`${AIRTABLE_API_URL}/${process.env.AIRTABLE_BASE_ID || 'app70wZOSKU5xSoGX'}/${AIRTABLE_TABLES.PRODUCTS}?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_PAT || ''}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })
    .then(res => {
      if(!res.ok) throw new Error('Airtable Error: ' + res.status);
      return res.json();
    })
    .then((data: any) => ({
      records: data.records.map((r: any) => ({
        id: r.id,
        sku: r.fields['Парт-номер производителя'] || '',
        quantity: parseInt(r.fields['Кол-во в наличии'] || '0', 10) || 0
      })),
      offset: data.offset
    }));
  });
}

// ═══════════════════════════════════════
// Create / Update Records
// ═══════════════════════════════════════

export async function createAirtableRecord(
  tableId: string,
  fields: Record<string, any>
): Promise<any> {
  return airtableFetch(tableId, {
    method: 'POST',
    body: { fields },
  });
}

export async function updateAirtableRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<any> {
  return airtableFetch(tableId, {
    method: 'PATCH',
    recordId,
    body: { fields },
  });
}

// ═══════════════════════════════════════
// Fetch ALL records with pagination
// ═══════════════════════════════════════

export async function fetchAllAirtableRecords<T>(
  fetcher: (options: { offset?: string }) => Promise<{ records: T[]; offset?: string }>
): Promise<T[]> {
  const all: T[] = [];
  let offset: string | undefined;

  do {
    const result = await fetcher({ offset });
    all.push(...result.records);
    offset = result.offset;
  } while (offset);

  return all;
}
