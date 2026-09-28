import "server-only";
import type { VarietyExclusionKind } from "./types";

// ─────────────────────────────────────────────────────────────
// Référentiel des variétés — couche serveur.
//
// Le référentiel vit dans BleuhAPI (table `varieties`, vue matérialisée de
// wp_bleuh_lots). Ce module ne fait que valider ce qu'on lui relaie : il n'y
// a AUCUNE création de variété ici, et il ne doit jamais y en avoir.
//
// Pourquoi c'est une règle et pas un détail : le référentiel n'a de valeur
// que s'il ne contient QUE des variétés réellement emballées. Un champ de
// saisie libre quelque part dans la chaîne, et une faute de frappe crée une
// variété fantôme reliée à aucune rotation — exactement ce que ce module
// existe pour empêcher. Les seules écritures possibles sont donc :
//   - fusionner une orthographe dans une autre LIGNE EXISTANTE (par id) ;
//   - marquer une ligne « ce n'est pas une variété » ;
//   - y joindre une note.
// Aucune de ces trois opérations ne peut faire apparaître un nom nouveau.
// ─────────────────────────────────────────────────────────────

/** Doit rester aligné sur VarietyReferential::EXCLUSION_KINDS (BleuhAPI). */
export const VARIETY_EXCLUSION_KINDS: readonly VarietyExclusionKind[] = ["product", "junk", "other"];

/** Paramètres de lecture acceptés — tout le reste est ignoré, pas relayé. */
const ALLOWED_QUERY = ["curation", "active", "since", "q"] as const;

export class VarietyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VarietyValidationError";
  }
}

/**
 * Reconstruit la query string à relayer à BleuhAPI à partir de celle reçue.
 *
 * Liste blanche stricte : on ne relaie pas la query brute du client. Sans
 * ça, n'importe quel paramètre inventé traverserait le proxy jusqu'à l'API
 * admin, et la surface exposée deviendrait celle de BleuhAPI, pas celle
 * qu'on a décidé d'ouvrir ici.
 */
export function buildVarietiesQuery(input: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const key of ALLOWED_QUERY) {
    const value = input.get(key);
    if (value !== null && value !== "") out.set(key, value);
  }
  const qs = out.toString();
  return qs ? `?${qs}` : "";
}

/** Corps validé d'un PATCH de curation. */
export interface CurationPatch {
  mergedIntoId?: number | null;
  excludedAs?: VarietyExclusionKind | null;
  curationNote?: string | null;
}

/**
 * Valide le corps d'un PATCH de curation et ne retient que les clés
 * réellement envoyées.
 *
 * La distinction absent / null est porteuse de sens et doit survivre au
 * proxy : côté BleuhAPI, `update()` teste `$request->has()`, donc une clé
 * ABSENTE laisse le champ inchangé tandis qu'un `null` EXPLICITE l'efface
 * (défusionner, ré-inclure). Recopier bêtement `{...body}` ou remplir les
 * clés manquantes à null transformerait « je ne touche pas à l'exclusion »
 * en « je lève l'exclusion ».
 *
 * La validation ici ne remplace pas celle de BleuhAPI, qui revalide tout et
 * refuse en 422 : elle évite juste un aller-retour réseau pour rien et rend
 * le message d'erreur immédiat.
 */
export function validateCurationPatch(raw: unknown): CurationPatch {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new VarietyValidationError("Corps de requête invalide.");
  }
  const body = raw as Record<string, unknown>;
  const patch: CurationPatch = {};

  if ("mergedIntoId" in body) {
    const v = body.mergedIntoId;
    if (v === null) {
      patch.mergedIntoId = null;
    } else {
      // Number("") vaut 0 et Number(null) aussi : on refuse tout ce qui
      // n'est pas déjà un nombre ou une chaîne de chiffres, plutôt que de
      // laisser un id 0 partir vers l'API.
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
      if (!Number.isInteger(n) || n <= 0) {
        throw new VarietyValidationError("« mergedIntoId » doit être l'id d'une variété existante.");
      }
      patch.mergedIntoId = n;
    }
  }

  if ("excludedAs" in body) {
    const v = body.excludedAs;
    if (v === null || v === "") {
      patch.excludedAs = null;
    } else if (typeof v === "string" && VARIETY_EXCLUSION_KINDS.includes(v as VarietyExclusionKind)) {
      patch.excludedAs = v as VarietyExclusionKind;
    } else {
      throw new VarietyValidationError(
        `Motif d'exclusion inconnu. Attendu : ${VARIETY_EXCLUSION_KINDS.join(", ")}.`
      );
    }
  }

  if ("curationNote" in body) {
    const v = body.curationNote;
    if (v === null || v === "") {
      patch.curationNote = null;
    } else if (typeof v === "string") {
      patch.curationNote = v.trim().slice(0, 255);
    } else {
      throw new VarietyValidationError("« curationNote » doit être du texte.");
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new VarietyValidationError(
      "Rien à modifier — attendu au moins « mergedIntoId », « excludedAs » ou « curationNote »."
    );
  }

  return patch;
}

/**
 * Valide l'id de variété présent dans l'URL.
 *
 * La route BleuhAPI est contrainte par whereNumber, donc un id non numérique
 * y serait un 404 de routage ; on préfère un 400 explicite ici plutôt que de
 * faire un aller-retour pour récolter une page d'erreur.
 */
export function parseVarietyId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new VarietyValidationError("Identifiant de variété invalide.");
  }
  return n;
}
