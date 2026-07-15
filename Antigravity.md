# Plan Architectural — 🚀 Gestion Site Bleuh

## 1. Résumé

Application interne d'administration du site Bleuh permettant de gérer le catalogue de **produits**, un répertoire d'**outils internes**, un **assistant IA** conversationnel pour épauler les équipes, et un tableau de bord d'**analyse CEO** synthétisant les métriques clés avec des insights générés par IA. Destinée aux équipes produit et à la direction du Groupe Chanv, elle centralise l'administration opérationnelle et la prise de décision stratégique.

---

## 2. Pages (détaillé)

### `/produits` — Liste des produits (rôle : membre)
- **Composants** : `ProductTable`, `ProductFilters`, `EmptyState`
- **Interactions** :
  - Filtres par statut, catégorie, recherche texte (debounce 300ms)
  - Clic ligne → navigation `/produits/[id]`
  - Bouton "Nouveau produit" (visible si `admin`) → `/produits/nouveau`
  - Badge de statut coloré par ligne
- **États** :
  - Loading : squelette de table (5 lignes grises)
  - Erreur : bandeau `.badge-warning` + bouton "Réessayer"
  - Vide : `EmptyState` avec message et CTA création (si admin)

### `/produits/nouveau` — Création (rôle : admin)
- **Composants** : `ProductForm`
- **Interactions** :
  - Formulaire validé côté client, submit → `POST /api/produits`
  - Succès → redirect `/produits/[id]`
  - Annuler → retour `/produits`
- **États** : loading (bouton disabled + spinner), erreur (message sous champ concerné)

### `/produits/[id]` — Détail / édition (rôle : membre lecture, admin écriture)
- **Composants** : `ProductForm` (mode édition), `DeleteConfirm`
- **Interactions** :
  - Mode lecture par défaut pour `membre` (champs disabled)
  - `admin` : bouton "Modifier" active l'édition, submit → `PATCH`
  - Bouton "Supprimer" (admin) → modale de confirmation → `DELETE` → redirect `/produits`
- **États** : loading (skeleton form), erreur 404 (page "Produit introuvable"), vide N/A

### `/outils` — Catalogue d'outils (rôle : membre)
- **Composants** : `ToolGrid`, `ToolCard`
- **Interactions** :
  - Grille de cartes cliquables, ouvre `href` (nouvel onglet si `type=url`)
  - Lien "Gérer les outils" (admin) → `/outils/gestion`
- **États** : loading (grille de cartes skeleton), vide (message), erreur (bandeau)

### `/outils/gestion` — CRUD outils (rôle : admin)
- **Composants** : `ToolTable`, `ToolForm` (modale), `DeleteConfirm`
- **Interactions** :
  - Ajouter / éditer via modale, toggle `enabled`, réordonner via champ `order`
  - CRUD → `POST/PATCH/DELETE /api/outils`
- **États** : loading, erreur, vide

### `/assistant` — Assistant IA (rôle : membre)
- **Composants** : `ChatWindow`, `ChatMessageList`, `ChatInput`, `SessionSidebar`, `ModelSelector`
- **Interactions** :
  - Saisie message → `POST /api/assistant/chat` (streaming ou réponse complète)
  - Sélecteur de modèle (défaut `claude-sonnet-4-6`)
  - Sidebar des sessions passées, clic pour recharger
  - Nouvelle conversation
- **États** :
  - Loading : bulle "assistant écrit…" animée
  - Erreur : message assistant en `.badge-warning` + retry
  - Vide : écran d'accueil avec suggestions de prompts

### `/analyse-ceo` — Tableau de bord (rôle : admin)
- **Composants** : `PeriodSelector`, `MetricCard`, `MetricTrendChart`, `InsightCard`, `GenerateButton`
- **Interactions** :
  - Sélecteur de période (7d/30d/90d) → recharge `GET /api/analyse-ceo`
  - Bouton "Générer analyse IA" → régénère les insights
  - Cartes métriques avec flèche de tendance
- **États** : loading (skeleton cards), erreur, vide (aucune donnée → CTA génération)

---

## 3. Composants métier

### `ProductTable.tsx`
- **Props** : `{ products: Product[]; onRowClick: (id: string) => void; }`
- **Comportement** : table responsive, colonnes nom/catégorie/statut/prix/stock, badge de statut coloré, prix formaté (Intl.NumberFormat selon currency)
- **CSS** : `.section-card`, `.badge-accent`, `.badge-neutral`, `.badge-warning`

