import { requireRead } from "@/lib/auth-server";
import { DemandeAtterrissageClient } from "./DemandeAtterrissageClient";

export default async function DemandeAtterrissagePage() {
  const session = await requireRead().catch(() => null);
  const canWrite = !!session && (session.role === "gestionnaire" || session.role === "admin" || session.role === "superadmin");
  if (!session || !canWrite) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="card p-8 text-center text-gray-400">
          <p>{session ? "Accès refusé : lecture seule." : "Accès refusé."}</p>
        </div>
      </main>
    );
  }
  return <DemandeAtterrissageClient demandeurNom={session.displayName || session.email} />;
}
