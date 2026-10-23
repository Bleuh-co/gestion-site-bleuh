/**
 * Lot L10 — l'espace « Pages d'atterrissage » de Marketing Bleuh, côté
 * serveur : la discussion (règles jumelles du hub, protocole de la coquille),
 * le magasin des fiches sur un Firestore en mémoire, et la route « Demander
 * une page » avec un faux hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerFauxFirestore } from "./faux-firestore";
import { etatPourMoi, filIdDe, messageOuvertureFil } from "../src/lib/fils-pure";
import { cheminFichePage, ouvertureFilPage } from "../src/lib/atterrissage-discussion-pure";

const F = creerFauxFirestore();
vi.mock("../src/lib/firebase-admin", () => ({ adminDb: () => F.db }));
vi.mock("../src/lib/audit", () => ({ recordAudit: async () => undefined }));
const SESSION_ROUTE = { uid: "u1", email: "daphnee@chanv.com", displayName: "Daphnée Paquette", photoURL: null, role: "gestionnaire" };
vi.mock("../src/lib/auth-server", () => ({
  requireRead: async () => SESSION_ROUTE,
  requireWrite: async () => SESSION_ROUTE,
}));

process.env.GESTIONSITEBLEUH_APP_ID = "9oxbWs7SxVimUqLBkOhH";
const APP = process.env.GESTIONSITEBLEUH_APP_ID;
const { lireEtatsFils } = await import("../src/lib/fils-store");
const { getFicheAffichee, listFichesAffichees, resoudreProduits, updateFicheAtterrissage } = await import("../src/lib/atterrissages-store");
const { POST: demander } = await import("../src/app/api/site/atterrissages/demande/route");
const { PATCH: modifier } = await import("../src/app/api/site/atterrissages/[id]/route");

const PAGES = "bleuh_site_atterrissages";
const FILS = "app_fils";
const MOI = "daphnee@chanv.com";
const SESSION = SESSION_ROUTE as Parameters<typeof getFicheAffichee>[1];

function page(id: string, extra: Record<string, unknown> = {}) {
  F.poser(PAGES, id, { nom: id, adresse: { fr: id, en: id }, zones: ["qc"], active: false, livree: false, visibilite: "privee", ...extra });
}

beforeEach(() => F.vider());

describe("la discussion d'une page Bleuh", () => {
  it("filIdDe et etatPourMoi : mêmes valeurs que le hub", () => {
    expect(filIdDe({ appId: APP, espace: "pages", objet: "bleuh-original-quebec" })).toBe(`${APP}__pages__bleuh-original-quebec`);
    expect(filIdDe({ appId: APP, espace: "pages", objet: "a/b" })).toBe("");
    const fil = { compte: 2, dernier: { par: "antoine@chanv.com", le: "2026-10-22T20:00:00.000Z" }, vu_par: {} };
    expect(etatPourMoi(fil, MOI)).toEqual({ compte: 2, nouveau: true });
  });

  it("gandalf:fil porte la marque Bleuh, jamais l'appId", () => {
    const m = messageOuvertureFil({ espace: "pages", objet: "x", titre: "X", chemin: "/pages-atterrissage/x" });
    expect(m).toMatchObject({ type: "gandalf:fil", marque: "bleuh" });
    expect(m).not.toHaveProperty("appId");
  });

  it("le résumé du volet : bleuh.co/fr, la zone, pas d'offre ; ajustable (CONTRAT v2 §1) transporté tel quel", () => {
    const o = ouvertureFilPage(
      {
        id: "bleuh-original-quebec",
        nom: "Bleuh Original Québec",
        adresse: { fr: "bleuh-original-quebec", en: "bleuh-original-quebec" },
        visibilite: "publique",
        ajustable: true,
      },
      {
        contexte: "Page d'atterrissage Bleuh",
        etat: "En ligne",
        dates: { libelle: "Dates", valeur: "Dès le 30 sept. 2026" },
        zone: { libelle: "Zone", valeur: "Québec" },
        visibilite: { libelle: "Visibilité", valeur: "Publique" },
        fiche: "Ouvrir la fiche",
      }
    );
    expect(o.resume).toEqual({
      contexte: "Page d'atterrissage Bleuh · bleuh.co/fr/bleuh-original-quebec/",
      etat: "En ligne",
      lignes: [
        { libelle: "Dates", valeur: "Dès le 30 sept. 2026" },
        { libelle: "Zone", valeur: "Québec" },
        { libelle: "Visibilité", valeur: "Publique" },
      ],
      liens: [{ libelle: "Ouvrir la fiche", chemin: "/pages-atterrissage/bleuh-original-quebec" }],
    });
    expect(o.ajustable).toBe(true);
    expect(cheminFichePage("a b")).toBe("/pages-atterrissage/a%20b");
  });

  it("lireEtatsFils lit app_fils sous l'appId de Marketing Bleuh", async () => {
    F.poser(FILS, `${APP}__pages__a`, { compte: 2, dernier: { par: "antoine@chanv.com", le: "2026-10-22T20:00:00Z" }, vu_par: {} });
    const m = await lireEtatsFils("pages", ["a", "b"], MOI);
    expect(m.get("a")).toEqual({ filId: `${APP}__pages__a`, compte: 2, nouveau: true });
    expect(m.get("b")).toEqual({ filId: `${APP}__pages__b`, compte: 0, nouveau: false });
  });
});

describe("le magasin des fiches", () => {
  it("les produits : nom, image et point de vente — jamais un prix", async () => {
    F.poser("products", "medellin", { name: { fr: "Medellin Fog", en: "Medellin Fog" }, images: { main: "https://x/m.webp" }, provinces: ["qc"], price: 12 });
    F.poser("products", "wild", { name: { fr: "Wildberry", en: "Wildberry" }, images: { main: "" }, provinces: ["qc", "on"] });
    const p = await resoudreProduits(["medellin", "wild", "disparu"], F.db as never);
    expect(p).toEqual([
      { id: "medellin", nom: { fr: "Medellin Fog", en: "Medellin Fog" }, image: "https://x/m.webp", pointsDeVente: ["SQDC"] },
      { id: "wild", nom: { fr: "Wildberry", en: "Wildberry" }, image: "", pointsDeVente: ["SQDC", "OCS"] },
      { id: "disparu", nom: { fr: "disparu", en: "disparu" }, image: "", pointsDeVente: [] },
    ]);
    expect(JSON.stringify(p)).not.toContain("12");
  });

  it("la liste : compteurs, page faite avant l'espace, fiche illisible écartée, en ligne d'abord", async () => {
    page("bleuh-original-quebec", { livree: true, active: true, debut: "2026-09-30", rangee_le: "2026-10-23T00:00:00Z", demande: null });
    page("nouvelle", { demande: { ticket: null, par: MOI, le: "2026-10-22" }, demande_brouillon: { nom: "x", images: [] } });
    page("sans-zone", { zones: [] });
    F.poser(FILS, `${APP}__pages__nouvelle`, { compte: 1, dernier: { par: "antoine@chanv.com", le: "2026-10-22T20:00:00Z" }, vu_par: {} });
    const liste = await listFichesAffichees(SESSION);
    expect(liste.map((f) => f.id)).toEqual(["bleuh-original-quebec", "nouvelle"]);
    const [quebec, nouvelle] = liste;
    expect([quebec.etat, quebec.rangeeLe, quebec.peutRenvoyer]).toEqual(["en-ligne", "2026-10-23T00:00:00Z", false]);
    expect([nouvelle.etat, nouvelle.peutRenvoyer, nouvelle.commentaires.compte, nouvelle.commentaires.nouveau]).toEqual([
      "preparation",
      true,
      1,
      true,
    ]);
  });

  it("une page Canada seulement se regarde en anglais", async () => {
    process.env.SITEBLEUH_PREPROD_URL = "https://sitebleuh-dev.example.run.app/";
    page("new-products", { zones: ["ca"], livree: true });
    const f = await getFicheAffichee("new-products", SESSION);
    expect(f.urls).toEqual({ site: "https://bleuh.co/en/new-products", preprod: "https://sitebleuh-dev.example.run.app/en/new-products" });
  });

  it("passe « livrée » tout seul quand le signalement est réglé", async () => {
    page("a", { demande: { ticket: "T1" } });
    F.poser("tickets", "T1", { status: "RESOLVED", assigneeEmail: "aurore@chanv.com" });
    const f = await getFicheAffichee("a", SESSION);
    expect([f.livree, f.etat, f.demandeInfo?.assigneeEmail]).toEqual([true, "prete", "aurore@chanv.com"]);
  });

  it("refuse d'allumer une page pas encore livrée", async () => {
    page("a");
    await expect(updateFicheAtterrissage("a", { active: true }, SESSION)).rejects.toMatchObject({ status: 409 });
  });
});

describe("les routes", () => {
  const ANCIEN = { ...process.env };
  const fetchHub = vi.fn();
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "https://marketing.bleuh.co";
    process.env.NOTIF_API_KEY = "cle-de-test";
    fetchHub.mockReset();
    vi.stubGlobal("fetch", fetchHub);
  });
  afterEach(() => {
    process.env = { ...ANCIEN };
    vi.unstubAllGlobals();
  });

  const requete = (corps: unknown) => new Request("https://x/api", { method: "POST", body: JSON.stringify(corps) }) as never;
  const CORPS = {
    mode: "decrire",
    nom: "Page d'essai",
    adresseFr: "essai-atterrissage",
    adresseEn: "landing-test",
    zones: ["qc", "ca"],
    langues: ["fr", "en"],
    aQuoiSert: "Vérifier l'espace.",
    produits: [],
    visibilite: "privee",
  };

  it("« Demander une page » : la fiche en préparation et le signalement Bleuh au hub", async () => {
    fetchHub.mockResolvedValue({ ok: true, status: 201, json: async () => ({ ok: true, id: "TK1", created: true }) });
    const res = await demander(requete(CORPS));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: "essai-atterrissage", signalement: { ok: true, id: "TK1" } });

    const [url, init] = fetchHub.mock.calls[0];
    expect(url).toBe("https://gandalf.chanv.com/api/support/service");
    const envoye = JSON.parse(init.body);
    expect(envoye).toMatchObject({
      integration: "marketing_bleuh",
      appId: "site-bleuh",
      type: "page",
      external_key: "marketing-bleuh:atterrissage:essai-atterrissage",
      reporterEmail: MOI,
      title: "[Page d'atterrissage] Page d'essai",
      atterrissage: { id: "essai-atterrissage", lien: "https://marketing.bleuh.co/pages-atterrissage/essai-atterrissage" },
    });
    expect(envoye.message).toContain("— À respecter : l'intégration avec Marketing Bleuh —");
    expect(envoye.message).toContain("Zone : Québec et Canada");

    const fiche = await getFicheAffichee("essai-atterrissage", SESSION);
    expect(fiche).toMatchObject({ etat: "preparation", active: false, zones: ["qc", "ca"], adresse: { fr: "essai-atterrissage", en: "landing-test" } });
    expect(fiche.demande?.ticket).toBe("TK1");
  });

  it("hub en panne : la fiche reste, on peut renvoyer la demande", async () => {
    fetchHub.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await demander(requete(CORPS));
    expect((await res.json()).signalement.ok).toBe(false);
    expect((await getFicheAffichee("essai-atterrissage", SESSION)).peutRenvoyer).toBe(true);
  });

  it("une adresse déjà prise, en français ou en anglais : 409", async () => {
    page("autre", { adresse: { fr: "autre", en: "landing-test" } });
    const res = await demander(requete(CORPS));
    expect(res.status).toBe(409);
    expect(fetchHub).not.toHaveBeenCalled();
  });

  it("une offre envoyée quand même : 400, rien n'est créé", async () => {
    const res = await demander(requete({ ...CORPS, offreMode: "lot" }));
    expect(res.status).toBe(400);
    expect(await listFichesAffichees(SESSION)).toEqual([]);
  });

  it("PATCH : la zone se change, une offre est refusée", async () => {
    page("a", { livree: true });
    const ctx = { params: Promise.resolve({ id: "a" }) };
    const patch = (corps: unknown) => new Request("https://x", { method: "PATCH", body: JSON.stringify(corps) }) as never;
    expect((await modifier(patch({ zones: ["ca"] }), ctx)).status).toBe(200);
    expect((await getFicheAffichee("a", SESSION)).zones).toEqual(["ca"]);
    expect((await modifier(patch({ offre: { sorte: "lot", id: "x" } }), { params: Promise.resolve({ id: "a" }) })).status).toBe(400);
  });
});
