"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateLongue, phrasesDeLaPage, type Visibilite, type Zone } from "@/lib/atterrissages-pure";
import { apercuSignalement, slugifier, texteDuSignalement } from "@/lib/demande-atterrissage-pure";
import type { TacheTrouvee } from "@/lib/taches-hub";
import type { Product } from "@/lib/types";
import { apiSite, useLibellesPage } from "@/lib/atterrissages-client";

/**
 * « Demander une page », côté Bleuh (lot L10 ; maquette « Demander une page,
 * côté Bleuh ») : deux adresses, la zone et les langues, aucun prix. À droite,
 * l'aperçu EXACT du texte que recevra l'équipe du site — la même fonction
 * pure que le serveur (`texteDuSignalement`) : ce qui est montré est ce qui part.
 */

type Mode = "decrire" | "tache";
type ChoixZone = "qc" | "ca" | "qcca";
const ZONES_DU_CHOIX: Record<ChoixZone, Zone[]> = { qc: ["qc"], ca: ["ca"], qcca: ["qc", "ca"] };
const CAPTURES_MAX = 5;

interface Capture {
  name: string;
  url: string;
}

type ProduitCatalogue = Pick<Product, "id" | "name" | "sku" | "status">;

export function DemandeAtterrissageClient({ demandeurNom }: { demandeurNom: string }) {
  const { t, locale } = useLibellesPage();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("decrire");
  const [nom, setNom] = useState("");
  const [adresseFr, setAdresseFr] = useState("");
  const [adresseEn, setAdresseEn] = useState("");
  const [adresseTouchee, setAdresseTouchee] = useState(false);
  useEffect(() => {
    if (!adresseTouchee) setAdresseFr(slugifier(nom));
  }, [nom, adresseTouchee]);
  const [zoneChoisie, setZoneChoisie] = useState<ChoixZone>("qc");
  const [bilingue, setBilingue] = useState(true);

  const [aQuoiSert, setAQuoiSert] = useState("");
  const [aChanger, setAChanger] = useState("");
  const [maquetteLien, setMaquetteLien] = useState("");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [televersement, setTeleversement] = useState(false);
  const fichierRef = useRef<HTMLInputElement | null>(null);

  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [produitsIds, setProduitsIds] = useState<string[]>([]);
  const [requeteProduit, setRequeteProduit] = useState("");
  useEffect(() => {
    fetch("/api/produits?status=published")
      .then((r) => (r.ok ? r.json() : []))
      .then((r: ProduitCatalogue[]) => setCatalogue(Array.isArray(r) ? r : []))
      .catch(() => setCatalogue([]));
  }, []);
  const resultatsProduits = useMemo(() => {
    const q = requeteProduit.trim().toLowerCase();
    if (!q) return [];
    return catalogue
      .filter((p) => !produitsIds.includes(p.id))
      .filter((p) => [p.name?.fr, p.name?.en, p.sku, p.id].some((v) => String(v ?? "").toLowerCase().includes(q)))
      .slice(0, 8);
  }, [catalogue, requeteProduit, produitsIds]);
  const nomProduit = (id: string) => catalogue.find((p) => p.id === id)?.name?.fr || id;

  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [sansFin, setSansFin] = useState(false);
  const [visibilite, setVisibilite] = useState<Visibilite>("publique");
  const [pretePourLe, setPretePourLe] = useState("");

  const [requeteTache, setRequeteTache] = useState("");
  const [resultatsTaches, setResultatsTaches] = useState<TacheTrouvee[]>([]);
  const [chercheEnCours, setChercheEnCours] = useState(false);
  const [tacheChoisie, setTacheChoisie] = useState<TacheTrouvee | null>(null);

  useEffect(() => {
    if (mode !== "tache" || requeteTache.trim().length < 2) {
      setResultatsTaches([]);
      return;
    }
    const id = setTimeout(async () => {
      setChercheEnCours(true);
      try {
        const r = await apiSite<{ items: TacheTrouvee[] }>(`/taches/recherche?q=${encodeURIComponent(requeteTache)}`);
        setResultatsTaches(r.items ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        setChercheEnCours(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [requeteTache, mode]);

  const onFichiers = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const place = CAPTURES_MAX - captures.length;
    if (place <= 0) {
      toast.error(t("pa.demCapturesMax"));
      return;
    }
    setTeleversement(true);
    try {
      for (const f of Array.from(files).slice(0, place)) {
        const fd = new FormData();
        fd.set("file", f);
        const res = await fetch("/api/site/captures", { method: "POST", body: fd });
        const j = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; url?: string };
        if (!res.ok || j.success === false || !j.url) throw new Error(j.message || "Téléversement impossible.");
        setCaptures((c) => [...c, { name: f.name, url: j.url! }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTeleversement(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  };

  const zones = ZONES_DU_CHOIX[zoneChoisie];
  const langues = bilingue ? (["fr", "en"] as const) : (["fr"] as const);

  // L'aperçu : la MÊME fonction pure que le serveur, avec ce qui est déjà saisi.
  const texte = texteDuSignalement({
    nom: nom || "…",
    adresseFr: adresseFr || "…",
    adresseEn: bilingue ? adresseEn || "…" : "",
    zones,
    langues: [...langues],
    demandeurNom,
    aQuoiSert: mode === "tache" ? null : aQuoiSert,
    aChanger,
    maquetteLien,
    nombreCaptures: captures.length,
    produits: produitsIds.map(nomProduit),
    periode: debut ? phrasesDeLaPage({ debut, fin: sansFin ? null : fin || null }, "fr").periode : null,
    visibilite,
    pretePourLe: pretePourLe ? dateLongue(pretePourLe, "fr") : null,
    ficheUrl: typeof window !== "undefined" ? `${window.location.origin}/pages-atterrissage/${adresseFr || "…"}` : "",
  });

  const [envoi, setEnvoi] = useState(false);
  const adressesPretes = !!adresseFr && (!bilingue || !!adresseEn);
  const pretAEnvoyer = !!nom && adressesPretes && (mode === "tache" ? !!tacheChoisie : !!aQuoiSert.trim());

  const envoyer = async () => {
    if (!pretAEnvoyer) return;
    setEnvoi(true);
    try {
      const commun = {
        nom,
        adresseFr,
        adresseEn: bilingue ? adresseEn : "",
        zones,
        langues,
        produits: produitsIds,
        debut: debut || null,
        fin: sansFin ? null : fin || null,
        visibilite,
        pretePourLe: pretePourLe || null,
      };
      const corps =
        mode === "decrire"
          ? { ...commun, mode, aQuoiSert, aChanger, maquetteLien, captures: captures.map((c) => c.url) }
          : { ...commun, mode, tacheId: tacheChoisie?.id ?? null };
      const r = await apiSite<{ id: string; signalement: { ok: boolean; error?: string } }>("/atterrissages/demande", {
        method: "POST",
        body: JSON.stringify(corps),
      });
      if (r.signalement.ok) toast.success(t("pa.demEnvoyee"));
      else toast.warning(`${t("pa.demFicheCreeeSansSignalement")} ${r.signalement.error ?? ""}`);
      router.push(`/pages-atterrissage/${r.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  const bascule = (actif: boolean) =>
    cn("rounded-full px-4 py-1.5 font-medium transition-colors", actif ? "bg-chanv-terre text-white" : "text-chanv-terre/70");

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <a href="/pages-atterrissage" className="text-sm text-chanv-terre/60 hover:underline">
          {t("pa.retour")}
        </a>
        <h1 className="text-2xl font-bold mt-2 mb-2">{t("pa.demTitre")}</h1>
        <p className="text-sm text-chanv-terre/60 max-w-2xl">{t("pa.demIntro")}</p>
      </div>

      <div className="inline-flex rounded-full bg-chanv-fibre/60 p-1 text-sm">
        <button type="button" className={bascule(mode === "decrire")} onClick={() => setMode("decrire")}>
          {t("pa.demModeDecrire")}
        </button>
        <button type="button" className={bascule(mode === "tache")} onClick={() => setMode("tache")}>
          {t("pa.demModeTache")}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {mode === "tache" && (
            <section className="card p-5 space-y-3">
              <label className="label">{t("pa.demChercherTache")}</label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chanv-terre/40" aria-hidden="true" />
                <input
                  className="input pl-8"
                  value={requeteTache}
                  onChange={(e) => {
                    setRequeteTache(e.target.value);
                    setTacheChoisie(null);
                  }}
                  placeholder={t("pa.demChercherTachePlaceholder")}
                />
              </div>
              {chercheEnCours && <p className="text-xs text-chanv-terre/50">…</p>}
              <div className="space-y-2">
                {resultatsTaches.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setTacheChoisie(r)}
                    className={cn(
                      "block w-full rounded border p-3 text-left text-sm",
                      tacheChoisie?.id === r.id ? "border-2" : "border-chanv-fibre hover:bg-chanv-fibre/30"
                    )}
                    style={tacheChoisie?.id === r.id ? { borderColor: "var(--app-gold)" } : undefined}
                  >
                    <div className="font-medium">{r.title}</div>
                    {r.subtitle && <div className="text-xs text-chanv-terre/50">{r.subtitle}</div>}
                  </button>
                ))}
              </div>
              {tacheChoisie && (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{t("pa.demTacheResteOuverte")}</div>
              )}
            </section>
          )}

          <section className="card p-5 space-y-4">
            <div>
              <label className="label">{t("pa.demNomPage")}</label>
              <input className="input" value={nom} placeholder={t("pa.demNomPagePlaceholder")} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("pa.demAdresseFr")}</label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-chanv-terre/50">bleuh.co/fr/</span>
                <input
                  className="input flex-1"
                  value={adresseFr}
                  onChange={(e) => {
                    setAdresseFr(e.target.value);
                    setAdresseTouchee(true);
                  }}
                />
                <span className="text-chanv-terre/50">/</span>
              </div>
            </div>
            {bilingue && (
              <div>
                <label className="label">{t("pa.demAdresseEn")}</label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-chanv-terre/50">bleuh.co/en/</span>
                  <input className="input flex-1" value={adresseEn} onChange={(e) => setAdresseEn(e.target.value)} />
                  <span className="text-chanv-terre/50">/</span>
                </div>
              </div>
            )}
            <p className="text-xs text-chanv-terre/50 -mt-2">{t("pa.demAdresseHint")}</p>

            <div>
              <p className="label mb-1">{t("pa.zone")}</p>
              {(["qc", "ca", "qcca"] as const).map((z) => (
                <label key={z} className="flex items-center gap-2 text-sm py-0.5">
                  <input type="radio" name="zone" checked={zoneChoisie === z} onChange={() => setZoneChoisie(z)} />
                  {t(`pa.zone.${z}`)}
                </label>
              ))}
            </div>

            <div>
              <p className="label mb-1">{t("pa.langues")}</p>
              <label className="flex items-center gap-2 text-sm py-0.5">
                <input type="radio" name="langues" checked={bilingue} onChange={() => setBilingue(true)} />
                {t("pa.langues.frEn")}
              </label>
              <label className="flex items-center gap-2 text-sm py-0.5">
                <input type="radio" name="langues" checked={!bilingue} onChange={() => setBilingue(false)} />
                {t("pa.langues.fr")}
              </label>
            </div>

            {mode === "decrire" && (
              <>
                <div>
                  <label className="label">{t("pa.demAQuoiSert")}</label>
                  <textarea className="input" rows={3} value={aQuoiSert} onChange={(e) => setAQuoiSert(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("pa.demAChanger")}</label>
                  <textarea className="input" rows={3} value={aChanger} onChange={(e) => setAChanger(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("pa.demMaquette")}</label>
                  <input className="input" placeholder="https://…" value={maquetteLien} onChange={(e) => setMaquetteLien(e.target.value)} />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {captures.map((c, i) => (
                      <span key={c.url} className="inline-flex items-center gap-1 rounded bg-chanv-fibre px-2 py-1 text-xs">
                        {c.name}
                        <button type="button" onClick={() => setCaptures((cs) => cs.filter((_, j) => j !== i))} aria-label={t("pa.retirer")}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {captures.length < CAPTURES_MAX && (
                      <button
                        type="button"
                        className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"
                        disabled={televersement}
                        onClick={() => fichierRef.current?.click()}
                      >
                        <ImagePlus size={13} aria-hidden="true" />
                        {t("pa.demAjouterCapture")}
                      </button>
                    )}
                    <input
                      ref={fichierRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => void onFichiers(e.target.files)}
                    />
                  </div>
                  <p className="text-xs text-chanv-terre/50 mt-1">{t("pa.demCapturesHint")}</p>
                </div>
              </>
            )}

            <div>
              <label className="label">{t("pa.demProduits")}</label>
              <div className="mb-2 flex flex-wrap gap-2">
                {produitsIds.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-chanv-fibre px-3 py-1 text-xs">
                    {nomProduit(id)}
                    <button type="button" onClick={() => setProduitsIds((ids) => ids.filter((x) => x !== id))} aria-label={t("pa.retirer")}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <input className="input" placeholder={t("pa.demAjouterProduit")} value={requeteProduit} onChange={(e) => setRequeteProduit(e.target.value)} />
              {resultatsProduits.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded border border-chanv-fibre">
                  {resultatsProduits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="block w-full px-2 py-1 text-left text-sm hover:bg-chanv-fibre/40"
                      onClick={() => {
                        setProduitsIds((ids) => [...ids, p.id]);
                        setRequeteProduit("");
                      }}
                    >
                      {(locale === "en" && p.name?.en) || p.name?.fr || p.id}
                      {p.sku && <span className="font-mono text-xs text-chanv-terre/40"> — {p.sku}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="label mb-1">{t("pa.demDates")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-chanv-terre/60">{t("pa.demDu")}</span>
                <input className="input w-auto" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
                <span className="text-sm text-chanv-terre/60">{t("pa.demAu")}</span>
                <input className="input w-auto" type="date" value={fin} disabled={sansFin} onChange={(e) => setFin(e.target.value)} />
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={sansFin} onChange={(e) => setSansFin(e.target.checked)} />
                  {t("pa.sansFin")}
                </label>
              </div>
              <p className="text-xs text-chanv-terre/50 mt-1">{t("pa.demDatesHint")}</p>
            </div>

            <div>
              <p className="label mb-1">{t("pa.visibilite")}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="visibilite" checked={visibilite === "publique"} onChange={() => setVisibilite("publique")} />
                {t("pa.publique")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="visibilite" checked={visibilite === "privee"} onChange={() => setVisibilite("privee")} />
                {t("pa.priveeLienDirect")}
              </label>
            </div>

            <div>
              <label className="label">{t("pa.demPretePourLe")}</label>
              <input className="input w-auto" type="date" value={pretePourLe} onChange={(e) => setPretePourLe(e.target.value)} />
              <p className="text-xs text-chanv-terre/50 mt-1">{t("pa.demPretePourLeHint")}</p>
            </div>

            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t("pa.demRappelBleuh")}</p>

            <div className="flex items-center gap-2 pt-2">
              <button type="button" className="btn-primary" disabled={!pretAEnvoyer || envoi} onClick={() => void envoyer()}>
                {t("pa.demEnvoyer")}
              </button>
              <a href="/pages-atterrissage" className="btn-secondary">
                {t("pa.annuler")}
              </a>
            </div>
          </section>
        </div>

        <div className="lg:col-span-2">
          <section className="card p-5 space-y-2 sticky top-6">
            <h2 className="text-base font-semibold">{t("pa.demApercuTitre")}</h2>
            <p className="text-xs text-chanv-terre/50">{t("pa.demApercuSousTitre")}</p>
            <pre className="whitespace-pre-wrap break-words rounded bg-chanv-fibre/40 p-3 text-xs leading-relaxed">{apercuSignalement(texte)}</pre>
          </section>
        </div>
      </div>
    </main>
  );
}
