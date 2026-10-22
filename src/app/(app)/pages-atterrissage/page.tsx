import { requireRead } from "@/lib/auth-server";
import { PagesAtterrissageClient } from "./PagesAtterrissageClient";

export default async function PagesAtterrissagePage() {
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
  return <PagesAtterrissageClient role={session.role} />;
}
