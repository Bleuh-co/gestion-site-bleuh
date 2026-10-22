/**
 * « Relier une tâche existante » — src/lib/taches-hub.ts, porté de
 * marketing-mdh au lot L9 (plan « Pages d'atterrissage et infolettres »). Même
 * mécanisme d'identité que tickets-clients/src/lib/tickets-hub.ts : un
 * jeton personnalisé échangé contre un jeton d'identité, au nom de la
 * personne connectée. Testé avec tout injecté : jamais de vrai appel réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chercherTachesHub, HubRefus, oublierJetons, type Personne } from "../src/lib/taches-hub";

const QUI: Personne = { uid: "uid123", email: "d.exemple@chanv.com" };

/** Un jeton d'identité minimal, décodable par `courrielDuJeton` (payload base64url). */
function faireJeton(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return `entete.${payload}.signature`;
}

describe("chercherTachesHub", () => {
  beforeEach(() => oublierJetons());
  afterEach(() => oublierJetons());

  const deps = () => ({
    jetonPerso: vi.fn().mockResolvedValue("jeton-perso"),
    cleWeb: "cle-web-test",
  });

  it("moins de 2 caractères : aucun appel, liste vide", async () => {
    const jetonPerso = vi.fn();
    const fetchFn = vi.fn();
    const r = await chercherTachesHub(QUI, "a", { jetonPerso, fetch: fetchFn, cleWeb: "x" });
    expect(r).toEqual([]);
    expect(jetonPerso).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("cherche au nom de la personne, avec le jeton d'identité en en-tête", async () => {
    const fetchFn = vi
      .fn()
      // 1) échange du jeton personnalisé → jeton d'identité
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton(QUI.email), expiresIn: "3600" }) })
      // 2) GET /api/search
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            { id: "t1", title: "Page de lancement Wildberry", archived: false, subtitle: "Ouverte · Marketing Bleuh · Daphnée" },
          ],
        }),
      });

    const r = await chercherTachesHub(QUI, "affiliés", { ...deps(), fetch: fetchFn });
    expect(r).toEqual([
      { id: "t1", title: "Page de lancement Wildberry", archived: false, subtitle: "Ouverte · Marketing Bleuh · Daphnée" },
    ]);

    const [searchUrl, searchInit] = fetchFn.mock.calls[1];
    expect(searchUrl).toBe("https://gandalf.chanv.com/api/search?q=affili%C3%A9s");
    expect(searchInit.headers.Authorization).toBe(`Bearer ${faireJeton(QUI.email)}`);
  });

  it("une entrée sans titre ou sans id n'est pas rendue", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton(QUI.email), expiresIn: "3600" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [{ id: "", title: "Sans id" }, { id: "t2", title: "" }, null, "texte"] }),
      });
    const r = await chercherTachesHub(QUI, "test", { ...deps(), fetch: fetchFn });
    expect(r).toEqual([]);
  });

  it("le jeton est mis en cache : un seul échange pour deux recherches", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton(QUI.email), expiresIn: "3600" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) });
    const d = deps();
    await chercherTachesHub(QUI, "aa", { ...d, fetch: fetchFn });
    await chercherTachesHub(QUI, "bb", { ...d, fetch: fetchFn });
    expect(d.jetonPerso).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(3); // 1 échange + 2 recherches
  });

  it("un 401 fait recommencer une fois, puis réussit", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton(QUI.email), expiresIn: "3600" }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "expiré" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton(QUI.email), expiresIn: "3600" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) });
    const r = await chercherTachesHub(QUI, "test", { ...deps(), fetch: fetchFn });
    expect(r).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("createCustomToken en panne (droit manquant) : refus clair, pas une 500 muette", async () => {
    const jetonPerso = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(chercherTachesHub(QUI, "test", { jetonPerso, cleWeb: "x", fetch: vi.fn() })).rejects.toMatchObject({
      status: 503,
    });
  });

  it("sans clé web Firebase : refus 501, explicite", async () => {
    const jetonPerso = vi.fn().mockResolvedValue("jeton-perso");
    await expect(chercherTachesHub(QUI, "test", { jetonPerso, cleWeb: "", fetch: vi.fn() })).rejects.toMatchObject({ status: 501 });
  });

  it("un jeton qui ne correspond pas à la personne connectée est refusé (403)", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ idToken: faireJeton("quelquun.dautre@chanv.com"), expiresIn: "3600" }) });
    await expect(chercherTachesHub(QUI, "test", { ...deps(), fetch: fetchFn })).rejects.toBeInstanceOf(HubRefus);
  });
});
