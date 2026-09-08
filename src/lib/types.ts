// Rôle interne Gestion Site Bleuh (mappé depuis le grade Gandalf).
// - superadmin   : accès total
// - admin        : gestion complète + journaux d'audit
// - gestionnaire : lecture + création/édition/suppression, lancer les outils
// - consultant   : lecture seule
// - blocked      : pas d'accès
export type Role = "superadmin" | "admin" | "gestionnaire" | "consultant" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  gestionnaire: "Gestionnaire",
  consultant: "Consultant",
  blocked: "Bloqué",
};

// ─────────────────────────────────────────────────────────────
// Produits (catalogue web bleuh.co — collection Firestore `products`,
// id de doc = slug.fr. Porté depuis Formulaire DB-Products-Master
// routes/site-products.js — voir brief de portage.)
// ─────────────────────────────────────────────────────────────
export type ProductStatus = "draft" | "published" | "archived";
export type ProductStrain = "indica" | "sativa" | "hybrid";
export type ProductProvince = "qc" | "on";

export interface Localized {
  fr: string;
  en: string;
}

export interface LocalizedNullable {
  fr: string | null;
  en: string | null;
}

export interface ProductDetails {
  format: Localized;
  variety: Localized;
  effects: Localized;
  terpenes: Localized;
  growLocation: Localized;
  distribution: Localized;
}

export interface ProductImages {
  main: string;
  gallery: string[];
  aromaIcons?: string[]; // legacy WordPress, lecture seule
}

export interface ProductBadge {
  image: string;
  alt: string;
}

export interface StudioLink {
  studio_asset_id: string;
  linked_at: string;
  linked_by: string | null;
}

export interface ProductRelated {
  name: string;
  url: string;
  postId?: number;
  thc?: string | null;
  format?: string;
  image?: string;
}

/**
 * Une carte du bloc « Nos variétés en rotation » d'une fiche produit sur
 * bleuh.co (site-bleuh ProductDetailPage.tsx) : image, nom, catégorie
 * affichée en toutes lettres (« Hybride à dominance indica »), pastille THC,
 * badge « Nouvelle variété ».
 *
 * C'est un contenu ÉDITORIAL porté par le produit, distinct du référentiel
 * `Variety` (vue matérialisée des lots de l'ERP, non éditable) : `category`
 * est du texte libre, pas l'enum ProductStrain. Le storefront ne s'en sert
 * que pour choisir une couleur (`categoryColor` cherche « indica » ou
 * « sativa » dans la chaîne), il l'affiche tel quel.
 */
export interface ProductRotationVariety {
  name: string;
  url: string;
  category?: string;
  thc?: string | null;
  image?: string;
  badgeImage?: string | null;
  isNewVariety?: boolean;
}

export interface Product {
  id: string; // = slug.fr, injecté par docToProduct (doc.id)
  wpPostId: number | null;
  slug: Localized;
  url: LocalizedNullable | null;
  name: Localized;
  collection: string; // string libre, pas un enum strict côté validation
  brand: string | null;
  strain: ProductStrain;
  tags: string[];
  formatSlug: string;
  weight: string;
  thc: string;
  thcMin: number | null;
  thcMax: number | null;
  /** Pastille CBD, ex. "CBD 20-26%". Miroir du THC (cf. Gestion Produits). */
  cbd: string;
  cbdMin: number | null;
  cbdMax: number | null;
  provinces: ProductProvince[];
  isNew: boolean;
  isWebOnly: boolean;
  isComingSoon: boolean;
  currentRotation: LocalizedNullable | null;
  description: Localized;
  metaDescription: Localized;
  details: ProductDetails;
  images: ProductImages;
  badges: ProductBadge[];
  buyLink: LocalizedNullable | null;
  ocsLink: string | null;
  gtin: string | null;
  sku: string | null;
  rotationVarieties: ProductRotationVariety[];
  relatedProducts: ProductRelated[];
  sourceNotes: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  // legacy/enrichis, lecture seule (pas dans validateProductInput)
  categories?: string[];
  pills?: { fr: string[]; en: string[] };
  attributes?: { fr: Record<string, string | null>; en: Record<string, string | null> };
  studio_links?: Record<string, StudioLink>;
}

