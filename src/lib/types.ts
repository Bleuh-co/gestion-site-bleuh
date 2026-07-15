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
  rotationVarieties: unknown[];
  relatedProducts: unknown[];
  sourceNotes: string | null;
  status: ProductStatus; // défaut "draft"
}

// ─────────────────────────────────────────────────────────────
// Outils internes
// ─────────────────────────────────────────────────────────────
export type ToolType = "url" | "internal" | "api";

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  href: string;
  icon: string; // emoji
  enabled: boolean;
  order: number;
  createdAt: string;
}

export interface ToolInput {
  name: string;
  description: string;
  type: ToolType;
  href: string;
  icon: string;
  enabled: boolean;
  order: number;
}

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
