# SP #2 — RBAC 3-tiers + fondation audit — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Convertir le scaffold App Generator (rôles 2-tiers membre/admin) en RBAC 3-tiers (consultant/gestionnaire/admin) appliqué à toutes les routes + nav, et poser la fondation du journal d'audit — pour que l'app « Gestion Site Bleuh » soit déployable et sûre avant le remplissage des modules (SP #3-10).

**Architecture:** On garde le pipeline de résolution de rôle du template (`resolveRoleVerbose` : bootstrap → `user_app_roles` → legacy → deny-by-default) ; on change UNIQUEMENT le mapping grade→rôle et on ajoute 3 gardes (`requireRead/Write/Audit`). Les routes stubs existantes passent leurs gardes de `requireSession/requireAdmin` aux nouvelles gardes. Un module d'audit (`site_audit_log` + `recordAudit`) et une page `/audit` (admin) complètent.

**Tech Stack:** Next.js 15 (App Router, React), TypeScript, Firebase Admin (Firestore), SDK `@bleuh-co/gandalf-sdk-next`.

## Global Constraints

- Repo : `~/Desktop/Chanv/Apps/gestion-site-bleuh` (cloné). NE PAS toucher aux fichiers hors périmètre (les stubs métier restent des stubs — remplis en SP #3-10).
- **RBAC exact** (mapping grade Gandalf → rôle app) : `Consulter`→`consultant` (lecture), `Gestionnaire`→`gestionnaire` (écriture), `Administrateur`→`admin` (+audit), `Super Administrateur`→`superadmin`, tout autre / `Non visible`→`blocked` (deny-by-default conservé).
- **Gardes** : `requireRead` = rôle ∈ {consultant, gestionnaire, admin, superadmin} ; `requireWrite` = {gestionnaire, admin, superadmin} ; `requireAudit` = {admin, superadmin}. La garde serveur est la vraie barrière (l'UI masque en confort).
- **Pas de runner de test** dans le repo (Next.js, comme SiteBleuh — YAGNI, on n'en ajoute pas). Vérif = `npx tsc --noEmit` + `npx eslint` + `npm run build`.
- Aucun secret affiché. Ne pas committer de `.env`.
- Conserver le contrat deny-by-default (un grade inconnu ne donne AUCUN accès).

---

### Task 1: Modèle de rôle 3-tiers + gardes (types + auth-server)

**Files:**
- Modify: `src/lib/types.ts` (Role + ROLE_LABELS, lignes 1-13)
- Modify: `src/lib/auth-server.ts` (mapStandardRole lignes 34-47 ; requireAdmin lignes ~232-238 ; ajouter requireRead/requireWrite/requireAudit)

**Interfaces produites (consommées par Task 2/3) :**
- `type Role = "superadmin" | "admin" | "gestionnaire" | "consultant" | "blocked"`
- `requireRead(): Promise<SessionContext>` — non-blocked.
- `requireWrite(): Promise<SessionContext>` — gestionnaire/admin/superadmin.
- `requireAudit(): Promise<SessionContext>` — admin/superadmin.

- [ ] **Step 1: types.ts — Role + labels**

Remplacer les lignes 1-13 de `src/lib/types.ts` par :
```ts
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
```

- [ ] **Step 2: auth-server.ts — mapStandardRole 5 voies**

Remplacer le corps de `mapStandardRole` (lignes 34-47) par :
```ts
function mapStandardRole(grade: string): Role {
  switch (grade) {
    case "Super Administrateur":
      return "superadmin";
    case "Administrateur":
      return "admin";
    case "Gestionnaire":
      return "gestionnaire";
    case "Consulter":
      return "consultant";
    case "Non visible":
      return "blocked";
    default:
      return "blocked";
  }
}
```

- [ ] **Step 3: auth-server.ts — gardes 3 niveaux**

Remplacer la fonction `requireAdmin` (et son commentaire) par le bloc suivant (garder `requireSession` tel quel juste au-dessus) :
```ts
/** Lecture : tout rôle authentifié non bloqué (consultant et plus). */
export async function requireRead(): Promise<SessionContext> {
  return requireSession();
}

/** Écriture : gestionnaire, admin ou superadmin. */
export async function requireWrite(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "gestionnaire" && s.role !== "admin" && s.role !== "superadmin") {
    throw new Error("FORBIDDEN");
  }
  return s;
}

/** Journaux d'audit : admin ou superadmin uniquement. */
export async function requireAudit(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.role !== "admin" && s.role !== "superadmin") throw new Error("FORBIDDEN");
  return s;
}

/** @deprecated conservé pour compat — équivaut à requireAudit (admin+). */
export async function requireAdmin(): Promise<SessionContext> {
  return requireAudit();
}
```

- [ ] **Step 4: Vérifier types + lint**

Run: `cd ~/Desktop/Chanv/Apps/gestion-site-bleuh && npx tsc --noEmit && npx eslint src/lib/`
Expected: aucune erreur. (Si `tsc` signale `"membre"` référencé ailleurs, noter les fichiers — ils sont traités en Task 2.)

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/Chanv/Apps/gestion-site-bleuh
git add src/lib/types.ts src/lib/auth-server.ts
git commit -m "RBAC 3-tiers : rôles consultant/gestionnaire/admin + gardes requireRead/Write/Audit"
```

---

### Task 2: Appliquer les gardes aux routes + filtrer la nav par rôle

**Files:**
- Modify: `src/app/api/produits/route.ts`, `src/app/api/produits/[id]/route.ts`, `src/app/api/outils/route.ts`, `src/app/api/outils/[id]/route.ts`, `src/app/api/analyse-ceo/route.ts`, `src/app/api/assistant/chat/route.ts`, `src/app/api/assistant/sessions/route.ts`
- Modify: `src/components/Sidebar.tsx`, `src/components/NavBar.tsx`

**Interfaces consommées :** `requireRead/requireWrite/requireAudit` (Task 1).

- [ ] **Step 1: Routes — remplacer les gardes**

Dans CHAQUE route API ci-dessus :
- remplacer l'import `requireSession, requireAdmin` par `requireRead, requireWrite` (et `requireAudit` seulement si la route est admin) ;
- les handlers de **lecture** (`GET`) : `await requireSession()` → `await requireRead()` ;
- les handlers d'**écriture** (`POST`/`PATCH`/`PUT`/`DELETE`) : `await requireAdmin()` → `await requireWrite()`.
- **Exception `analyse-ceo`** : le `GET /api/analyse-ceo` passe de `requireAdmin()` à `await requireRead()` (l'analyse CEO est en lecture pour tous les rôles, cf. spec).

Exemple (`src/app/api/produits/route.ts`) — le résultat attendu :
```ts
import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import type { Product } from "@/lib/types";

export async function GET(_req: NextRequest) {
  await requireRead();
  const products: Product[] = [];
  return NextResponse.json(products);
}

export async function POST(_req: NextRequest) {
  await requireWrite();
  return NextResponse.json({ success: true });
}
```
Appliquer la même transformation (read→requireRead, write→requireWrite) à toutes les routes listées. Ne PAS toucher à la logique métier (stubs conservés).

- [ ] **Step 2: Sidebar — filtrage par rôle**

Dans `src/components/Sidebar.tsx`, remplacer la ligne 18 (`const isAdmin = ...`) par les 3 niveaux, et n'afficher l'entrée **Audit** que pour admin+ :
```ts
  const role = session?.role;
  const isRead = role === "consultant" || role === "gestionnaire" || role === "admin" || role === "superadmin";
  const isWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";
```
- Les entrées **Produits / Outils / Assistant / Analyse CEO** : visibles si `isRead`.
- Entrée **Audit** (nouvelle, href `/audit`) : visible seulement si `isAdmin`.
- (Si le composant conditionne des actions d'écriture — ex. bouton « Gérer » — les gater sur `isWrite`.)

- [ ] **Step 3: NavBar — même logique**

Dans `src/components/NavBar.tsx`, appliquer le même filtrage (entrées visibles si `isRead` ; Audit si `isAdmin`). Ajouter l'entrée Audit (href `/audit`, libellé « Audit »).

- [ ] **Step 4: Vérifier build complet**

Run: `cd ~/Desktop/Chanv/Apps/gestion-site-bleuh && npm run build`
Expected: build réussi (plus aucune référence à `"membre"` ; typecheck OK).

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/Chanv/Apps/gestion-site-bleuh
git add src/app/api src/components/Sidebar.tsx src/components/NavBar.tsx
git commit -m "Gardes 3-tiers sur les routes + nav filtrée par rôle (Audit admin-only)"
```

---

### Task 3: Fondation du journal d'audit

**Files:**
- Modify: `src/lib/types.ts` (ajouter `AuditEntry`)
- Create: `src/lib/audit.ts`
- Create: `src/app/api/audit/route.ts`
- Create: `src/app/(app)/audit/page.tsx`

**Interfaces consommées :** `requireAudit`, `requireWrite` (Task 1), `adminDb` (`src/lib/firebase-admin`), `SessionContext`.

- [ ] **Step 1: types.ts — AuditEntry**

Ajouter à la fin de `src/lib/types.ts` :
```ts
export interface AuditEntry {
  id: string;
  ts: number;            // epoch ms
  actorEmail: string;
  actorRole: Role;
  action: string;        // ex. "product.create"
  target: string;        // ex. "products/abc123"
  details?: Record<string, unknown>;
}
```

- [ ] **Step 2: lib/audit.ts — recordAudit + list**

`src/lib/audit.ts` :
```ts
import "server-only";
import { adminDb } from "./firebase-admin";
import type { SessionContext } from "./auth-server";
import type { AuditEntry } from "./types";

const COLL = "site_audit_log";

/** Journalise une action mutante (best effort — n'échoue jamais l'action métier). */
export async function recordAudit(
  actor: SessionContext,
  action: string,
  target: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await adminDb().collection(COLL).add({
      ts: Date.now(),
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      target,
      ...(details ? { details } : {}),
    });
  } catch (e) {
    console.warn("[audit] recordAudit failed", e);
  }
}

/** Liste paginée, plus récent d'abord. */
export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const snap = await adminDb().collection(COLL).orderBy("ts", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, "id">) }));
}
```
> Note : `SessionContext` doit exporter `role` et `email` (déjà le cas, cf. auth-server.ts). Si `SessionContext` n'est pas exporté, l'exporter.

- [ ] **Step 3: /api/audit — lecture réservée admin**

`src/app/api/audit/route.ts` :
```ts
import { NextResponse } from "next/server";
import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireAudit();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const entries = await listAudit(200);
  return NextResponse.json(entries);
}
```

- [ ] **Step 4: page /audit (admin)**

`src/app/(app)/audit/page.tsx` — page serveur qui exige l'audit et affiche la liste (table simple ; le style suit les autres pages) :
```tsx
import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  try {
    await requireAudit();
  } catch {
    return <div className="p-6"><p>Accès réservé aux administrateurs.</p></div>;
  }
  const entries = await listAudit(200);
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Journal d’audit</h1>
      {entries.length === 0 ? (
        <p>Aucune action journalisée pour l’instant.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr><th className="text-left">Date</th><th className="text-left">Acteur</th><th className="text-left">Rôle</th><th className="text-left">Action</th><th className="text-left">Cible</th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.ts).toLocaleString("fr-CA")}</td>
                <td>{e.actorEmail}</td>
                <td>{e.actorRole}</td>
                <td>{e.action}</td>
                <td>{e.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Vérifier build**

Run: `cd ~/Desktop/Chanv/Apps/gestion-site-bleuh && npm run build`
Expected: build réussi ; `/api/audit` en route dynamique ; `/audit` présente.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/Chanv/Apps/gestion-site-bleuh
git add src/lib/types.ts src/lib/audit.ts src/app/api/audit/route.ts "src/app/(app)/audit/page.tsx"
git commit -m "Fondation journal d'audit : site_audit_log + recordAudit + /api/audit + page /audit (admin)"
```

---

## Étapes INFRA (exécutées par le contrôleur, pas par subagents)

Après les 3 tâches code, revue finale de branche, puis :

- **I1. Enregistrement Gandalf** : créer `apps/{GESTIONSITEBLEUH_APP_ID}` dans Firestore des 2 projets (nom « Gestion Site Bleuh »), + `user_app_roles/{email}__{APP_ID}` = `Administrateur` pour t.matteucci@chanv.com. Copier la structure d'un doc `apps/*` existant.
- **I2. Secrets/env** : suivre le standard dev (Firebase antigravity, `FIREBASE_SERVICE_ACCOUNT_JSON` via secret du projet de déploiement, `GESTIONSITEBLEUH_APP_ID`, `NEXT_PUBLIC_*` d'un service dev existant). Répliquer depuis un service `-dev` déjà en place.
- **I3. Déployer DEV** (`gestion-site-bleuh-dev`, gandalf-dev, `--source`) → vérifier `/api/whoami` résout les 3 rôles ; `requireWrite` refuse un consultant (403) ; `/audit` refuse un gestionnaire.
- **I4. Déployer PROD** (`gestion-site-bleuh`, antigravity) une fois dev validé.
- **I5. Trigger dev** : réparer le lien repo→trigger (permission `cloudbuild.repositories.create`) pour le CD.
