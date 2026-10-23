/**
 * Infolettre Bleuh : les campagnes MailerLite pas encore parties (lot L12) —
 * lecture des brouillons et des envois programmés, discussion, suppression
 * d'un brouillon et d'un brouillon seulement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cheminCampagne,
  idCampagneValide,
  lienMailerLite,
  lireCampagneNonEnvoyee,
  ouvertureFilCampagne,
  trierNonEnvoyees,
  type CampagneNonEnvoyee,
} from "../src/lib/campagnes-brouillons-pure";
import { filIdDe } from "../src/lib/fils-pure";
import { getBleuhClient } from "../src/lib/mailerlite-bleuh";
import { listerNonEnvoyees, supprimerBrouillon } from "../src/lib/campagnes-brouillons-store";
import { ErreurMetier } from "../src/lib/erreur-metier";
import type { SessionContext } from "../src/lib/auth-server";

// Lignes telles que l'API Classic v2 les renvoie (relevé du 23/10, compte Bleuh).
const BROUILLON = {
  id: 64035636,
  total_recipients: 0,
  type: "regular",
  date_created: "2026-10-02 08:00:04",
  date_send: "-0001-11-30 00:00:00",
  name: "New Rotations Bleuh - October 2026",
  subject: "New Rotations Bleuh - October 2026",
  status: "draft",
};
const PROGRAMMEE = {
  id: 64105927,
  type: "regular",
  date_created: "2026-10-22 10:11:59",
  date_send: "2026-10-23 12:00:00",
  name: "OCO - A lighter choice, in a familiar format",
  subject: "A lighter choice, in a familiar format",
  status: "outbox",
};

const SESSION = { email: "d.test@chanv.com", role: "gestionnaire" } as unknown as SessionContext;

describe("règles pures", () => {
  it("lit un brouillon : pas de date d'envoi (« -0001-11-30 » n'est pas une date)", () => {
    expect(lireCampagneNonEnvoyee(BROUILLON, "brouillon")).toEqual({
      id: "64035636",
      name: "New Rotations Bleuh - October 2026",
      subject: "New Rotations Bleuh - October 2026",
      type: "regular",
      statut: "brouillon",
      dateCreated: "2026-10-02 08:00:04",
      dateSend: null,
    });
  });

  it("lit un envoi programmé avec son heure", () => {
    expect(lireCampagneNonEnvoyee(PROGRAMMEE, "programmee")?.dateSend).toBe("2026-10-23 12:00:00");
  });

  it("écarte une ligne sans id numérique", () => {
    expect(lireCampagneNonEnvoyee({ name: "x" }, "brouillon")).toBeNull();
    expect(lireCampagneNonEnvoyee({ id: "../1" }, "brouillon")).toBeNull();
    expect(lireCampagneNonEnvoyee(null, "brouillon")).toBeNull();
  });

  it("id valide : des chiffres seulement", () => {
    expect(idCampagneValide("64035636")).toBe(true);
    for (const v of ["", "12a", "1/2", "../3", 12, null]) expect(idCampagneValide(v)).toBe(false);
  });

  it("trie : programmées d'abord (la plus proche), puis brouillons (le plus récent)", () => {
    const c = (id: string, statut: CampagneNonEnvoyee["statut"], dateCreated: string, dateSend: string | null): CampagneNonEnvoyee => ({
      id, name: id, subject: id, type: "regular", statut, dateCreated, dateSend,
    });
    const tri = trierNonEnvoyees([
      c("b-vieux", "brouillon", "2025-08-29 10:00:00", null),
      c("p-tard", "programmee", "2026-10-22 10:00:00", "2026-10-23 12:00:00"),
      c("b-recent", "brouillon", "2026-10-02 08:00:00", null),
      c("p-tot", "programmee", "2026-10-22 08:00:00", "2026-10-23 07:00:00"),
    ]).map((x) => x.id);
    expect(tri).toEqual(["p-tot", "p-tard", "b-recent", "b-vieux"]);
  });

  it("lien MailerLite : la liste du bon statut", () => {
    expect(lienMailerLite("brouillon")).toBe("https://app.mailerlite.com/campaigns/draft/");
    expect(lienMailerLite("programmee")).toBe("https://app.mailerlite.com/campaigns/outbox/");
  });

  it("la discussion : espace « infolettres », objet = id MailerLite, chemin vers l'onglet Campagnes", () => {
    const o = ouvertureFilCampagne(
      { id: "64035636", name: "Rotations", subject: "Objet" },
      {
        contexte: "Infolettre Bleuh · MailerLite",
        etat: "Brouillon",
        objet: { libelle: "Objet", valeur: "Objet" },
        date: { libelle: "Créée le", valeur: "" },
        ouvrir: "Ouvrir l'onglet Campagnes",
      }
    );
    expect(o.espace).toBe("infolettres");
    expect(o.objet).toBe("64035636");
    expect(o.chemin).toBe("/infolettre?onglet=campagnes&campagne=64035636");
    expect(o.chemin).toBe(cheminCampagne("64035636"));
    expect(o.resume?.lignes).toEqual([{ libelle: "Objet", valeur: "Objet" }]); // ligne vide retirée
    expect(filIdDe({ appId: "9oxbWs7SxVimUqLBkOhH", espace: o.espace, objet: o.objet })).toBe(
      "9oxbWs7SxVimUqLBkOhH__infolettres__64035636"
    );
  });
});

describe("client MailerLite Classic v2", () => {
  const ANCIEN = { ...process.env };
  let appels: { url: string; method: string }[];

  function fauxFetch(routes: Record<string, unknown>, deleteStatus = 200) {
    appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        appels.push({ url, method });
        if (method === "DELETE") return new Response(JSON.stringify({ success: true }), { status: deleteStatus });
        const path = new URL(url).pathname.replace("/api/v2", "");
        const body = routes[path];
        if (body === undefined) return new Response("{}", { status: 404 });
        return new Response(JSON.stringify(body), { status: 200 });
      })
    );
  }

  beforeEach(() => {
    process.env.MAILERLITE_BLEUH_API_KEY = "cle-de-test";
    delete process.env.MAILERLITE_MOCK;
  });
  afterEach(() => {
    process.env = { ...ANCIEN };
    vi.unstubAllGlobals();
  });

  it("lit /campaigns/draft et /campaigns/outbox", async () => {
    fauxFetch({ "/campaigns/draft": [BROUILLON], "/campaigns/outbox": [PROGRAMMEE] });
    const list = await getBleuhClient()!.getUnsentCampaigns();
    expect(list.map((c) => [c.id, c.statut])).toEqual([
      ["64105927", "programmee"],
      ["64035636", "brouillon"],
    ]);
    expect(appels.every((a) => a.method === "GET")).toBe(true);
  });

  it("supprime un brouillon par DELETE /campaigns/:id", async () => {
    fauxFetch({ "/campaigns/draft": [BROUILLON] });
    expect(await getBleuhClient()!.deleteDraftCampaign("64035636")).toBe("supprimee");
    expect(appels.at(-1)).toEqual({ url: "https://api.mailerlite.com/api/v2/campaigns/64035636", method: "DELETE" });
  });

  it("ne supprime jamais une campagne qui n'est pas dans les brouillons (programmée, envoyée)", async () => {
    fauxFetch({ "/campaigns/draft": [BROUILLON], "/campaigns/outbox": [PROGRAMMEE] });
    expect(await getBleuhClient()!.deleteDraftCampaign("64105927")).toBe("absente");
    expect(appels.some((a) => a.method === "DELETE")).toBe(false);
  });

  it("une erreur de MailerLite à la suppression remonte", async () => {
    fauxFetch({ "/campaigns/draft": [BROUILLON] }, 500);
    await expect(getBleuhClient()!.deleteDraftCampaign("64035636")).rejects.toThrow(/500/);
  });
});

describe("magasin", () => {
  afterEach(() => {
    delete process.env.MAILERLITE_MOCK;
  });

  it("liste avec la discussion de chaque campagne", async () => {
    process.env.MAILERLITE_MOCK = "true";
    const lireFils = vi.fn(async (_e: string, objets: string[]) => {
      const m = new Map();
      for (const o of objets) m.set(o, { filId: `app__infolettres__${o}`, compte: o === "901" ? 2 : 0, nouveau: o === "901" });
      return m;
    });
    const list = await listerNonEnvoyees(getBleuhClient()!, "d.test@chanv.com", lireFils as never);
    expect(lireFils).toHaveBeenCalledWith("infolettres", ["902", "901", "900"], "d.test@chanv.com");
    expect(list.find((c) => c.id === "901")?.commentaires).toEqual({ filId: "app__infolettres__901", compte: 2, nouveau: true });
  });

  it("suppression : journalisée ; 409 si ce n'est plus un brouillon ; 400 sur un id illisible", async () => {
    process.env.MAILERLITE_MOCK = "true";
    const client = getBleuhClient()!;
    const journal = vi.fn(async () => {});
    await supprimerBrouillon(client, "901", SESSION, journal);
    expect(journal).toHaveBeenCalledWith(SESSION, "infolettre.brouillon.delete", "mailerlite:901");

    const e409 = await supprimerBrouillon(client, "902", SESSION, journal).catch((e) => e);
    expect(e409).toBeInstanceOf(ErreurMetier);
    expect(e409.status).toBe(409);

    const e400 = await supprimerBrouillon(client, "../x", SESSION, journal).catch((e) => e);
    expect(e400.status).toBe(400);
    expect(journal).toHaveBeenCalledTimes(1);
  });
});
