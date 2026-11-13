"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DETAILS_ES,
  champsAPlat,
  textesVides,
  type DetailEs,
  type ProductEs,
  type ProductEsTextes,
} from "@/lib/products-es-pure";

/**
 * La section ESPAGNOLE d'une fiche produit : la troisième langue de bleuh.co
 * (/es). Elle s'enregistre à part de la fiche (lib/products-es-pure.ts), donc
 * avec son propre bouton. Un champ laissé vide s'affiche en anglais sur le site.
 *
 * « Traduire automatiquement » propose une traduction de l'anglais ; rien n'est
 * enregistré tant qu'on n'a pas cliqué « Enregistrer l'espagnol ».
 */

interface Etat {
  espagnol: ProductEs | null;
  anglais: ProductEsTextes;
  perimes: string[];
}

const LIBELLES: Record<string, string> = {
  name: "Nom",
  description: "Description",
  seoTitle: "Titre Google",
  metaDescription: "Description Google",
  currentRotation: "Rotation actuelle",
  "details.format": "Format",
  "details.variety": "Variété",
  "details.effects": "Effets",
  "details.terpenes": "Terpènes",
  "details.growLocation": "Lieu de culture",
  "details.distribution": "Distribution",
};

export function EspagnolSection({ id, canWrite, version }: { id: string; canWrite: boolean; version: string }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [textes, setTextes] = useState<ProductEsTextes>(textesVides());
  const [modifie, setModifie] = useState(false);
  // « auto » tant que la proposition de la machine n'a pas été retouchée.
  const [mode, setMode] = useState<"auto" | "manuel">("manuel");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<"" | "traduction" | "enregistrement">("");

  // `version` = date de modification de la fiche : après un enregistrement de
  // la fiche, on relit pour savoir si l'anglais a changé.
  useEffect(() => {
    let annule = false;
    setErreur(null);
    fetch(`/api/produits/${encodeURIComponent(id)}/espagnol`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
        return data as Etat;
      })
      .then((data) => {
        if (annule) return;
        setEtat(data);
        setTextes(data.espagnol ? extraire(data.espagnol) : textesVides());
        setMode(data.espagnol?.mode ?? "manuel");
        setModifie(false);
      })
      .catch((e) => {
        if (!annule) setErreur(e.message || "Impossible de lire la section espagnole.");
      });
    return () => {
      annule = true;
    };
  }, [id, version]);

  function changer(cle: string, valeur: string) {
    setTextes((prev) => {
      if (cle.startsWith("details.")) {
        return { ...prev, details: { ...prev.details, [cle.slice(8) as DetailEs]: valeur } };
      }
      return { ...prev, [cle]: valeur };
    });
    setModifie(true);
    setMode("manuel");
  }

  async function traduire() {
    if (modifie && !window.confirm("La traduction automatique remplace ce qui est écrit dans la section espagnole. Continuer ?")) return;
    setOccupe("traduction");
    setErreur(null);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}/espagnol/traduire`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setTextes(data.textes as ProductEsTextes);
      setModifie(true);
      setMode("auto");
      toast.success("Traduction proposée. Relisez-la, puis enregistrez.");
    } catch (e: any) {
      const message = e.message || "La traduction a échoué.";
      setErreur(message);
      toast.error(message);
    } finally {
      setOccupe("");
    }
  }

  async function enregistrer() {
    setOccupe("enregistrement");
    setErreur(null);
    try {
      const res = await fetch(`/api/produits/${encodeURIComponent(id)}/espagnol`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ textes, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setEtat(data as Etat);
      setModifie(false);
      toast.success("Section espagnole enregistrée.");
    } catch (e: any) {
      const message = e.message || "Impossible d'enregistrer la section espagnole.";
      setErreur(message);
      toast.error(message);
    } finally {
      setOccupe("");
    }
  }

  const anglais = etat ? champsAPlat(etat.anglais) : {};
  const valeurs = champsAPlat(textes);
  // On ne montre que les champs que la fiche remplit en anglais, ou déjà remplis ici.
  const cles = Object.keys(LIBELLES).filter((k) => (anglais[k] ?? "").trim() || (valeurs[k] ?? "").trim());
  const perimes = new Set(etat?.perimes ?? []);

  return (
    <section className="card p-6 space-y-4 mt-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-chanv-terre/60">Español — section espagnole</h2>
          <p className="text-xs text-chanv-terre/60 mt-1">
            Affichée sur bleuh.co en espagnol (/es). Un champ vide s&apos;affiche en anglais.
            {etat?.espagnol && (
              <>
                {" "}
                {etat.espagnol.mode === "auto" ? "Traduction automatique, non relue." : "Relue à la main."}
              </>
            )}
          </p>
        </div>
        {canWrite && etat && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={traduire} disabled={!!occupe}>
              {occupe === "traduction" ? "Traduction…" : "Traduire automatiquement"}
            </button>
            <button className="btn-primary" onClick={enregistrer} disabled={!!occupe || !modifie}>
              {occupe === "enregistrement" ? "Enregistrement…" : "Enregistrer l'espagnol"}
            </button>
          </div>
        )}
      </div>

      {erreur && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {erreur}
        </p>
      )}

      {!etat && !erreur && <p className="text-sm text-gray-400">Chargement…</p>}

      {etat && perimes.size > 0 && !modifie && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {etat.espagnol
            ? `L'anglais a changé depuis la traduction (${[...perimes].map((k) => LIBELLES[k] ?? k).join(", ")}). Retraduisez ou corrigez ces champs.`
            : "Cette fiche n'a pas encore de section espagnole : elle s'affiche en anglais sur /es."}
        </p>
      )}

      {etat && cles.length === 0 && <p className="text-sm text-gray-400">La fiche n&apos;a aucun texte anglais à traduire.</p>}

      {etat &&
        cles.map((cle) => {
          const long = cle === "description" || cle === "metaDescription";
          return (
            <div key={cle} className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="label">{LIBELLES[cle]} (EN)</span>
                <p className="text-sm text-chanv-terre/60 whitespace-pre-wrap">{anglais[cle] || "—"}</p>
              </div>
              <div>
                <label className="label" htmlFor={`es-${cle}`}>
                  {LIBELLES[cle]} (ES){perimes.has(cle) && !modifie && etat.espagnol ? " — à revoir" : ""}
                </label>
                {long ? (
                  <textarea
                    id={`es-${cle}`}
                    lang="es"
                    className="input min-h-[6rem]"
                    value={valeurs[cle]}
                    disabled={!canWrite}
                    onChange={(e) => changer(cle, e.target.value)}
                  />
                ) : (
                  <input
                    id={`es-${cle}`}
                    lang="es"
                    className="input"
                    value={valeurs[cle]}
                    disabled={!canWrite}
                    onChange={(e) => changer(cle, e.target.value)}
                  />
                )}
              </div>
            </div>
          );
        })}
    </section>
  );
}

function extraire(es: ProductEs): ProductEsTextes {
  const out = textesVides();
  out.name = es.name;
  out.description = es.description;
  out.seoTitle = es.seoTitle;
  out.metaDescription = es.metaDescription;
  out.currentRotation = es.currentRotation;
  for (const d of DETAILS_ES) out.details[d] = es.details[d];
  return out;
}
