import "server-only";
import { NextResponse } from "next/server";
import { shopDb } from "./firebase-admin";

// ─────────────────────────────────────────────────────────────
// Magasin de données Shop — module Shop (catalogue MAÎTRE Bleuh).
// Remplace l'ancien proxy WooCommerce (src/lib/woo-proxy.ts) : depuis la
// migration (2026-07), les données maîtres vivent dans le Firestore du projet
// antigravity-20260107, collections préfixées shop_* (shop_products,
// shop_orders, shop_coupons, shop_counters). Les images des produits sont des
// URLs publiques GCS (storage.googleapis.com/antigravity-20260107.
// firebasestorage.app/shopbleuh/…). Plus AUCUN appel réseau vers bleuh.shop.
//
// Contrats de réponse conservés à l'identique côté API :
//   listes → { items, total, totalPages } ; détail/mutation → l'objet.
// ─────────────────────────────────────────────────────────────

const PRODUCTS = "shop_products";
const ORDERS = "shop_orders";
const COUPONS = "shop_coupons";

/** Statuts de commande de NOTRE boutique (les statuts Woo "on-hold"/"failed" n'existent plus). */
export const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuts comptés comme des ventes (stats) : commandes payées/en cours, jamais annulées/remboursées ni en attente de paiement. */
const SALE_STATUSES: ReadonlySet<string> = new Set(["processing", "completed"]);

/** Erreur métier typée → code HTTP précis (404 introuvable, 409 conflit, …). */
export class ShopStoreError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ShopStoreError";
    this.status = status;
  }
}

/**
 * Convertit une erreur (requireRead/requireWrite ou échec du magasin) en
 * NextResponse : UNAUTHORIZED→401, FORBIDDEN→403, ShopStoreError→son statut
 * (404/409/…), tout le reste (échec Firestore, etc.)→500.
 */
export function shopErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Accès refusé." }, { status: 403 });
  }
  if (error instanceof ShopStoreError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Erreur inconnue.";
  console.error(`${context} :`, message);
  return NextResponse.json({ success: false, message: "Erreur du magasin de données Shop." }, { status: 500 });
}

export interface ShopList<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export interface ListParams {
  search?: string;
  status?: string;
  category?: string;
  page?: number;
  perPage?: number;
}

type Doc = Record<string, unknown>;

/** Pagination en mémoire (volumétrie faible : quelques dizaines de docs par collection). */
function paginate<T>(rows: T[], page = 1, perPage = 100): ShopList<T> {
  const per = Math.min(Math.max(1, perPage), 100);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, page), totalPages);
  return { items: rows.slice((p - 1) * per, p * per), total, totalPages };
}

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

// ── Produits ────────────────────────────────────────────────

/** Liste des produits (recherche nom/SKU/slug, filtres statut/catégorie, tri par nom). */
export async function listProducts(params: ListParams): Promise<ShopList<Doc>> {
  const snap = await shopDb().collection(PRODUCTS).get();
  let rows = snap.docs.map((d) => d.data() as Doc);

  if (params.status) rows = rows.filter((p) => p.status === params.status);
  if (params.category) {
    const cat = norm(params.category);
    rows = rows.filter((p) =>
      Array.isArray(p.categories) &&
      (p.categories as Doc[]).some((c) => norm(c.slug) === cat || String(c.id) === params.category)
    );
  }
  if (params.search) {
    const q = norm(params.search);
    rows = rows.filter((p) => norm(p.name).includes(q) || norm(p.sku).includes(q) || norm(p.slug).includes(q));
  }
  rows.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr"));
  return paginate(rows, params.page, params.perPage);
}

/** Détail d'un produit (docId = String(id)). 404 si absent. */
export async function getProduct(id: string): Promise<Doc> {
  const snap = await shopDb().collection(PRODUCTS).doc(id).get();
  if (!snap.exists) throw new ShopStoreError("Produit introuvable.", 404);
  return snap.data() as Doc;
}

