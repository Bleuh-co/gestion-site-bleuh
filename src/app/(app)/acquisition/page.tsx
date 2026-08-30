import { requireRead } from "@/lib/auth-server";
import { AcquisitionClient } from "./AcquisitionClient";

// Lecture pour tout rôle authentifié (consultant et plus) — aligné sur
// requireRead() de GET /api/acquisition. Aucune écriture dans ce module.
export default async function AcquisitionPage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Acquisition</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <AcquisitionClient />;
}
