/**
 * Les signalements de Marketing Bleuh dans Support Web — src/lib/hub-support.ts
 * (`POST /api/support/service` et `/annuler`, lot L9). Testé avec un `fetch`
 * injecté : jamais de vrai appel réseau, jamais une exception qui remonterait
 * sans message clair à l'écran.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annulerSignalement, cleExterne, envoyerSignalement, type Signalement } from "../src/lib/hub-support";

const PAGE: Signalement = {
  sorte: "page",
  external_key: cleExterne("page", "lancement-wildberry"),
  reporterEmail: "d.exemple@chanv.com",
  title: "[Page d'atterrissage] Lancement Wildberry",
  message: "bleuh.co/lancement-wildberry\n\n…",
  images: ["https://storage.googleapis.com/b/site-assets/atterrissages/2026/10/a.png"],
  tacheReliee: null,
  objet: { id: "lancement-wildberry", lien: "https://marketing.bleuh.co/pages-atterrissage/lancement-wildberry" },
};

const ok = (status: number, corps: Record<string, unknown>) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => corps });

describe("cleExterne", () => {
  it("une clé par sorte, préfixée par l'app — jamais celle de Marketing MDH", () => {
    expect(cleExterne("page", "x")).toBe("marketing-bleuh:atterrissage:x");
    expect(cleExterne("infolettre", "x")).toBe("marketing-bleuh:infolettre:x");
  });
});

describe("envoyerSignalement", () => {
  const ANCIEN = { ...process.env };
  beforeEach(() => {
    process.env.NOTIF_API_KEY = "cle-de-test";
    delete process.env.GANDALF_NOTIF_KEY;
    delete process.env.HUB_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
  });
  afterEach(() => {
    process.env = { ...ANCIEN };
  });

  it("sans clé configurée : refuse proprement, n'appelle jamais le réseau", async () => {
    delete process.env.NOTIF_API_KEY;
    const fetchFn = vi.fn();
    const r = await envoyerSignalement(PAGE, { fetch: fetchFn });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/configuration/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("page : intégration marketing_bleuh, cible site-bleuh, objet `atterrissage`", async () => {
    const fetchFn = ok(201, { ok: true, id: "tix1", created: true });
    const r = await envoyerSignalement(PAGE, { fetch: fetchFn });
    expect(r).toEqual({ ok: true, id: "tix1", created: true, status: 201 });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://gandalf.chanv.com/api/support/service");
    expect(init.method).toBe("POST");
    expect(init.headers["x-api-key"]).toBe("cle-de-test");
    const corps = JSON.parse(init.body);
    expect(corps).toMatchObject({
      integration: "marketing_bleuh",
      appId: "site-bleuh",
      type: "page",
      external_key: "marketing-bleuh:atterrissage:lancement-wildberry",
      reporterEmail: "d.exemple@chanv.com",
      tacheReliee: null,
      atterrissage: PAGE.objet,
    });
    expect(corps).not.toHaveProperty("infolettre");
    expect(corps).not.toHaveProperty("sorte");
    expect(corps).not.toHaveProperty("objet");
  });

  it("infolettre : type infolettre, objet `infolettre`", async () => {
    const fetchFn = ok(201, { ok: true, id: "tix2", created: true });
    await envoyerSignalement(
      { ...PAGE, sorte: "infolettre", external_key: cleExterne("infolettre", "123"), objet: { id: "123", lien: "https://marketing.bleuh.co/infolettre?envoi=123" } },
      { fetch: fetchFn }
    );
    const corps = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(corps).toMatchObject({ type: "infolettre", infolettre: { id: "123" }, external_key: "marketing-bleuh:infolettre:123" });
    expect(corps).not.toHaveProperty("atterrissage");
  });

  it("HUB_URL est respectée, sans barre finale doublée", async () => {
    process.env.HUB_URL = "https://gandalf-dev.chanv.com/";
    const fetchFn = ok(201, { ok: true, id: "t" });
    await envoyerSignalement(PAGE, { fetch: fetchFn });
    expect(fetchFn.mock.calls[0][0]).toBe("https://gandalf-dev.chanv.com/api/support/service");
  });

  it("200, rejeu : created:false — la demande ne double pas le signalement", async () => {
    const r = await envoyerSignalement(PAGE, { fetch: ok(200, { ok: true, id: "tix1", created: false }) });
    expect(r).toEqual({ ok: true, id: "tix1", created: false, status: 200 });
  });

  it("refus 4xx : le message du hub passe tel quel", async () => {
    const r = await envoyerSignalement(PAGE, { fetch: ok(400, { error: "appId non admis pour marketing_bleuh" }) });
    expect(r).toEqual({ ok: false, status: 400, error: "appId non admis pour marketing_bleuh" });
  });

  it("panne 5xx : message de nouvelle tentative, pas la trace brute", async () => {
    const r = await envoyerSignalement(PAGE, { fetch: ok(503, { error: "stack…" }) });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(503);
    expect(r.error).toMatch(/réessayez/i);
    expect(r.error).not.toContain("stack");
  });

  it("réseau injoignable : ne lève jamais, rend un message clair", async () => {
    const r = await envoyerSignalement(PAGE, { fetch: vi.fn().mockRejectedValue(new Error("fetch failed")) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/injoignable/i);
  });
});

describe("annulerSignalement", () => {
  const ANCIEN = { ...process.env };
  beforeEach(() => {
    process.env.NOTIF_API_KEY = "cle-de-test";
    delete process.env.HUB_URL;
    delete process.env.NEXT_PUBLIC_HUB_URL;
  });
  afterEach(() => {
    process.env = { ...ANCIEN };
  });

  it("appelle la route d'annulation avec l'intégration, la clé et qui annule", async () => {
    const fetchFn = ok(200, { ok: true, id: "tix1", annule: true });
    const r = await annulerSignalement("marketing-bleuh:atterrissage:x", "d.exemple@chanv.com", { fetch: fetchFn });
    expect(r).toEqual({ ok: true, id: "tix1", annule: true, status: 200 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://gandalf.chanv.com/api/support/service/annuler");
    expect(JSON.parse(init.body)).toEqual({
      integration: "marketing_bleuh",
      external_key: "marketing-bleuh:atterrissage:x",
      par: "d.exemple@chanv.com",
    });
  });

  it("signalement déjà résolu : ok, annule:false", async () => {
    const r = await annulerSignalement("k", "p@chanv.com", { fetch: ok(200, { ok: true, id: "tix1", annule: false, deja: "resolue" }) });
    expect(r).toMatchObject({ ok: true, annule: false });
  });

  it("aucune demande pour la clé : le 404 du hub passe tel quel", async () => {
    const r = await annulerSignalement("k", "p@chanv.com", { fetch: ok(404, { error: "Aucune demande pour cette clé" }) });
    expect(r).toEqual({ ok: false, status: 404, error: "Aucune demande pour cette clé" });
  });
});