### `ProductFilters.tsx`
- **Props** : `{ filters: { status?: ProductStatus; category?: ProductCategory; search: string }; onChange: (f) => void; }`
- **Comportement** : selects + input recherche débouncé, réinitialisation
- **CSS** : `.input`, `.label`, `.btn-ghost`

### `ProductForm.tsx`
- **Props** : `{ initial?: Product; mode: "create" | "edit" | "view"; onSubmit: (data: ProductInput) => Promise<void>; }`
- **Comportement** : validation (nom requis, prix ≥ 0, stock ≥ 0), génération slug auto depuis nom, champs disabled en mode `view`
- **CSS** : `.card`, `.input`, `.label`, `.btn-primary`, `.btn-secondary`

### `ToolCard.tsx`
- **Props** : `{ tool: Tool; }`
- **Comportement** : carte cliquable, icône emoji, badge si désactivé, ouvre href
- **CSS** : `.card`, `.badge-neutral`

### `ToolForm.tsx`
- **Props** : `{ initial?: Tool; onSubmit: (data: ToolInput) => Promise<void>; onClose: () => void; }`
- **Comportement** : modale, validation href (URL valide si type=url), toggle enabled
- **CSS** : `.card`, `.input`, `.label`, `.btn-primary`, `.btn-ghost`

### `ChatWindow.tsx`
- **Props** : `{ session: ChatSession | null; onSend: (msg: string, model: LLMModel) => void; loading: boolean; }`
- **Comportement** : affiche messages, auto-scroll bas, bulles distinctes user/assistant
- **CSS** : `.card`, `.section-card`

### `ChatInput.tsx`
- **Props** : `{ onSend: (msg: string) => void; disabled: boolean; }`
- **Comportement** : textarea auto-resize, Entrée = envoyer, Shift+Entrée = nouvelle ligne
- **CSS** : `.input`, `.btn-primary`

### `MetricCard.tsx`
- **Props** : `{ metric: CeoMetric; }`
- **Comportement** : valeur formatée selon unit, flèche ↑↓→ colorée selon trend, changePct
- **CSS** : `.card`, `.badge-accent`, `.badge-warning`

### `MetricTrendChart.tsx`
- **Props** : `{ metric: CeoMetric; series?: number[]; }`
- **Comportement** : sparkline SVG natif (pas de lib externe)
- **CSS** : `.section-card`

### `InsightCard.tsx`
- **Props** : `{ insight: CeoInsight; }`
- **Comportement** : titre + résumé IA, badge de sévérité coloré
- **CSS** : `.card`, `.badge-neutral`, `.badge-warning`

### `EmptyState.tsx` / `DeleteConfirm.tsx`
- Composants génériques réutilisables (message + CTA / modale de confirmation).

---

## 4. Routes API (détaillé)

Toutes les routes vérifient le rôle via le contexte Gandalf (`getAuthContext`). Deny-by-default : `blocked` → 403.

### `GET /api/produits` (membre)
- **Query** : `status?`, `category?`, `search?`
- **Output** : `Product[]`
- **Firestore** : collection `products`, `where` conditionnels sur status/category, tri `updatedAt desc`. Filtre `search` en mémoire (contains sur name/tags) si présent.
- **Erreurs** : 403 si blocked

### `POST /api/produits` (admin)
- **Body** : `ProductInput`
- **Output** : `Product` (201)
- **Validation** : name non vide, price ≥ 0, stock ≥ 0, category ∈ enum
- **Firestore** : `add` avec `createdAt/updatedAt/createdBy`, slug généré
- **Erreurs** : 400 validation, 403 non-admin

### `GET /api/produits/[id]` (membre)
- **Output** : `Product`
- **Erreurs** : 404 introuvable, 403

### `PATCH /api/produits/[id]` (admin)
- **Body** : `Partial<ProductInput>`
- **Output** : `Product`
- **Firestore** : `update` + `updatedAt`
- **Erreurs** : 400, 404, 403

### `DELETE /api/produits/[id]` (admin)
- **Output** : `{ success: true }`
- **Erreurs** : 404, 403

### `GET /api/outils` (membre)
- **Output** : `Tool[]` triés par `order`, seulement `enabled` pour membre non-admin
- **Firestore** : collection `tools`, `orderBy order asc`

### `POST /api/outils` (admin) — Body `ToolInput` → `Tool`
### `PATCH /api/outils/[id]` (admin) — Body `Partial<ToolInput>` → `Tool`
### `DELETE /api/outils/[id]` (admin) — `{ success: true }`

