"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import { OutilsStatusCard } from "./OutilsStatusCard";
import { OutilsSyncCard } from "./OutilsSyncCard";
import { OutilsExportsCard } from "./OutilsExportsCard";
import { OutilsOverridesCard } from "./OutilsOverridesCard";
import { OutilsToolsCard } from "./OutilsToolsCard";
import { outilsFetch, type ResultBanner } from "./outils-types";

interface OutilsClientProps {
  role: Role;
}

// Console d'opérations — proxy /api/outils/* vers BleuhAPI /admin/*.
// Porté depuis Apps/Formulaire DB-Products-Master/public/operations.js.
// L'autorisation réelle est appliquée côté serveur (requireRead/requireWrite
// dans chaque route /api/outils/*) — ce gate ne fait qu'adapter l'affichage.
export function OutilsClient({ role }: OutilsClientProps) {
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [heartbeats, setHeartbeats] = useState<Record<string, unknown> | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<ResultBanner>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const data = await outilsFetch("/status");
      setHeartbeats((data && data.heartbeats) || {});
    } catch (e) {
      setHeartbeats({});
      setStatusError({ ok: false, message: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Outils</h1>
        <p className="text-sm text-chanv-terre/60">
          Console d&apos;opérations — statut des synchronisations, exports, overrides de lots et outils ponctuels
          (proxy admin BleuhAPI).
        </p>
      </div>

      <OutilsStatusCard heartbeats={heartbeats} loading={statusLoading} error={statusError} onRefresh={() => void loadStatus()} />

      {canWrite && <OutilsSyncCard heartbeats={heartbeats} onAfterRun={() => void loadStatus()} />}

      <OutilsExportsCard />

      <OutilsOverridesCard canWrite={canWrite} />

      {canWrite && <OutilsToolsCard />}
    </main>
  );
}
