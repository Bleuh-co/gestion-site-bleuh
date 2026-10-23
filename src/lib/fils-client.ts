"use client";

import { useEffect, useRef, useState } from "react";
import { lienDiscussionHorsCoquille, lireFermetureFil, lireMajFil, messageOuvertureFil, type OuvertureFil } from "./fils-pure";

/**
 * Ouvrir la discussion d'une page ou d'une infolettre (voir fils-pure.ts).
 *
 * Dans GANDALF (l'app est l'iframe de la coquille) : on demande à la coquille
 * d'ouvrir son volet, à droite. Ouverte seule : la discussion s'ouvre dans un
 * onglet GANDALF — l'app ne sait pas rendre le volet, et ne doit pas.
 */

const HUB_URL = (process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");

function dansLaCoquille(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // parent d'une autre origine : on est bien dans un cadre
  }
}

export function ouvrirDiscussion(o: OuvertureFil, filId: string): void {
  if (!filId) return;
  if (dansLaCoquille()) {
    // '*' comme gandalf:app-ready : la coquille reconnaît l'app par l'iframe
    // émettrice (e.source), pas par l'origine ; rien de secret ne voyage.
    window.parent.postMessage(messageOuvertureFil(o), "*");
    return;
  }
  window.open(lienDiscussionHorsCoquille(HUB_URL, filId), "_blank", "noopener");
}

/** La coquille annonce un nouveau compte (message posté, supprimé, volet lu) : la cellule suit sans recharger. */
export function useMajFil(surMaj: (filId: string, compte: number) => void): void {
  const cb = useRef(surMaj);
  cb.current = surMaj;
  useEffect(() => {
    const ecoute = (ev: MessageEvent) => {
      if (ev.source !== window.parent || window.parent === window) return;
      const maj = lireMajFil(ev.data);
      if (maj) cb.current(maj.filId, maj.compte);
    };
    window.addEventListener("message", ecoute);
    return () => window.removeEventListener("message", ecoute);
  }, []);
}

/**
 * La rangée active d'une liste (CONTRAT v2 §2) : `marquer(filId)` au clic
 * (pose la rangée active tout de suite, avant toute confirmation) ; la
 * coquille confirme par `gandalf:fil-maj` avec `ouvert:true`, ou efface par
 * `gandalf:fil-ferme`. Une seule valeur : une seule rangée à la fois, même
 * quand plusieurs tableaux (brouillons, envoyées) partagent le même état.
 */
export function useFilActif(): { filActif: string | null; marquer: (filId: string) => void } {
  const [filActif, setFilActif] = useState<string | null>(null);
  useEffect(() => {
    const ecoute = (ev: MessageEvent) => {
      if (ev.source !== window.parent || window.parent === window) return;
      const maj = lireMajFil(ev.data);
      if (maj) {
        if (maj.ouvert) setFilActif(maj.filId);
        return;
      }
      const fermeture = lireFermetureFil(ev.data);
      if (fermeture) setFilActif((cur) => (cur === fermeture.filId ? null : cur));
    };
    window.addEventListener("message", ecoute);
    return () => window.removeEventListener("message", ecoute);
  }, []);
  return { filActif, marquer: setFilActif };
}