### `POST /api/assistant/chat` (membre)
- **Body** : `ChatRequest` (`{ sessionId?, message, model? }`)
- **Output** : `{ sessionId: string; reply: ChatMessage }`
- **Logique** :
  - Si `sessionId` absent → créer session dans `chat_sessions` (ownerUid)
  - Append message user, appel Anthropic SDK avec `model` (défaut `claude-sonnet-4-6`, whitelist stricte), append réponse assistant
  - Sauver session mise à jour
- **Validation** : message non vide (≤ 8000 chars), model ∈ whitelist
- **Erreurs** : 400, 403, 502 (échec LLM), 403 si session appartient à un autre uid

### `GET /api/assistant/sessions` (membre)
- **Output** : `ChatSession[]` (sessions de l'uid courant, tri `updatedAt desc`)
- **Firestore** : `where ownerUid == uid`

### `GET /api/analyse-ceo` (admin)
- **Query** : `period` (7d/30d/90d, défaut 30d), `regenerate?=true`
- **Output** : `CeoAnalysis`
- **Logique** :
  - Agrège les métriques depuis `products` (nb produits publiés, valeur stock totale, répartition catégories, % archivés)
  - Si `regenerate` → appel LLM (`claude-sonnet-4-6`) pour générer `insights` à partir des métriques, cache dans `ceo_analyses`
  - Sinon lit le dernier cache pour la période
- **Erreurs** : 403, 502 (LLM)

---

## 5. Structure de données

### Collection `products`
```
{ name, slug, description, category, status, price, currency,
  stock, imageUrl?, tags[], createdAt, updatedAt, createdBy }
```
- **Index** : `(status, updatedAt desc)`, `(category, updatedAt desc)`

### Collection `tools`
```
{ name, description, type, href, icon, enabled, order, createdAt }
```
- **Index** : `(enabled, order asc)`

### Collection `chat_sessions`
```
{ title, ownerUid, messages: ChatMessage[], createdAt, updatedAt }
```
- **Index** : `(ownerUid, updatedAt desc)`
- Messages stockés inline (limite raisonnable ~100 msgs/session ; au-delà, tronquer le contexte envoyé au LLM)

### Collection `ceo_analyses`
```
{ period, generatedAt, metrics: CeoMetric[], insights: CeoInsight[] }
```
- **Index** : `(period, generatedAt desc)`

### Relations
- `products.createdBy` → uid Firebase
- `chat_sessions.ownerUid` → uid Firebase (isolation par utilisateur, obligatoire)
- `ceo_analyses` dérive de `products` (agrégation, pas de FK dure)

---

## 6. Dépendances npm

| Package | Raison |
|---|---|
| `@anthropic-ai/sdk` | Appels LLM pour l'assistant IA et la génération d'insights CEO (modèles `claude-sonnet-4-6`, `claude-haiku-4-5`) |

Graphiques (sparklines) réalisés en **SVG natif** — pas de dépendance graphique. Formatage prix/dates via `Intl` natif. Clé API Anthropic via variable d'environnement serveur (`ANTHROPIC_API_KEY`), jamais exposée côté client.

---

## 7. Notes techniques

- **Sécurité LLM** : whitelist stricte des modèles côté serveur. Ne jamais accepter un modèle arbitraire depuis le client. Prompt système fixe pour l'assistant (contexte Site Bleuh) et pour l'analyse CEO (format d'insights imposé).
- **Isolation des sessions chat** : toujours filtrer par `ownerUid` — un membre ne doit jamais voir la session d'un autre. Vérifier l'ownership sur chaque `POST /chat` avec `sessionId`.
- **Performance liste produits** : le filtre `search` en mémoire suffit pour un catalogue < 500 items ; au-delà, envisager Algolia/Typesense (hors scope initial).
- **Coût LLM analyse CEO** : mettre en cache par période, ne régénérer que sur action explicite (`regenerate=true`) pour éviter appels répétés.
- **Accessibilité** : formulaires avec `label` liés (`htmlFor`), messages d'erreur en `aria-live`, table navigable au clavier, contraste géré par le design system (mode sombre inclus).
- **Streaming chat** : v1 en réponse complète (plus simple) ; le streaming SSE pourra être ajouté ultérieurement sans changer le contrat de types.
- **Edge cases** : produit sans image → placeholder ; suppression d'un produit référencé dans une analyse CEO → l'analyse reste un snapshot immuable (pas de cascade) ; slug collision → suffixe incrémental.
- **i18n** : toutes les chaînes visibles via `t("clé")` (FR/EN/ES), y compris les labels de statut et catégories (mapping enum → clé de traduction).