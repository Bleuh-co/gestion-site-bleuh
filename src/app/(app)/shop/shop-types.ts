// Types Woo côté client + helper shopFetch — module Shop (proxy /api/shop/*
// vers l'API REST WooCommerce v3). Calqué sur outils-types.ts.

/** Enveloppe de liste renvoyée par relayWooJson (voir src/lib/woo-proxy.ts). */
export interface WooList<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface WooImage {
  id?: number;
  src: string;
  alt?: string;
}

export interface ShopProduct {
  id: number;
  name: string;
  sku: string;
  status: string; // publish | draft | pending | private
  type: string; // simple | variable
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string; // instock | outofstock | onbackorder
  images: WooImage[];
  permalink?: string;
}

export interface ShopOrderLineItem {
  id: number;
  name: string;
  quantity: number;
  total: string;
  sku?: string;
}

export interface ShopOrderCouponLine {
  id: number;
  code: string;
  discount: string;
}

export interface ShopOrderAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface ShopOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  date_created: string;
  billing: ShopOrderAddress;
  shipping: ShopOrderAddress;
  customer_note?: string;
  line_items: ShopOrderLineItem[];
  coupon_lines: ShopOrderCouponLine[];
}

export interface ShopCoupon {
  id: number;
  code: string;
  discount_type: string; // percent | fixed_cart | fixed_product
  amount: string;
  usage_count: number;
  usage_limit: number | null;
  email_restrictions: string[];
}

export interface ShopStats {
  totals: Array<{ slug: string; name: string; total: number }>;
  sales: Array<{ total_sales?: string; total_orders?: number; total_items?: number }>;
  topSellers: Array<{ name: string; product_id: number; quantity: number }>;
}

/** GET/PATCH/POST/DELETE JSON contre le proxy Next /api/shop — lève une erreur lisible. */
export async function shopFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/shop${path}`, { cache: "no-store", ...options });
  const ct = res.headers.get("content-type") || "";
  let data: unknown = null;
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  if (!data || typeof data !== "object") {
    data = { success: false, message: `Service indisponible ou non configuré (API Shop) — HTTP ${res.status}.` };
  }
  const obj = data as Record<string, unknown>;
  if (!res.ok || obj.success === false) {
    throw new Error((obj.message as string) || (obj.error as string) || `Erreur ${res.status}`);
  }
  return data as T;
}

export function fmtMoney(v: string | number | null | undefined, currency = "CAD"): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
}

export function fmtDate(v: string | number): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("fr-CA");
}
