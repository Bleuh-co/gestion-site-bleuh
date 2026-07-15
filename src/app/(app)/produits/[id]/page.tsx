import { requireRead } from "@/lib/auth-server";
import { ProduitDetailClient } from "./ProduitDetailClient";

export default async function ProduitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Détail du produit</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <ProduitDetailClient id={id} role={session.role} />;
}
