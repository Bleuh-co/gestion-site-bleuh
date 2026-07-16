import { requireRead } from "@/lib/auth-server";
import { InfolettreClient } from "./InfolettreClient";

export default async function InfolettrePage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Infolettre</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <InfolettreClient role={session.role} />;
}
