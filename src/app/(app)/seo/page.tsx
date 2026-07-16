import { requireRead } from "@/lib/auth-server";
import { SeoClient } from "./SeoClient";

// Lecture pour tout rôle authentifié (consultant et plus) — aligné sur
// requireRead() de GET /api/seo/report. Les actions d'écriture (scan, analyse
// IA) sont gardées côté serveur par requireWrite ; ici on masque juste les
// boutons pour les rôles sans écriture (la vraie barrière reste l'API).
export default async function SeoPage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Analyse SEO</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <SeoClient role={session.role} />;
}
