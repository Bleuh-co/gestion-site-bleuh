/**
 * Clé canonique d'une variété.
 *
 * Elle sert de join entre les trois endroits où le même nom est écrit
 * différemment : le référentiel de l'ERP (« HEADSTASH »), la carte d'un
 * produit (« Head Stash ») et la fiche éditoriale saisie à la main. On replie
 * donc tout sur des minuscules sans accent ni séparateur.
 *
 * C'est la règle décrite par `Variety.key` côté BleuhAPI, mais on la
 * RECALCULE toujours à partir du nom au lieu de relayer la clé amont : une
 * fiche doit se retrouver aussi bien depuis l'écran Variétés (qui connaît la
 * clé du référentiel) que depuis une carte « variétés en rotation » d'un
 * produit, qui n'a jamais eu que le nom sous les yeux. Faire confiance à la
 * clé amont rendrait la fiche invisible du second côté.
 *
 * Le résultat ne contient que [a-z0-9] : il est utilisable tel quel comme id
 * de document Firestore (jamais vide côté appelant — un nom qui se réduit à
 * la chaîne vide est refusé à la validation).
 */
export function varietyKey(name: unknown): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
