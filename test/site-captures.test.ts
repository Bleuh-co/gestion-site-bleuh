/**
 * Erreur métier à statut (src/lib/erreur-metier.ts) et téléversement des
 * captures d'une demande (POST /api/site/captures) — lot L9. Le bucket et la
 * session sont remplacés : jamais d'écriture réelle.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWrite = vi.fn();
const save = vi.fn();

vi.mock("../src/lib/auth-server", () => ({ requireWrite: () => requireWrite() }));
vi.mock("../src/lib/firebase-admin", () => ({
  adminDb: () => {
    throw new Error("Firestore interdit en test");
  },
  adminBucket: () => ({
    name: "bucket-test",
    file: (path: string) => ({
      exists: async () => [false],
      save: async (bytes: Buffer, opts: unknown) => save(path, bytes, opts),
      makePublic: async () => undefined,
    }),
  }),
}));

const { ErreurMetier, reponseErreur } = await import("../src/lib/erreur-metier");
const { ValidationError } = await import("../src/lib/products-service");
const { cheminImage } = await import("../src/lib/product-images");
const { POST } = await import("../src/app/api/site/captures/route");

describe("reponseErreur", () => {
  it.each([
    [new Error("UNAUTHORIZED"), 401, "Non authentifié."],
    [new Error("FORBIDDEN"), 403, "Accès refusé."],
    [new ErreurMetier("Cette adresse est déjà prise.", 409), 409, "Cette adresse est déjà prise."],
    [new ErreurMetier("Page introuvable.", 404), 404, "Page introuvable."],
    [new ErreurMetier("Configuration incomplète.", 501), 501, "Configuration incomplète."],
    [new ValidationError("Le fichier reçu est vide."), 400, "Le fichier reçu est vide."],
  ])("%s → %i", async (err, status, message) => {
    const res = reponseErreur(err, "test");
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ success: false, message });
  });

  it("l'extra d'une erreur métier accompagne le message", async () => {
    const res = reponseErreur(new ErreurMetier("Verrouillé.", 409, { code: "verrou", par: "a@chanv.com" }), "test");
    expect(await res.json()).toEqual({ success: false, message: "Verrouillé.", code: "verrou", par: "a@chanv.com" });
  });

  it("une panne inconnue : 500, sans la trace", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = reponseErreur(new Error("PERMISSION_DENIED: projects/antigravity…"), "test");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("PERMISSION_DENIED");
    spy.mockRestore();
  });
});

describe("cheminImage", () => {
  it("<dossier>/AAAA/MM/<nom>, en UTC", () => {
    // 1er novembre 00:30 UTC = encore le 31 octobre à Montréal : le dossier suit UTC, comme le catalogue.
    expect(cheminImage("site-assets/atterrissages", new Date("2026-11-01T00:30:00Z"), "a.png")).toBe(
      "site-assets/atterrissages/2026/11/a.png"
    );
    expect(cheminImage("site-assets/uploads", new Date("2026-03-15T12:00:00Z"), "b.webp")).toBe("site-assets/uploads/2026/03/b.webp");
  });
});

function requete(fichier?: File): Request {
  const fd = new FormData();
  if (fichier) fd.set("file", fichier);
  return new Request("http://localhost/api/site/captures", { method: "POST", body: fd });
}

describe("POST /api/site/captures", () => {
  beforeEach(() => {
    requireWrite.mockReset().mockResolvedValue({ email: "d.exemple@chanv.com", role: "gestionnaire" });
    save.mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("dépose la capture sous site-assets/atterrissages et rend son adresse https", async () => {
    const res = await POST(requete(new File([new Uint8Array([1, 2, 3])], "Maquette été.png", { type: "image/png" })) as never);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.success).toBe(true);
    expect(j.path).toMatch(/^site-assets\/atterrissages\/\d{4}\/\d{2}\/Maquette-ete\.png$/);
    expect(j.url).toBe(`https://storage.googleapis.com/bucket-test/${j.path}`);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe(j.path);
  });

  it("sans droit d'écriture : 403, rien n'est déposé", async () => {
    requireWrite.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await POST(requete(new File([new Uint8Array([1])], "a.png", { type: "image/png" })) as never);
    expect(res.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  it("un SVG est refusé : il peut porter du script", async () => {
    const res = await POST(requete(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/PNG, JPEG, WebP, GIF/);
    expect(save).not.toHaveBeenCalled();
  });

  it("aucun fichier : 400, message clair", async () => {
    const res = await POST(requete() as never);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/Aucun fichier/);
  });

  it("fichier vide : 400", async () => {
    const res = await POST(requete(new File([], "a.png", { type: "image/png" })) as never);
    expect(res.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
