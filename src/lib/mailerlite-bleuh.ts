import "server-only";

/**
 * Client MailerLite — Bleuh uniquement (API Classic v2).
 *
 * Porté (simplifié) depuis gestionnaire-donnees-mailerlite/src/lib/mailerlite-client.ts.
 * On ne garde que ClassicV2Client + helpers, câblé sur la seule clé
 * `MAILERLITE_BLEUH_API_KEY` (lue depuis Secret Manager / env runtime).
 *
 * La clé API n'est JAMAIS exposée au client : seules des valeurs masquées
 * (`getMaskedKey`) sortent des routes.
 *
 * Modes :
 *  - clé présente          → client réel (api.mailerlite.com/api/v2)
 *  - MAILERLITE_MOCK=true   → client fictif (données minimales, aucune requête réseau)
 *  - sinon                  → non configuré (les routes répondent proprement)
 */

import type {
  MailerLiteAccount,
  Subscriber,
  MLGroup,
  MLField,
  SubscriberStatus,
} from "./infolettre-types";

export const BLEUH_ACCOUNT_ID = "bleuh";
export const BLEUH_ACCOUNT_LABEL = "Bleuh";

export interface FetchSubscribersResult {
  data: Subscriber[];
  total: number;
  nextCursor: string | null;
}

export interface AccountInfo {
  name: string;
  email: string;
  subscriberCount: number;
}

export interface BleuhMailerLiteClient {
  readonly id: string;
  readonly label: string;
  readonly apiType: "classic";
  getAccountInfo(): Promise<AccountInfo>;
  getSubscribers(opts: {
    cursor?: string | null;
    limit?: number;
    search?: string;
    status?: SubscriberStatus;
  }): Promise<FetchSubscribersResult>;
  getGroups(): Promise<MLGroup[]>;
  getFields(): Promise<MLField[]>;
  getMaskedKey(): string;
}

// ─── Helpers ───────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 8
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, init);
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
      const wait = Math.min(retryAfter * 1000, 60_000) * Math.pow(1.5, attempt);
      console.warn(
        `[infolettre] Rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${retries})`
      );
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("MailerLite rate limit exceeded after retries");
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return "••••" + key.slice(-4);
}

// ─── Client réel — API Classic v2 ──────────────────────────────

class ClassicV2Client implements BleuhMailerLiteClient {
  readonly id = BLEUH_ACCOUNT_ID;
  readonly label = BLEUH_ACCOUNT_LABEL;
  readonly apiType = "classic" as const;
  private apiKey: string;
  private baseUrl = "https://api.mailerlite.com/api/v2";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): HeadersInit {
    return {
      "X-MailerLite-ApiKey": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const [meRes, statsRes] = await Promise.all([
      fetchWithRetry(`${this.baseUrl}/me`, { headers: this.headers() }),
      fetchWithRetry(`${this.baseUrl}/stats`, { headers: this.headers() }),
    ]);
    if (!meRes.ok) throw new Error(`ML Classic /me: ${meRes.status}`);
    const meData = await meRes.json();
    const account = meData.account || meData;

    let subscriberCount = 0;
    if (statsRes.ok) {
      const stats = await statsRes.json();
      // Tous statuts (le snapshot copie tous les abonnés, pas que les actifs)
      subscriberCount = (stats.subscribed || 0) + (stats.unsubscribed || 0);
    }

    return {
      name: account.name || this.label,
      email: account.email || account.from || "",
      subscriberCount,
    };
  }

  async getSubscribers(opts: {
    cursor?: string | null;
    limit?: number;
    search?: string;
    status?: SubscriberStatus;
  }): Promise<FetchSubscribersResult> {
    const limit = Math.min(opts.limit || 100, 100);
    const offset = opts.cursor ? parseInt(opts.cursor, 10) : 0;

    let url: string;
    if (opts.search) {
      url = `${this.baseUrl}/subscribers/search?query=${encodeURIComponent(opts.search)}&limit=${limit}&offset=${offset}`;
    } else {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (opts.status) params.set("type", opts.status);
      url = `${this.baseUrl}/subscribers?${params.toString()}`;
    }

    const res = await fetchWithRetry(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`ML Classic subscribers: ${res.status}`);
    const raw = await res.json();

    const subscribers: Subscriber[] = (Array.isArray(raw) ? raw : []).map(
      (s: unknown) => this.mapSubscriber(s as Record<string, unknown>)
    );

    const hasMore = subscribers.length === limit;
    return {
      data: subscribers,
      total: hasMore ? offset + limit + 1 : offset + subscribers.length,
      nextCursor: hasMore ? String(offset + limit) : null,
    };
  }

  async getGroups(): Promise<MLGroup[]> {
    const res = await fetchWithRetry(`${this.baseUrl}/groups?limit=100`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`ML Classic groups: ${res.status}`);
    const raw = await res.json();
    return (Array.isArray(raw) ? raw : []).map((g: Record<string, unknown>) => ({
      id: String(g.id),
      name: (g.name as string) || "",
      activeCount: (g.active as number) || 0,
      total: (g.total as number) || 0,
    }));
  }

  async getFields(): Promise<MLField[]> {
    const res = await fetchWithRetry(`${this.baseUrl}/fields`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`ML Classic fields: ${res.status}`);
    const raw = await res.json();
    return (Array.isArray(raw) ? raw : []).map((f: Record<string, unknown>) => ({
      id: String(f.id),
      key: (f.key as string) || "",
      name: (f.title as string) || (f.key as string) || "",
      type:
        f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text",
    }));
  }

  private mapSubscriber(s: Record<string, unknown>): Subscriber {
    const fields: Record<string, string | number | null> = {};
    if (Array.isArray(s.fields)) {
      for (const f of s.fields as Array<Record<string, unknown>>) {
        fields[f.key as string] = f.value as string | number | null;
      }
    }
    const groups: string[] = [];
    if (Array.isArray(s.groups)) {
      for (const g of s.groups as Array<Record<string, unknown>>) {
        groups.push(String(g.id || g.name || g));
      }
    }
    return {
      id: String(s.id),
      email: ((s.email as string) || "").toLowerCase(),
      status: ((s.type as string) || "active") as SubscriberStatus,
      source: (s.signup_source as string) || undefined,
      fields,
      groups,
      subscribedAt: (s.date_subscribe as string) || undefined,
      createdAt: (s.date_created as string) || undefined,
      updatedAt: (s.date_updated as string) || undefined,
    };
  }

  getMaskedKey(): string {
    return maskKey(this.apiKey);
  }
}

