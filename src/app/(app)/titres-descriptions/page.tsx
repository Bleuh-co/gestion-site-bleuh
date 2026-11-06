import { requireRead } from "@/lib/auth-server";
import { TitresDescriptionsClient } from "./TitresDescriptionsClient";

export default async function TitresDescriptionsPage() {
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
  return <TitresDescriptionsClient role={session.role} />;
}
