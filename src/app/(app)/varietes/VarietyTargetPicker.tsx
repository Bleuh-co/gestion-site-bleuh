"use client";

import { useMemo, useState } from "react";
import type { Variety } from "@/lib/types";

interface VarietyTargetPickerProps {
  /** Lignes candidates — déjà filtrées par l'appelant (pas d'exclues, pas la source). */
  options: Variety[];
  /** Id retenu, ou "" tant que rien n'est choisi. */
  value: number | "";
  onChange: (id: number | "") => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Choix d'une variété EXISTANTE, par son id.
 *
 * Le champ texte ne sert qu'à réduire la liste : il n'est jamais une source
 * de valeur. La seule chose qu'on puisse remonter, c'est l'id d'une ligne
 * déjà présente dans le référentiel — taper « Blu Dream » ne crée rien et ne
 * sélectionne rien.
 *
 * C'est la contrainte centrale du module : une variété ne doit jamais
 * pouvoir naître d'une faute de frappe. Si un jour ce composant gagne un
 * repli « valeur libre », le référentiel perd sa raison d'être.
 */
export function VarietyTargetPicker({
  options,
  value,
  onChange,
  disabled,
  placeholder = "Filtrer la liste…",
}: VarietyTargetPickerProps) {
  const [filter, setFilter] = useState("");

  const normalized = filter
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  const visible = useMemo(() => {
    if (!normalized) return options;
    return options.filter((o) => {
      const hay = `${o.name} ${o.key} ${(o.absorbs || []).join(" ")}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return hay.includes(normalized);
    });
  }, [options, normalized]);

  // Si le filtre masque l'option retenue, on la garde affichée : sinon le
  // <select> montrerait une valeur qui n'est plus dans ses options et
  // paraîtrait vide alors que le choix, lui, tient toujours.
  const selected = value === "" ? null : options.find((o) => o.id === value) || null;
  const list = selected && !visible.some((o) => o.id === selected.id) ? [selected, ...visible] : visible;

  return (
    <div className="grid gap-2">
      <input
        className="input"
        placeholder={placeholder}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        disabled={disabled}
        aria-label="Filtrer les variétés proposées"
      />
      <select
        className="input"
        value={value === "" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        disabled={disabled}
        aria-label="Variété de destination"
      >
        <option value="">— choisir une variété —</option>
        {list.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.lotCount} lot{o.lotCount > 1 ? "s" : ""}
            {o.lastWrapDate ? `, ${o.lastWrapDate}` : ""}
            {/* Province dans le libellé : c'est souvent elle qui distingue
                deux variétés au nom presque identique. */}
            {(o.provinces || []).length ? `, ${(o.provinces || []).join("+").toUpperCase()}` : ""})
          </option>
        ))}
      </select>
      {normalized && visible.length === 0 && (
        <p className="text-xs text-chanv-terre/60">
          Aucune variété ne correspond. Le référentiel ne contient que des variétés réellement
          emballées — il n&apos;est pas possible d&apos;en saisir une nouvelle ici.
        </p>
      )}
    </div>
  );
}