export interface ProductInput {
  wpPostId: number | null;
  slug: Localized; // dérivé de name si absent (slugify)
  url: LocalizedNullable | null;
  name: Localized; // requis : fr et en non vides
  collection: string; // requis, trim non vide
  brand: string | null;
  strain: ProductStrain; // défaut "hybrid"
  tags: string[];
  formatSlug: string;
  weight: string;
  thc: string;
  thcMin: number | null;
  thcMax: number | null;
  cbd: string;
  cbdMin: number | null;
  cbdMax: number | null;
  provinces: ProductProvince[]; // requis, ≥1
  isNew: boolean;
  isWebOnly: boolean;
  isComingSoon: boolean;
  currentRotation: LocalizedNullable | null;
  description: Localized;
  metaDescription: Localized;
  details: ProductDetails;
  images: ProductImages;
  badges: ProductBadge[];
  buyLink: LocalizedNullable | null;
  ocsLink: string | null;
  gtin: string | null; // /^\d{8,14}$/ si fourni
  sku: string | null; // ≤64 car., unicité vérifiée en base
  rotationVarieties: ProductRotationVariety[]; // normalisé, lignes sans nom écartées
  relatedProducts: unknown[];
  sourceNotes: string | null;
  status: ProductStatus; // défaut "draft"
}

/**
 * Sous-ensemble de ProductInput réellement piloté par le formulaire produit.
 *
 * Ces cinq clés n'ont AUCUN champ dans ProductForm. Tant qu'elles étaient
 * quand même émises (`badges: []`, `wpPostId: null`…), chaque enregistrement
 * les remettait à zéro : PATCH fusionne `{ ...doc.data(), ...body }`, et une
 * clé présente dans le body gagne toujours — même vide. Les omettre est ce
 * qui les préserve.
 *
 * Corollaire : toute clé retirée d'ici doit être retirée de buildInput, et
 * inversement. Si un jour le formulaire édite les badges, on sort "badges"
 * du Omit et on l'ajoute à buildInput — les deux ensemble, jamais l'un seul.
 *
 * `rotationVarieties` a suivi ce chemin (ticket 3Xk5sjItspoDLkitnGrM) : le
 * formulaire les édite désormais, donc la clé EST dans le type et EST émise
 * par buildInput. La protection ci-dessus ne s'applique plus à elle — c'est
 * la saisie de l'écran qui fait foi, y compris une liste vidée exprès.
 */
export type ProductFormInput = Omit<
  ProductInput,
  "wpPostId" | "url" | "currentRotation" | "badges" | "relatedProducts"
>;

// ─────────────────────────────────────────────────────────────
// Assistant IA
// ─────────────────────────────────────────────────────────────
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export type LLMModel =
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gemini-3.5-flash";

export interface ChatRequest {
  sessionId?: string;
  message: string;
  model?: LLMModel;
}

// ─────────────────────────────────────────────────────────────
// Analyse CEO
// ─────────────────────────────────────────────────────────────
export type MetricTrend = "up" | "down" | "flat";

export interface CeoMetric {
  id: string;
  label: string;
  value: number;
  unit: "count" | "currency" | "percent";
  trend: MetricTrend;
  changePct: number; // variation vs période précédente
}

export interface CeoInsight {
  id: string;
  title: string;
  summary: string; // texte généré par IA
  severity: "info" | "warning" | "critical";
  createdAt: string;
}

export interface CeoAnalysis {
  generatedAt: string;
  period: "7d" | "30d" | "90d";
  metrics: CeoMetric[];
  insights: CeoInsight[];
}

// ─────────────────────────────────────────────────────────────
// Erreurs API
// ─────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  code?: string;
}

// ─────────────────────────────────────────────────────────────
// Journaux d'audit
// ─────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  ts: number;            // epoch ms
  actorEmail: string;
  actorRole: Role;
  action: string;        // ex. "product.create"
  target: string;        // ex. "products/abc123"
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Référentiel des variétés (BleuhAPI /admin/varieties)
//
// Ce n'est PAS un CRUD : la liste est une vue matérialisée des lots réels
// de l'ERP, reconstruite par BleuhAPI. On ne crée jamais une variété ici —
// on ne fait que TRIER celles que l'ERP a produites (fusionner deux
// orthographes, écarter ce qui n'est pas une variété).
//
// Nommage : `Variety` et non `ProductVariety` — à ne pas confondre avec
// ProductDetails.variety (texte libre de la fiche produit) ni avec
// ProductRotationVariety (variété en rotation affichée sur le site).
// ─────────────────────────────────────────────────────────────

