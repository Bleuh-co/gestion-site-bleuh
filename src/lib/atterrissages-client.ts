"use client";

import { useCallback } from "react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { useT } from "./i18n";
import { dateLongue, type EtatPage, type Locale, type Zone } from "./atterrissages-pure";
import type { FicheAffichee } from "./atterrissages-store";

/**
 * Ce que la liste, la fiche et la demande des pages d'atterrissage partagent
 * côté navigateur (lot L10) : l'appel aux routes `/api/site/*`, et les
 * libellés d'état, de zone et de dates dans la langue du back-office.
 */

/** `fetch` vers `/api/site<chemin>` : le JSON, ou une erreur portant le message du serveur. */
export async function apiSite<T>(chemin: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/site${chemin}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers ?? {}) } : init?.headers,
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || j.success === false) {
    throw new Error(typeof j.message === "string" && j.message ? j.message : `Erreur ${res.status}`);
  }
  return j as T;
}

export const ETAT_CLS: Record<EtatPage, string> = {
  preparation: "bg-slate-100 text-slate-600",
  prete: "bg-sky-100 text-sky-700",
  programmee: "bg-amber-100 text-amber-800",
  "en-ligne": "bg-emerald-100 text-emerald-800",
  terminee: "bg-black/5 text-chanv-terre/60",
  eteinte: "bg-rose-100 text-rose-700",
};

/** Les libellés de la page dans la langue du back-office (le français sert aussi à l'espagnol pour les dates). */
export function useLibellesPage() {
  const t = useT();
  const { lang } = useGandalf();
  const locale: Locale = lang === "en" ? "en" : "fr";

  const etat = useCallback(
    (f: Pick<FicheAffichee, "etat" | "debut" | "fin">): string => {
      switch (f.etat) {
        case "preparation":
          return t("pa.etatPreparation");
        case "prete":
          return t("pa.etatPrete");
        case "programmee":
          return f.debut ? t("pa.etatProgrammeeDes", { date: dateLongue(f.debut, locale) }) : t("pa.etatProgrammee");
        case "en-ligne":
          return f.fin ? t("pa.etatEnLigneJusquau", { date: dateLongue(f.fin, locale) }) : t("pa.etatEnLigne");
        case "terminee":
          return f.fin ? t("pa.etatTermineeLe", { date: dateLongue(f.fin, locale) }) : t("pa.etatTerminee");
        case "eteinte":
          return t("pa.etatEteinte");
      }
    },
    [t, locale]
  );

  const zone = useCallback(
    (zones: readonly Zone[]): string =>
      zones.includes("qc") && zones.includes("ca") ? t("pa.zone.qcca") : zones.includes("qc") ? t("pa.zone.qc") : t("pa.zone.ca"),
    [t]
  );

  return { t, lang, locale, etat, zone };
}