/** Champs modifiables d'un produit (liste blanche appliquée par la route). */
export interface ProductPatch {
  regular_price?: string;
  sale_price?: string;
  status?: string;
  manage_stock?: boolean;
  stock_quantity?: number;
  stock_status?: string;
}

/**
 * Met à jour un produit et RECALCULE les champs dérivés que le storefront lit :
 * `price` (prix effectif = promo si présente, sinon régulier), `on_sale`, et
 * `stock_status` si la quantité gérée passe à/de 0 (sauf statut fourni
 * explicitement). 404 si le produit n'existe pas.
 */
export async function updateProduct(id: string, patch: ProductPatch): Promise<Doc> {
  const ref = shopDb().collection(PRODUCTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ShopStoreError("Produit introuvable.", 404);
  const current = snap.data() as Doc;

  const update: Doc = { ...patch };
  const next = { ...current, ...update };

  if (patch.regular_price !== undefined || patch.sale_price !== undefined) {
    const onSale = typeof next.sale_price === "string" && next.sale_price !== "";
    update.on_sale = onSale;
    update.price = onSale ? next.sale_price : next.regular_price;
  }
  if (patch.stock_quantity !== undefined && patch.stock_status === undefined && next.manage_stock) {
    update.stock_status = Number(patch.stock_quantity) > 0 ? "instock" : "outofstock";
  }
  update.date_modified = new Date().toISOString();

  await ref.update(update);
  return { ...current, ...update };
}

// ── Commandes ───────────────────────────────────────────────

/** Liste des commandes (filtre statut, recherche n°/client, plus récentes d'abord). */
export async function listOrders(params: ListParams): Promise<ShopList<Doc>> {
  const snap = await shopDb().collection(ORDERS).get();
  let rows: Doc[] = snap.docs.map((d) => ({ ...(d.data() as Doc), id: d.id }));

  if (params.status) rows = rows.filter((o) => o.status === params.status);
  if (params.search) {
    const q = norm(params.search);
    rows = rows.filter((o) => {
      const billing = (o as Doc).billing as Doc | undefined;
      return (
        norm((o as Doc).number).includes(q) ||
        norm(billing?.first_name).includes(q) ||
        norm(billing?.last_name).includes(q) ||
        norm(billing?.email).includes(q)
      );
    });
  }
  rows.sort((a, b) => String((b as Doc).date_created ?? "").localeCompare(String((a as Doc).date_created ?? "")));
  return paginate(rows, params.page, params.perPage ?? 20);
}

/** Détail d'une commande (docId = numéro SB-####). 404 si absente. */
export async function getOrder(id: string): Promise<Doc> {
  const snap = await shopDb().collection(ORDERS).doc(id).get();
  if (!snap.exists) throw new ShopStoreError("Commande introuvable.", 404);
  return { ...(snap.data() as Doc), id: snap.id };
}

/** Change le statut d'une commande (statut déjà validé en liste blanche par la route). */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Doc> {
  const ref = shopDb().collection(ORDERS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ShopStoreError("Commande introuvable.", 404);
  const update = { status, date_modified: new Date().toISOString() };
  await ref.update(update);
  return { ...(snap.data() as Doc), ...update, id: snap.id };
}

// ── Coupons ─────────────────────────────────────────────────

/** Liste des coupons (recherche sur le code, tri alphabétique). */
export async function listCoupons(params: ListParams): Promise<ShopList<Doc>> {
  const snap = await shopDb().collection(COUPONS).get();
  let rows = snap.docs.map((d) => d.data() as Doc);
  if (params.search) {
    const q = norm(params.search);
    rows = rows.filter((c) => norm(c.code).includes(q));
  }
  rows.sort((a, b) => String(a.code ?? "").localeCompare(String(b.code ?? "")));
  return paginate(rows, params.page, params.perPage);
}

export interface CouponInput {
  code: string;
  discount_type: "percent" | "fixed_cart";
  amount: string;
  usage_limit?: number | null;
  email_restrictions?: string[];
}

/** Crée un coupon (docId = code en minuscules). 409 si le code existe déjà. */
export async function createCoupon(input: CouponInput): Promise<Doc> {
  const code = input.code.trim().toLowerCase();
  const doc: Doc = {
    code,
    discount_type: input.discount_type,
    amount: input.amount,
    usage_limit: input.usage_limit ?? null,
    usage_count: 0,
    email_restrictions: input.email_restrictions ?? [],
    free_shipping: false,
    date_expires: null,
    status: "publish",
    date_created: new Date().toISOString(),
  };
  try {
    await shopDb().collection(COUPONS).doc(code).create(doc);
  } catch (e) {
    if ((e as { code?: number }).code === 6 /* ALREADY_EXISTS */) {
      throw new ShopStoreError("Ce code de coupon existe déjà.", 409);
    }
    throw e;
  }
  return doc;
}

/** Supprime définitivement un coupon (docId = code en minuscules). 404 si absent. */
export async function deleteCoupon(code: string): Promise<Doc> {
  const ref = shopDb().collection(COUPONS).doc(code.trim().toLowerCase());
  const snap = await ref.get();
  if (!snap.exists) throw new ShopStoreError("Coupon introuvable.", 404);
  const data = snap.data() as Doc;
  await ref.delete();
  return data;
}

// ── Stats ───────────────────────────────────────────────────

export interface ShopStatsResult {
  totals: Array<{ slug: string; name: string; total: number }>;
  sales: Array<{ total_sales: string; total_orders: number; total_items: number }>;
  topSellers: Array<{ name: string; product_id: number; quantity: number }>;
}

/** "AAAA-MM" dans le fuseau de la boutique (Québec). */
function monthKeyToronto(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

/**
 * Agrégats du tableau de bord, calculés depuis shop_orders (une seule lecture
 * de collection) : compteurs par statut (toutes commandes), ventes du mois en
 * cours (somme des totaux des commandes processing/completed), meilleurs
 * vendeurs du mois par quantité (line_items). Même forme de réponse que les
 * anciens rapports Woo ({ totals, sales, topSellers }) — le `name` des totaux
 * est le slug du statut, traduit côté client.
 */
export async function getStats(): Promise<ShopStatsResult> {
  const snap = await shopDb().collection(ORDERS).get();
  const orders = snap.docs.map((d) => d.data() as Doc);

  const counts = new Map<string, number>();
  for (const s of ORDER_STATUSES) counts.set(s, 0);
  for (const o of orders) {
    const s = String(o.status ?? "");
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const totals = [...counts.entries()].map(([slug, total]) => ({ slug, name: slug, total }));

  const currentMonth = monthKeyToronto(new Date());
  let totalSales = 0;
  let totalOrders = 0;
  let totalItems = 0;
  const sellers = new Map<string, { name: string; product_id: number; quantity: number }>();

  for (const o of orders) {
    if (!SALE_STATUSES.has(String(o.status ?? ""))) continue;
    const created = new Date(String(o.date_created ?? ""));
    if (isNaN(created.getTime()) || monthKeyToronto(created) !== currentMonth) continue;

    totalOrders += 1;
    const t = Number(o.total);
    if (Number.isFinite(t)) totalSales += t;

    const items = Array.isArray(o.line_items) ? (o.line_items as Doc[]) : [];
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      totalItems += qty;
      const pid = Number(it.product_id) || 0;
      const key = pid ? String(pid) : String(it.name ?? "");
      const prev = sellers.get(key);
      if (prev) prev.quantity += qty;
      else sellers.set(key, { name: String(it.name ?? ""), product_id: pid, quantity: qty });
    }
  }

  const topSellers = [...sellers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  return {
    totals,
    sales: [{ total_sales: totalSales.toFixed(2), total_orders: totalOrders, total_items: totalItems }],
    topSellers,
  };
}
