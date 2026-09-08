"use client";

import { useEffect, useRef, useState } from "react";
import { ROTATION_CATEGORY_SUGGESTIONS } from "../produits/constants";
import { categoryColor, categoryColorLabel } from "@/lib/variety-colors";
import { varietyKey } from "@/lib/variety-key";
import type { VarietyEditorial } from "@/lib/types";

interface VarietyFicheEditorProps {
  /** Nom tel qu'écrit au référentiel — sert de clé et n'est pas modifiable. */
  name: string;
  /** Orthographes absorbées par le référentiel, pour retrouver la fiche. */
  absorbs: string[];
  /** Fiche déjà enregistrée, ou null pour une première saisie. */
  fiche: VarietyEditorial | null;
  onClose: () => void;
  onSaved: (fiche: VarietyEditorial) => void;
  onDeleted: (key: string) => void;
}

export function VarietyFicheEditor({
  name,
  absorbs,
  fiche,
  onClose,
  onSaved,
  onDeleted,
}: VarietyFicheEditorProps) {
  const [category, setCategory] = useState(fiche?.category ?? "");
  const [thc, setThc] = useState(fiche?.thc ?? "");
  const [image, setImage] = useState(fiche?.image ?? "");
  const [url, setUrl] = useState(fiche?.url ?? "");
  const [note, setNote] = useState(fiche?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = varietyKey(name);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Échap ferme : le panneau se superpose à la liste, il faut pouvoir en
  // sortir sans viser le bouton.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/varietes/fiches/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, thc, image, url, note, aliasKeys: absorbs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Erreur ${res.status}`);
      onSaved(data as VarietyEditorial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer la fiche de « ${name} » ? Les produits déjà réglés ne changent pas.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/varietes/fiches/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      onDeleted(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de la variété ${name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="card w-full max-w-2xl space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{name}</h2>
            <p className="text-xs text-chanv-terre/50">
              Fiche de la variété — s&apos;applique à tous les produits qui l&apos;afficheront.
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Fermer
          </button>
        </div>

        <p className="text-sm text-chanv-terre/60">
          Réglez ici ce que le visiteur verra de cette variété sur bleuh.co, même si elle
          n&apos;est pas encore en rotation. Quand elle sera ajoutée à un produit, sa carte
          reprendra ces valeurs. Les cartes déjà remplies sur un produit gardent les leurs.
        </p>

        <div>
          <label className="label" htmlFor="fiche-category">
            Catégorie
          </label>
          <input
            id="fiche-category"
            ref={firstFieldRef}
            className="input"
            list="fiche-category-suggestions"
            value={category}
            placeholder="ex. Hybride à dominance indica"
            disabled={busy}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="fiche-category-suggestions">
            {ROTATION_CATEGORY_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          {/* La couleur n'est pas un champ : le site la déduit du mot trouvé
              dans cette phrase. On la montre donc au lieu de la faire deviner
              — c'est exactement ce que l'écran ne disait pas jusqu'ici. */}
          <p className="mt-2 flex items-center gap-2 text-xs text-chanv-terre/60">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: categoryColor(category) }}
            />
            {category.trim()
              ? `Cette variété s'affichera en ${categoryColorLabel(category)}.`
              : `Sans catégorie, elle s'affichera en ${categoryColorLabel("")} (hybride).`}
          </p>
          <p className="mt-1 text-xs text-chanv-terre/50">
            Texte libre, affiché tel quel sous le nom. La couleur vient du mot «&nbsp;indica&nbsp;»
            ou «&nbsp;sativa&nbsp;» trouvé dans la phrase&nbsp;; toute autre formulation donne
            l&apos;orange de l&apos;hybride.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fiche-thc">
              THC (étiquette)
            </label>
            <input
              id="fiche-thc"
              className="input"
              value={thc}
              placeholder="ex. THC:25%-30%"
              disabled={busy}
              onChange={(e) => setThc(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="fiche-url">
              Lien vers la fiche variété
            </label>
            <input
              id="fiche-url"
              className="input"
              value={url}
              placeholder="laisser vide si la carte ne doit pas être cliquable"
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="fiche-image">
            Image de la variété
          </label>
          <div className="flex items-start gap-3">
            {image.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={`Aperçu de la variété ${name}`}
                className="h-20 w-20 shrink-0 rounded-lg border border-chanv-terre/15 bg-white object-contain"
              />
            ) : null}
            <input
              id="fiche-image"
              className="input"
              value={image}
              placeholder="adresse d'une image"
              disabled={busy}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>
          <p className="mt-1 text-xs text-chanv-terre/50">
            Pour téléverser un visuel, passez par la fiche du produit&nbsp;: cet écran n&apos;accepte
            qu&apos;une adresse.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="fiche-note">
            Note interne
          </label>
          <input
            id="fiche-note"
            className="input"
            value={note}
            placeholder="ex. passe en hybride orange à la prochaine rotation"
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="mt-1 text-xs text-chanv-terre/50">Jamais affichée sur le site.</p>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div>
            {fiche && (
              <button type="button" className="btn-secondary" onClick={remove} disabled={busy}>
                Supprimer la fiche
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Annuler
            </button>
            <button type="button" className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>

        {fiche?.updatedAt && (
          <p className="text-xs text-chanv-terre/40">
            Dernière modification&nbsp;: {new Date(fiche.updatedAt).toLocaleString("fr-CA")}
            {fiche.updatedBy ? ` par ${fiche.updatedBy}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
