import { requireRead } from "@/lib/auth-server";
import { ShopClient } from "./ShopClient";

export default async function ShopPage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-bold mb-6">Shop</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return <ShopClient role={session.role} />;
}
