"use client";

import { useEffect, useRef } from "react";
import { lienDiscussionHorsCoquille, lireMajFil, messageOuvertureFil, type OuvertureFil } from "./fils-pure";

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
