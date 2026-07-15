import { requireRead } from "@/lib/auth-server";
import { AnalyseCeoClient } from "./AnalyseCeoClient";

// Lecture pour tout rôle authentifié (consultant et plus) — aligné sur
// requireRead() de la route API GET /api/analyse-ceo (aucune écriture dans
// ce module, donc pas de requireWrite/requireAdmin ici).
export default async function AnalyseCeoPage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Analyse CEO</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <AnalyseCeoClient />;
}