/** Motifs d'exclusion — liste FERMÉE, doit rester alignée sur
 *  VarietyReferential::EXCLUSION_KINDS côté BleuhAPI (qui rejette en 422
 *  toute valeur hors liste). */
export type VarietyExclusionKind = "product" | "junk" | "other";

export interface Variety {
  id: number;
  /** Clé canonique (minuscules, sans accent ni séparateur) — sert de join. */
  key: string;
  name: string;
  /** Nombre de lots, orthographes absorbées comprises. */
  lotCount: number;
  firstWrapDate: string | null;   // "AAAA-MM"
  lastWrapDate: string | null;    // "AAAA-MM"
  provinces: ProductProvince[];
  isActive: boolean;
  /** Noms des orthographes fusionnées dans celle-ci. */
  absorbs: string[];

  // Champs présents UNIQUEMENT quand la liste est demandée en mode curation
  // (?curation=1) — en mode normal, les lignes fusionnées/exclues sont
  // absentes de la réponse, donc ces champs n'ont pas lieu d'être.
  mergedIntoId?: number | null;
  mergedIntoName?: string | null;
  excludedAs?: VarietyExclusionKind | null;
  curationNote?: string | null;
  curatedAt?: string | null;
  isCurated?: boolean;
  mergedCount?: number;
}

export interface VarietySummary {
  /** Lignes brutes du référentiel (tri compris). */
  total: number;
  /** Ce que le sélecteur proposera réellement. */
  vocabulary: number;
  merged: number;
  excluded: number;
  /** Jamais passées en revue à la main. */
  uncurated: number;
}

export interface VarietyListResponse {
  success: boolean;
  count: number;
  data: Variety[];
  summary?: VarietySummary;
}

// ─────────────────────────────────────────────────────────────
// Fiche éditoriale d'une variété
//
// Troisième objet « variété », et le seul qu'un humain remplit librement :
//   - `Variety`                (ci-dessus) : ce que l'ERP a réellement
//     emballé. Non éditable, reconstruit depuis les lots.
//   - `ProductRotationVariety` (plus haut) : la carte telle qu'elle paraît
//     SUR UN PRODUIT donné. Éditable, mais elle n'existe qu'à partir du
//     moment où la variété est dans la rotation de ce produit.
//   - `VarietyEditorial`       (ici) : ce qu'on veut voir affiché pour cette
//     variété, indépendamment de tout produit et AVANT qu'elle n'entre en
//     rotation.
//
// La fiche est un jeu de valeurs par défaut, pas une vérité qui écrase : une
// carte de produit qui porte déjà sa propre valeur la garde. La fiche ne
// remplit que les cases restées vides. C'est ce qui permet de préparer une
// variété à l'avance sans réécrire l'historique des produits en ligne.
//
// La recopie a lieu DANS LE NAVIGATEUR, au moment où l'on finit de saisir le
// nom de la variété dans le formulaire produit — jamais à l'écriture côté
// serveur. Voir l'en-tête de lib/variety-editorials.ts : un héritage rejoué à
// chaque enregistrement ne saurait pas distinguer une case jamais remplie
// d'une case vidée exprès, et ferait revenir ce qu'on vient de retirer.
// Conséquence à connaître : une fiche créée APRÈS la mise en ligne d'un
// produit ne descend pas toute seule dans ses cartes.
// ─────────────────────────────────────────────────────────────

/** Champs saisissables d'une fiche éditoriale. */
export interface VarietyEditorialInput {
  /** Nom d'affichage, tel qu'écrit au référentiel. */
  name: string;
  /** Texte libre affiché sous le nom — c'est lui qui décide de la couleur. */
  category: string | null;
  thc: string | null;
  image: string | null;
  url: string | null;
  /** Mémo interne, jamais affiché au visiteur. */
  note: string | null;
}

export interface VarietyEditorial extends VarietyEditorialInput {
  /** Clé canonique = id du document (cf. lib/variety-key.ts). */
  key: string;
  /**
   * Clés des orthographes que le référentiel a fusionnées dans celle-ci.
   * Une carte de produit qui porte encore l'ancienne orthographe retrouve
   * la fiche par ce biais.
   */
  aliasKeys: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}
