/**
 * Titres et descriptions : l'écriture d'un réglage (PUT /api/site/seo/[cle],
 * src/lib/seo-reglages-store.ts) et son journal, sur un Firestore simulé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { creerFauxFirestore } from "./faux-firestore";

const F = creerFauxFirestore();
const journal: Array<{ action: string; cible: string; details: unknown }> = [];
vi.mock("../src/lib/firebase-admin", () => ({ adminDb: () => F.db }));
vi.mock("../src/lib/audit", () => ({
  recordAudit: async (_s: unknown, action: string, cible: string, details: unknown) => void journal.push({ action, cible, details }),
}));
const SESSION = { uid: "u1", email: "d.paquette@chanv.com", displayName: "Daphnée Paquette", photoURL: null, role: "admin" };
let ecrivain = true;
vi.mock("../src/lib/auth-server", () => ({
  requireRead: async () => SESSION,
  requireWrite: async () => {
    if (!ecrivain) throw new Error("FORBIDDEN");
    return SESSION;
  },
}));

const { listerReglages } = await import("../src/lib/seo-reglages-store");
const { PUT } = await import("../src/app/api/site/seo/[cle]/route");

const SEO = "bleuh_site_seo";
const poser = (cle: string, body: unknown) =>
  PUT(new NextRequest(`http://local/api/site/seo/${cle}`, { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ cle }),
  });

beforeEach(() => {
  F.vider();
  journal.length = 0;
  ecrivain = true;
});

describe("écrire un titre et une description", () => {
  it("pose le réglage de l'adresse, avec qui et quand, et le journalise", async () => {
    const res = await poser("fr__notre-histoire", { title: "Notre histoire | Bleuh au Québec", description: "Nos débuts.", ogImage: "" });
    expect(res.status).toBe(200);
    const doc = F.lire(SEO, "fr__notre-histoire")!;
    expect(doc).toMatchObject({
      chemin: "/fr/notre-histoire",
      title: "Notre histoire | Bleuh au Québec",
      description: "Nos débuts.",
      ogImage: "",
      updatedBy: "d.paquette@chanv.com",
    });
    expect(typeof doc.updatedAt).toBe("string");
    expect(journal).toEqual([
      {
        action: "site.seo.regle",
        cible: "site/seo/fr__notre-histoire",
        details: {
          avant: { title: "", description: "", ogImage: "" },
          apres: { title: "Notre histoire | Bleuh au Québec", description: "Nos débuts.", ogImage: "" },
        },
      },
    ]);
    const tous = await listerReglages();
    expect(tous["fr__notre-histoire"]).toMatchObject({ chemin: "/fr/notre-histoire", modifiePar: "d.paquette@chanv.com" });
  });

  it("vider les trois champs retire le réglage : la page reprend le texte du site", async () => {
    await poser("en", { title: "Bleuh — Canada", description: "", ogImage: "" });
    expect(F.lire(SEO, "en")).toBeDefined();
    const res = await poser("en", { title: "  ", description: "", ogImage: "" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, reglage: null });
    expect(F.lire(SEO, "en")).toBeUndefined();
    expect(journal.map((j) => j.action)).toEqual(["site.seo.regle", "site.seo.retire"]);
  });

  it("refuse une adresse qui n'est pas une page de bleuh.co, un champ inconnu, une image non https", async () => {
    expect((await poser("admin__secret", { title: "x" })).status).toBe(404);
    expect((await poser("fr__contact", { title: "x", noindex: true })).status).toBe(400);
    expect((await poser("fr__contact", { ogImage: "http://bleuh.co/x.jpg" })).status).toBe(400);
    expect(F.lire(SEO, "fr__contact")).toBeUndefined();
    expect(journal).toEqual([]);
  });

  it("refuse l'écriture sans le rôle Gestionnaire", async () => {
    ecrivain = false;
    expect((await poser("fr__contact", { title: "x" })).status).toBe(403);
    expect(F.lire(SEO, "fr__contact")).toBeUndefined();
  });
});
