// Rôle interne Gestion Site Bleuh (mappé depuis le rôle standardisé Chanv)
// - superadmin : accès total
// - admin      : gestion complète
// - membre     : consultation
// - blocked    : pas d'accès
export type Role = "superadmin" | "admin" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  membre: "Membre",
  blocked: "Bloqué",
};

// ─────────────────────────────────────────────────────────────
// Produits
// ─────────────────────────────────────────────────────────────
export type ProductStatus = "draft" | "published" | "archived";
export type ProductCategory =
  | "textile"
  | "accessoire"
  | "cosmetique"
  | "alimentaire"
  | "autre";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductCategory;
  status: ProductStatus;
  price: number; // en cents
  currency: "CAD" | "USD" | "EUR";
  stock: number;
  imageUrl?: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdBy: string; // uid
}

export interface ProductInput {
  name: string;
  description: string;
  category: ProductCategory;
  status: ProductStatus;
  price: number;
  currency: "CAD" | "USD" | "EUR";
  stock: number;
  imageUrl?: string;
  tags: string[];
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
