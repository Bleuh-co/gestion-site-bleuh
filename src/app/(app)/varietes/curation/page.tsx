import { requireWrite } from "@/lib/auth-server";
import { CurationClient } from "./CurationClient";

// Écran de tri du référentiel — réservé à l'écriture (gestionnaire et plus).
// La lecture seule n'a rien à y faire : tout ici est une action.
export default async function VarietesCurationPage() {
  const session = await requireWrite().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Trier le référentiel</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé — cet écran demande les droits d&apos;écriture.</p>
        </div>
      </main>
    );
  }

  return <CurationClient />;
}
