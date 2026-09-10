import { requireRead } from "@/lib/auth-server";
import { GscClient } from "./GscClient";

export const dynamic = "force-dynamic";

/**
 * Performance Google (Search Console) — données RÉELLES archivées chaque nuit
 * dans Firestore par POST /api/gsc/sync. Double barrière : requireRead ici ET
 * dans la route API que le client consomme.
 */
export default async function GscPage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }
  return <GscClient role={session.role} />;
}
