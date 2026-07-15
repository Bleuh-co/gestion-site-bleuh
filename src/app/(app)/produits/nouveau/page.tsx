import { requireWrite } from "@/lib/auth-server";
import { NouveauProduitClient } from "./NouveauProduitClient";

export default async function NouveauProduitPage() {
  try {
    await requireWrite();
  } catch {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Nouveau produit</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Réservé aux gestionnaires.</p>
        </div>
      </main>
    );
  }

  return <NouveauProduitClient />;
}
