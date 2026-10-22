import { requireRead } from "@/lib/auth-server";
import { FicheAtterrissageClient } from "./FicheAtterrissageClient";

export default async function FicheAtterrissagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }
  const { id } = await params;
  return <FicheAtterrissageClient id={id} role={session.role} />;
}
