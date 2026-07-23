// Types côté client + helper shopFetch — module Shop (API /api/shop/* servie
// par NOTRE catalogue maître Firestore, collections shop_* — voir
// src/lib/shop-store.ts). Calqué sur outils-types.ts.

/** Enveloppe de liste renvoyée par les routes /api/shop/* (voir src/lib/shop-store.ts). */
export interface ShopList<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface ShopImage {
  id?: number;
  /** URL publique GCS (storage.googleapis.com/antigravity-20260107.firebasestorage.app/shopbleuh/…). */
  src: string;
  alt?: string;
}

export interface ShopProduct {
  id: number;
  name: string;
  sku: string;
  status: string; // publish | draft
  type: string; // simple | variable
  price: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string; // instock | outofstock | onbackorder
  images: ShopImage[];
  permalink?: string;
}

export interface ShopOrderLineItem {
  id?: number;
  product_id?: number;
  name: string;
  quantity: number;
  total: string;
  sku?: string;
}

export interface ShopOrderCouponLine {
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

/** Statuts de commande de NOTRE boutique (miroir de ORDER_STATUSES serveur). */
export const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled", "refunded"] as const;

export interface ShopOrder {
  /** docId Firestore = numéro de commande (SB-####). */
  id: string;
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
  /** Identifiant = code (docId Firestore, minuscules). */
  code: string;
  discount_type: string; // percent | fixed_cart
  amount: string;
  usage_count: number;
  usage_limit: number | null;
  email_restrictions: string[];
  free_shipping?: boolean;
  date_expires?: string | null;
  status?: string;
}

export interface ShopStats {
  totals: Array<{ slug: string; name: string; total: number }>;
  sales: Array<{ total_sales?: string; total_orders?: number; total_items?: number }>;
  topSellers: Array<{ name: string; product_id: number; quantity: number }>;
}

/** pending → shop.orderStatusPending, etc. (clé i18n d'un statut de commande). */
export function orderStatusLabelKey(status: string): string {
  const clean = status.replace(/-/g, "");
  return `shop.orderStatus${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

/** GET/PATCH/POST/DELETE JSON contre l'API Next /api/shop — lève une erreur lisible. */
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
