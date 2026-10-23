import type { OuvertureFil } from "./fils-pure";
import type { Bilingual, Visibilite } from "./atterrissages-pure";

/**
 * Ce que la discussion d'une page d'atterrissage Bleuh montre en tête du volet
 * (lot L10, porté du lot L3 de Marketing MDH) : où est la page, son état, ses
 * dates, sa zone, sa visibilité, et le chemin qui rouvre sa fiche depuis une
 * mention. Pas de ligne « Offre » : bleuh.co ne vend rien.
 *
 * Les libellés arrivent déjà traduits (langue du back-office) : ce module ne
 * fait que les ranger, pour qu'ils soient testés.
 */

export interface PagePourDiscussion {
  id: string;
  nom: string;
  adresse: Bilingual;
  visibilite: Visibilite;
  /** CONTRAT v2 §1 : la fiche n'est pas « En préparation » (aucune demande en cours) — voir `pageAjustable` (atterrissages-pure.ts). */
  ajustable: boolean;
}

export interface LibellesDiscussionPage {
  contexte: string; // « Page d'atterrissage »
  etat: string; // la pastille, déjà rédigée
  dates: { libelle: string; valeur: string };
  zone: { libelle: string; valeur: string };
  visibilite: { libelle: string; valeur: string };
  fiche: string; // « Ouvrir la fiche »
  /** « Voir sur la préprod » et l'adresse de la page sur la préprod de bleuh.co (écrans §3 du plan) ; absent sans préprod configurée. */
  preprod?: { libelle: string; url: string | null };
}

export function cheminFichePage(id: string): string {
  return `/pages-atterrissage/${encodeURIComponent(id)}`;
}

export function ouvertureFilPage(p: PagePourDiscussion, l: LibellesDiscussionPage): OuvertureFil {
  const chemin = cheminFichePage(p.id);
  return {
    espace: "pages",
    objet: p.id,
    titre: p.nom,
    chemin,
    ajustable: p.ajustable,
    resume: {
      contexte: `${l.contexte} · bleuh.co/fr/${p.adresse.fr}/`,
      etat: l.etat,
      lignes: [l.dates, l.zone, l.visibilite].filter((x) => x.valeur),
      liens: [{ libelle: l.fiche, chemin }, ...(l.preprod && l.preprod.url ? [{ libelle: l.preprod.libelle, url: l.preprod.url }] : [])],
    },
  };
}
