import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  try {
    await requireAudit();
  } catch {
    return <div className="p-6"><p>Accès réservé aux administrateurs.</p></div>;
  }
  const entries = await listAudit(200);
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Journal d'audit</h1>
      {entries.length === 0 ? (
        <p>Aucune action journalisée pour l'instant.</p>
      ) : (
        <table className="w-full text-sm">
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
      )}
    </div>
  );
}
