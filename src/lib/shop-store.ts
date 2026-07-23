import "server-only";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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

/** Champs prix/stock — voir le refus explicite ci-dessous pour les produits "variable". */
const PRICE_STOCK_FIELDS = [
  "regular_price",
  "sale_price",
  "manage_stock",
  "stock_quantity",
  "stock_status",
] as const;

/**
 * Met à jour un produit et RECALCULE les champs dérivés que le storefront lit :
 * `price` (prix effectif = promo si présente, sinon régulier), `on_sale`, et
 * `stock_status` si la quantité gérée passe à/de 0 (sauf statut fourni
 * explicitement). 404 si le produit n'existe pas.
 *
 * v1 EXPLICITE : un produit `type: "variable"` porte ses prix/stocks au
 * niveau de ses variations embarquées (`variations[]`), que le checkout lit
 * directement — un PATCH prix/stock ici ne les toucherait pas et créerait une
 * incohérence silencieuse entre la fiche produit et ce qui est réellement
 * vendu. Tant que l'édition par variation n'est pas implémentée, on refuse
 * explicitement (409) plutôt que de laisser croire que la modification a été
 * prise en compte.
 */
export async function updateProduct(id: string, patch: ProductPatch): Promise<Doc> {
  const ref = shopDb().collection(PRODUCTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new ShopStoreError("Produit introuvable.", 404);
  const current = snap.data() as Doc;

  if (current.type !== "simple" && PRICE_STOCK_FIELDS.some((f) => patch[f] !== undefined)) {
    throw new ShopStoreError(
      "Produit variable — modifier les prix/stocks par variation n'est pas encore supporté.",
      409
    );
  }

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

/** Firestore document shapes touched by the pending→cancelled restock transaction (subset). */
interface TxnVariation {
  id: number;
  stock_quantity?: number | null;
  stock_status?: string;
  [key: string]: unknown;
}
interface TxnProduct {
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  variations?: TxnVariation[];
  [key: string]: unknown;
}

/**
 * Change le statut d'une commande (statut déjà validé en liste blanche par la route).
 *
 * Cas particulier pending → cancelled : le stock est RÉSERVÉ (décrémenté) dès
 * la création de la commande côté storefront (createShopOrder, ShopBleuh),
 * AVANT tout paiement — c'est le remède documenté aux paiements Stripe
 * abandonnés : si le client quitte sans payer, la commande reste "pending" et
 * son stock reste bloqué tant qu'elle n'est pas explicitement annulée ici.
 * Annuler une commande encore "pending" doit donc RESTITUER ce qu'elle avait
 * réservé, dans UNE transaction Firestore :
 *  - le stock de chaque line_item (variation embarquée si variation_id, sinon
 *    produit simple géré en stock), repassant stock_status à "instock" si la
 *    quantité restituée est > 0 ;
 *  - le usage_count de chaque coupon de coupon_lines, plancher 0 (jamais négatif).
 * Toute autre transition (y compris {processing,completed,…} → cancelled, où
 * la commande a déjà été honorée/payée) reste un simple update de statut —
 * pas de restock, ce n'est pas le cas visé par ce remède.
 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Doc> {
  const ref = shopDb().collection(ORDERS).doc(id);

  if (status !== "cancelled") {
    const snap = await ref.get();
    if (!snap.exists) throw new ShopStoreError("Commande introuvable.", 404);
    const update = { status, date_modified: new Date().toISOString() };
    await ref.update(update);
    return { ...(snap.data() as Doc), ...update, id: snap.id };
  }

  return shopDb().runTransaction(async (txn) => {
    // --- READS (all before any write, per Firestore transaction rules) ---
    const snap = await txn.get(ref);
    if (!snap.exists) throw new ShopStoreError("Commande introuvable.", 404);
    const order = snap.data() as Doc;
    const update = { status, date_modified: new Date().toISOString() };

    if (order.status !== "pending") {
      // Commande déjà payée/traitée (ou déjà annulée) : rien à restituer.
      txn.update(ref, update);
      return { ...order, ...update, id: snap.id };
    }

    const lineItems = Array.isArray(order.line_items) ? (order.line_items as Doc[]) : [];
    const productIds = [
      ...new Set(
        lineItems
          .map((li) => Number(li.product_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const productSnaps = new Map<number, TxnProduct>();
    for (const pid of productIds) {
      const pSnap = await txn.get(shopDb().collection(PRODUCTS).doc(String(pid)));
      if (pSnap.exists) productSnaps.set(pid, pSnap.data() as TxnProduct);
    }

    const couponLines = Array.isArray(order.coupon_lines) ? (order.coupon_lines as Doc[]) : [];
    const couponCodes = [
      ...new Set(
        couponLines.map((c) => String(c.code ?? "").trim().toLowerCase()).filter(Boolean)
      ),
    ];
    // code → usage_count actuel (lu ici, décrémenté plus bas avant écriture).
    const couponUsageCounts = new Map<string, number>();
    for (const code of couponCodes) {
      const cSnap = await txn.get(shopDb().collection(COUPONS).doc(code));
      if (cSnap.exists) couponUsageCounts.set(code, Number(cSnap.get("usage_count")) || 0);
    }

    // --- Compute restock per product (in-memory mutation; one write per product) ---
    const productUpdates = new Map<number, Record<string, unknown>>();
    for (const li of lineItems) {
      const pid = Number(li.product_id);
      const qty = Number(li.quantity) || 0;
      if (!Number.isFinite(pid) || pid <= 0 || qty <= 0) continue;
      const product = productSnaps.get(pid);
      if (!product) continue; // produit supprimé depuis la commande : rien à restituer

      const variationId = Number(li.variation_id) || 0;
      if (variationId) {
        // Array embarqué : FieldValue.increment ne s'applique pas à un champ
        // niché dans un élément d'array — on mute en mémoire et on réécrit le
        // tableau complet, comme au débit (checkout-order.ts, ShopBleuh).
        const variations = (product.variations ?? []) as TxnVariation[];
        const variation = variations.find((v) => v.id === variationId);
        if (!variation || variation.stock_quantity == null) continue; // stock non géré pour cette variation
        const restored = variation.stock_quantity + qty;
        variation.stock_quantity = restored;
        if (restored > 0) variation.stock_status = "instock";
        productUpdates.set(pid, { ...(productUpdates.get(pid) ?? {}), variations });
      } else if (product.manage_stock === true && product.stock_quantity != null) {
        // Champ scalaire top-level : incrément atomique.
        const restored = product.stock_quantity + qty;
        const fieldUpdate: Record<string, unknown> = { stock_quantity: FieldValue.increment(qty) };
        if (restored > 0) fieldUpdate.stock_status = "instock";
        productUpdates.set(pid, { ...(productUpdates.get(pid) ?? {}), ...fieldUpdate });
      }
    }

    // --- WRITES ---
    for (const [pid, upd] of productUpdates) {
      txn.update(shopDb().collection(PRODUCTS).doc(String(pid)), upd);
    }
    for (const [code, usageCount] of couponUsageCounts) {
      txn.update(shopDb().collection(COUPONS).doc(code), {
        usage_count: Math.max(0, usageCount - 1),
      });
    }
    txn.update(ref, update);

    return { ...order, ...update, id: snap.id };
  });
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
