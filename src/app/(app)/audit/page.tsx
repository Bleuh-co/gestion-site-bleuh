import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  try {
    await requireAudit();
  } catch {
    return <main className="mx-auto max-w-5xl p-6"><p>Accès réservé aux administrateurs.</p></main>;
  }
  const entries = await listAudit(200);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold mb-4">Journal d'audit</h1>
      {entries.length === 0 ? (
        <p>Aucune action journalisée pour l'instant.</p>
      ) : (
        <div className="table-scroll">
          <table className="table-wide text-sm">
            <thead>
              <tr><th className="text-left">Date</th><th className="text-left">Acteur</th><th className="text-left">Rôle</th><th className="text-left">Action</th><th className="text-left">Cible</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.ts).toLocaleString("fr-CA")}</td>
                  <td>{e.actorEmail}</td>
                  <td>{e.actorRole}</td>
                  <td>{e.action}</td>
                  <td>{e.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
