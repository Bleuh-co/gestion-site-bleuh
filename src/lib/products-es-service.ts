import "server-only";
import { adminDb } from "./firebase-admin";
import { ValidationError } from "./products-service";
import {
  PRODUCTS_ES_COLLECTION,
  champsAPlat,
  lireProductEs,
  textesDepuisReponse,
  type ProductEs,
  type ProductEsTextes,
} from "./products-es-pure";

// Section espagnole des fiches produits — couche serveur. Le pourquoi de la
// collection à part est en tête de products-es-pure.ts.

export function productsEsCol() {
  return adminDb().collection(PRODUCTS_ES_COLLECTION);
}

export async function lireEspagnol(id: string): Promise<ProductEs | null> {
  const doc = await productsEsCol().doc(id).get();
  return doc.exists ? lireProductEs(doc.id, doc.data()) : null;
}

export async function ecrireEspagnol(
  id: string,
  textes: ProductEsTextes,
  source: ProductEsTextes,
  mode: "auto" | "manuel",
  par: string | null
): Promise<ProductEs> {
  const doc = { ...textes, source, mode, updatedAt: new Date().toISOString(), updatedBy: par };
  // set() TOTAL, exprès : ce document n'a qu'un seul rédacteur (cet écran), et
  // un champ vidé à la main doit vraiment se vider.
  await productsEsCol().doc(id).set(doc);
  return { id, ...doc };
}

/** Quand un produit est supprimé, sa section espagnole part avec lui. */
export async function supprimerEspagnol(id: string): Promise<void> {
  await productsEsCol().doc(id).delete();
}

/** Erreur de traduction que l'écran peut afficher telle quelle. */
export class TraductionIndisponible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraductionIndisponible";
  }
}

const CONSIGNE = `Tu traduis en espagnol les textes d'une fiche produit de Bleuh, producteur de cannabis du Québec, pour son site bleuh.co.

Règles :
- Espagnol neutre d'Amérique latine, tutoiement. Phrases courtes, le fait utile d'abord, ton sobre.
- Traduction fidèle : n'ajoute rien, ne retire rien, aucune promesse d'effet ni superlatif absent de la source. Garde les sauts de ligne.
- Tu reçois l'anglais (la source à traduire) et le français (l'original, pour lever une ambiguïté).
- Ne se traduisent pas : Bleuh et ses collections (Bleuh Light, Bleuh Clair, Bleuh Original, Bleuh Blanh, Grindh, Skyh, Blakh, Goldh), les noms de produits et de variétés, SQDC, OCS, THC, CBD, les chiffres et les unités.
- Lexique : strain → variedad ; dried flower → flor seca ; pre-rolls → prerrollos ; 510 cartridge → cartucho 510 ; hash → hachís ; live resin → resina viva ; terpenes → terpenos ; Indica / Sativa / Hybrid → Índica / Sativa / Híbrida ; batch, lot → lote ; rotation → rotación ; Québec → Quebec ; Canada → Canadá ; outdoor → al aire libre ; indoor → interior ; greenhouse → invernadero.
- Un nom de produit reste tel quel, sauf le mot de format ou de profil qu'il contient (« Pre-Rolls » → « Prerrollos », « Hybrid » → « Híbrida »).

Réponds par UN objet JSON et rien d'autre : les mêmes clés que l'objet « anglais » reçu, chaque valeur étant la traduction espagnole. N'ajoute aucune clé.`;

/**
 * Traduit les textes anglais d'une fiche. Ne lit ni n'écrit rien en base :
 * l'appelant décide quoi faire de la proposition.
 */
export async function traduireEnEspagnol(anglais: ProductEsTextes, francais: ProductEsTextes): Promise<ProductEsTextes> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new TraductionIndisponible("La traduction automatique n'est pas configurée sur ce service.");

  const garder = (t: ProductEsTextes) => Object.fromEntries(Object.entries(champsAPlat(t)).filter(([, v]) => v.trim()));
  const source = garder(anglais);
  if (Object.keys(source).length === 0) throw new ValidationError("La fiche n'a aucun texte anglais à traduire.");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: CONSIGNE,
      messages: [{ role: "user", content: JSON.stringify({ anglais: source, francais: garder(francais) }, null, 1) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new TraductionIndisponible("Le service de traduction est saturé. Réessayez dans une minute.");
    if (e instanceof Anthropic.APIError) {
      console.error("Traduction espagnole : erreur de l'API", e.status, e.message);
      throw new TraductionIndisponible("Le service de traduction n'a pas répondu. Réessayez.");
    }
    throw e;
  }

  // `stop_reason` est une chaîne ouverte : « refusal » n'est pas dans les
  // types de la version installée du SDK.
  const raison = response.stop_reason as string | null;
  if (raison === "refusal") throw new TraductionIndisponible("Le service de traduction a décliné ce texte. Traduisez-le à la main.");
  if (raison === "max_tokens") throw new TraductionIndisponible("Le texte est trop long pour être traduit d'un coup.");

  const texte = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const lu = textesDepuisReponse(texte, anglais);
  if (!lu.ok) throw new TraductionIndisponible(lu.error);
  return lu.value;
}