// ─── Client fictif (MAILERLITE_MOCK=true) ──────────────────────

class MockClient implements BleuhMailerLiteClient {
  readonly id = BLEUH_ACCOUNT_ID;
  readonly label = BLEUH_ACCOUNT_LABEL;
  readonly apiType = "classic" as const;

  private subs: Subscriber[] = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    email: `abonne${i + 1}@example.com`,
    status: (i % 5 === 0 ? "unsubscribed" : "active") as SubscriberStatus,
    source: "mock",
    fields: { name: `Abonné ${i + 1}`, city: i % 2 ? "Montréal" : "Québec" },
    groups: i % 3 === 0 ? ["g1"] : ["g2"],
    subscribedAt: "2026-01-01 00:00:00",
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
  }));

  async getAccountInfo(): Promise<AccountInfo> {
    return { name: "Bleuh (mock)", email: "mock@bleuh.co", subscriberCount: this.subs.length };
  }

  async getSubscribers(opts: {
    cursor?: string | null;
    limit?: number;
    search?: string;
    status?: SubscriberStatus;
  }): Promise<FetchSubscribersResult> {
    const limit = Math.min(opts.limit || 100, 100);
    const offset = opts.cursor ? parseInt(opts.cursor, 10) : 0;
    let list = this.subs;
    if (opts.status) list = list.filter((s) => s.status === opts.status);
    if (opts.search)
      list = list.filter((s) => s.email.includes(opts.search!.toLowerCase()));
    const page = list.slice(offset, offset + limit);
    const hasMore = offset + limit < list.length;
    return {
      data: page,
      total: list.length,
      nextCursor: hasMore ? String(offset + limit) : null,
    };
  }

  async getGroups(): Promise<MLGroup[]> {
    return [
      { id: "g1", name: "Infolettre générale", activeCount: 8, total: 9 },
      { id: "g2", name: "Promotions", activeCount: 4, total: 5 },
    ];
  }

  async getFields(): Promise<MLField[]> {
    return [
      { id: "1", key: "name", name: "Nom", type: "text" },
      { id: "2", key: "city", name: "Ville", type: "text" },
    ];
  }

  getMaskedKey(): string {
    return "••••mock";
  }
}

// ─── Factory ───────────────────────────────────────────────────

/** true si une clé réelle OU le mode mock est actif. */
export function isConfigured(): boolean {
  return !!process.env.MAILERLITE_BLEUH_API_KEY || process.env.MAILERLITE_MOCK === "true";
}

/**
 * Retourne le client Bleuh, ou `null` si non configuré (ni clé ni mock).
 * Les routes traduisent `null` en réponse « non configuré » propre.
 */
export function getBleuhClient(): BleuhMailerLiteClient | null {
  const key = process.env.MAILERLITE_BLEUH_API_KEY;
  if (key) return new ClassicV2Client(key);
  if (process.env.MAILERLITE_MOCK === "true") return new MockClient();
  return null;
}

/**
 * Décrit le compte Bleuh (clé masquée, jamais la clé brute).
 * Fonctionne même non configuré (`configured:false`, count 0).
 */
export async function getBleuhAccount(): Promise<MailerLiteAccount> {
  const client = getBleuhClient();
  const base: MailerLiteAccount = {
    id: BLEUH_ACCOUNT_ID,
    label: BLEUH_ACCOUNT_LABEL,
    apiKeyMasked: "••••",
    configured: false,
    createdAt: new Date().toISOString(),
    subscriberCount: 0,
  };
  if (!client) return base;
  try {
    const info = await client.getAccountInfo();
    return {
      ...base,
      apiKeyMasked: client.getMaskedKey(),
      configured: true,
      subscriberCount: info.subscriberCount,
    };
  } catch (e) {
    console.error("[infolettre] getBleuhAccount error:", e);
    return { ...base, apiKeyMasked: client.getMaskedKey(), configured: true };
  }
}
