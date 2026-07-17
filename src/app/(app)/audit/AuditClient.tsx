"use client";

import type { AuditEntry } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";

export function AuditClient({
  denied = false,
  entries = [],
}: {
  denied?: boolean;
  entries?: AuditEntry[];
}) {
  const t = useT();
  const locale = useLocale();

  if (denied) {
    return (
      <div className="p-6">
        <p>{t("audit.accessDenied")}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">{t("audit.title")}</h1>
      {entries.length === 0 ? (
        <p>{t("audit.empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{t("audit.colDate")}</th>
              <th className="text-left">{t("audit.colActor")}</th>
              <th className="text-left">{t("audit.colRole")}</th>
              <th className="text-left">{t("audit.colAction")}</th>
              <th className="text-left">{t("audit.colTarget")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.ts).toLocaleString(locale)}</td>
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
