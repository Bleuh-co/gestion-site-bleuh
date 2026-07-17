import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";
import { AuditClient } from "./AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  try {
    await requireAudit();
  } catch {
    return <AuditClient denied />;
  }
  const entries = await listAudit(200);
  return <AuditClient entries={entries} />;
}
