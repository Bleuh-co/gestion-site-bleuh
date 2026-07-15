// Types et utilitaires partagés du module Outils (console d'opérations —
// proxy /api/outils/* vers BleuhAPI /admin/*).
// Porté depuis Apps/Formulaire DB-Products-Master/public/operations.js.

export type ResultBanner = { ok: boolean; message: string } | null;

/** Cibles de synchronisation valides — doit rester en phase avec SYNC_TARGETS
 * de src/lib/bleuh-admin-proxy.ts. */
export const SYNCS = [
  { target: "ontario", heartbeat: "ontario", label: "Synchronisation Ontario" },
  { target: "lots", heartbeat: "lots", label: "Synchronisation des lots" },
  { target: "deliveries", heartbeat: "deliveries", label: "Synchronisation des livraisons" },
  { target: "store-locator", heartbeat: "store-locator", label: "Localisateur de magasins" },
  { target: "inventory-web-sftp", heartbeat: "inventory-web", label: "Inventaire Web (SFTP)" },
] as const;

export type SyncTarget = (typeof SYNCS)[number]["target"];

export const EXPORT_EXTS = [
  { ext: "xlsx", label: "Excel (.xlsx)" },
  { ext: "csv", label: "CSV" },
  { ext: "pdf", label: "PDF" },
] as const;

/** GET/POST/DELETE JSON contre le proxy Next — lève une erreur lisible en cas d'échec. */
export async function outilsFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`/api/outils${path}`, { cache: "no-store", ...options });
  const ct = res.headers.get("content-type") || "";
  let data: any;
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  }
  // Réponse non-JSON (ou parsing JSON échoué) : ne jamais afficher le corps
  // brut (ex. page HTML 404) — message propre + code HTTP à la place.
  if (!data || typeof data !== "object") {
    data = {
      success: false,
      message: `Service indisponible ou non configuré (BleuhAPI admin) — HTTP ${res.status}.`,
    };
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
  }
  return data;
}

/** Message lisible depuis une réponse JSON de BleuhAPI relayée. */
export function resultMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "OK.";
  const obj = data as Record<string, unknown>;
  if (typeof obj.message === "string" && obj.message) return obj.message;
  const clone: Record<string, unknown> = { ...obj };
  delete clone.success;
  const s = JSON.stringify(clone);
  return s && s !== "{}" ? s.slice(0, 400) : "OK.";
}

/** GET binaire contre le proxy Next → déclenche le téléchargement navigateur. */
export async function outilsDownload(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`/api/outils${path}`, { cache: "no-store" });
  await failIfNotDownloadable(res);
  triggerBlobDownload(await res.blob(), filenameFromResponse(res, fallbackName));
}

/** POST multipart contre le proxy Next → déclenche le téléchargement navigateur (ex. chatpot). */
export async function outilsDownloadPost(path: string, formData: FormData, fallbackName: string): Promise<void> {
  const res = await fetch(`/api/outils${path}`, { method: "POST", body: formData });
  await failIfNotDownloadable(res);
  triggerBlobDownload(await res.blob(), filenameFromResponse(res, fallbackName));
}

async function failIfNotDownloadable(res: Response): Promise<void> {
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || ct.includes("application/json")) {
    let msg = `Erreur ${res.status}`;
    try {
      const d = await res.json();
      msg = d.message || d.error || msg;
    } catch {
      /* réponse non-JSON, on garde le message générique */
    }
    throw new Error(msg);
  }
}

function filenameFromResponse(res: Response, fallback: string): string {
  const cd = res.headers.get("content-disposition") || "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return fallback;
}

function triggerBlobDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function fmtDate(v: string | number): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("fr-CA");
}

/** Heartbeats : forme non garantie côté BleuhAPI — on tente plusieurs clés usuelles. */
export function heartbeatText(hb: unknown): string {
  if (hb === null || hb === undefined || hb === "") return "Jamais exécuté.";
  if (typeof hb === "string" || typeof hb === "number") return fmtDate(hb);
  if (typeof hb === "object") {
    const o = hb as Record<string, unknown>;
    const v = o.last_success ?? o.last_success_at ?? o.last_run ?? o.at ?? o.timestamp ?? o.date ?? o.updated_at;
    if (typeof v === "string" || typeof v === "number") return fmtDate(v);
    return JSON.stringify(hb).slice(0, 120);
  }
  return String(hb);
}

// ─────────────────────────────────────────────────────────────
// Overrides de lots
// ─────────────────────────────────────────────────────────────
export interface OverrideRow {
  store: string | number | null;
  gtin: string | null;
  lot: string | null;
  variety: string | null;
  qty: string | number | null;
  liveQty: string | number | null;
  remaining: string | number | null;
  order: string | number | null;
  date: string | number | null;
  expired: boolean;
}

function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

/** Normalise la liste (1 ligne par lot, que l'API groupe ou non les items). */
export function flattenOverrides(data: unknown): OverrideRow[] {
  const list: any[] = Array.isArray(data)
    ? data
    : (data && typeof data === "object" && ((data as any).overrides || (data as any).items || (data as any).data)) ||
      [];
  const rows: OverrideRow[] = [];
  list.forEach((o: any) => {
    const base = {
      store: pick(o, ["store_number", "store", "magasin"]),
      gtin: pick(o, ["GTIN", "gtin"]),
      liveQty: pick(o, ["displayed_qty", "new_live_qty", "live_qty", "liveQty", "qty_live"]),
      remaining: pick(o, [
        "depleted",
        "remaining",
        "remaining_before_expiry",
        "remaining_qty",
        "override_until_qty_drops_by",
        "override_until_qty_sold",
      ]),
      date: pick(o, ["added_date", "created_at", "createdAt", "date", "updated_at"]),
      variety: pick(o, ["variety_name", "variety"]),
      expired: !!o.expired,
    };
    const items = Array.isArray(o.items) ? o.items : null;
    if (items && items.length) {
      items.forEach((it: any, i: number) =>
        rows.push({
          ...base,
          lot: pick(it, ["lot", "variety", "name"]),
          qty: pick(it, ["qty", "quantity"]),
          order: pick(it, ["weight", "order", "position", "rank"]) ?? i + 1,
        })
      );
    } else {
      rows.push({
        ...base,
        lot: pick(o, ["lot", "variety"]),
        qty: pick(o, ["qty", "quantity"]),
        order: pick(o, ["weight", "order", "position", "rank"]),
      });
    }
  });
  return rows;
}
