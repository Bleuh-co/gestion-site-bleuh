"use client";

import { useEffect, useState } from "react";
import type { Role } from "@/lib/types";
import type { MailerLiteAccount, MLField, MLGroup } from "@/lib/infolettre-types";
import { SubscriberTable } from "./SubscriberTable";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { CampaignsPanel } from "./CampaignsPanel";
import { TrendsPanel } from "./TrendsPanel";

type Tab = "subscribers" | "groups" | "fields" | "snapshots" | "campaigns" | "trends";

const FIELD_TYPE_LABEL: Record<string, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
};

interface InfolettreClientProps {
  role: Role;
}

export function InfolettreClient({ role }: InfolettreClientProps) {
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [account, setAccount] = useState<MailerLiteAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("subscribers");

  useEffect(() => {
    fetch("/api/infolettre/account", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((a: MailerLiteAccount) => setAccount(a))
      .catch((e) => setAccountError(e.message || "Impossible de charger le compte."));
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "subscribers", label: "Abonnés" },
    { key: "groups", label: "Groupes" },
    { key: "fields", label: "Champs" },
    { key: "campaigns", label: "Campagnes" },
    { key: "trends", label: "Tendances" },
    { key: "snapshots", label: "Copies" },
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-bold">Infolettre</h1>
      </div>
      <p className="text-gray-500 mb-6">
        Explorez les abonnés du compte MailerLite Bleuh et créez des copies exportables.
      </p>

      {/* Carte compte */}
      {accountError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-6">
          {accountError}
        </div>
      ) : !account ? (
        <div className="card p-6 mb-6 text-gray-400">Chargement du compte…</div>
      ) : (
        <div className="section-card mb-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-3xl">✉️</div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{account.label}</h2>
                {account.configured ? (
                  <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
                    Configuré
                  </span>
                ) : (
                  <span className="inline-block rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
                    Non configuré
                  </span>
                )}
              </div>
              {account.configured ? (
                <>
                  <p className="text-sm text-chanv-terre/60 mt-1">
                    {account.subscriberCount?.toLocaleString("fr-CA") ?? "—"} abonnés · clé{" "}
                    <span className="font-mono">{account.apiKeyMasked}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-chanv-terre/60 mt-1">
                  La clé API MailerLite Bleuh n&apos;est pas encore renseignée. Les données ne
                  sont pas disponibles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      {account?.configured && (
        <>
          <div className="flex gap-1 border-b border-black/10 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? "border-chanv-terre text-chanv-terre"
                    : "border-transparent text-chanv-terre/50 hover:text-chanv-terre"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "subscribers" && (
            <SubscriberTable fetchUrl="/api/infolettre/subscribers" cursorMode />
          )}
          {tab === "groups" && <GroupsPanel />}
          {tab === "fields" && <FieldsPanel />}
          {tab === "campaigns" && <CampaignsPanel />}
          {tab === "trends" && <TrendsPanel canWrite={canWrite} />}
          {tab === "snapshots" && <SnapshotsPanel canWrite={canWrite} />}
        </>
      )}
    </main>
  );
}

function GroupsPanel() {
  const [groups, setGroups] = useState<MLGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/infolettre/groups", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((g: MLGroup[]) => setGroups(g))
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  if (!groups) return <div className="card p-8 text-center text-gray-400">Chargement…</div>;
  if (groups.length === 0)
    return <div className="card p-8 text-center text-gray-400">Aucun groupe.</div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.id} className="card p-4">
          <p className="font-semibold">{g.name}</p>
          <p className="text-sm text-chanv-terre/60 mt-1">
            {g.activeCount.toLocaleString("fr-CA")} actifs · {g.total.toLocaleString("fr-CA")} au
            total
          </p>
        </div>
      ))}
    </div>
  );
}

function FieldsPanel() {
  const [fields, setFields] = useState<MLField[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/infolettre/fields", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((f: MLField[]) => setFields(f))
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  if (!fields) return <div className="card p-8 text-center text-gray-400">Chargement…</div>;
  if (fields.length === 0)
    return <div className="card p-8 text-center text-gray-400">Aucun champ.</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-chanv-terre/60 border-b border-black/5">
            <th className="px-4 py-3 font-semibold">Nom</th>
            <th className="px-4 py-3 font-semibold">Clé</th>
            <th className="px-4 py-3 font-semibold">Type</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id} className="border-b border-black/5 last:border-0">
              <td className="px-4 py-3 font-medium">{f.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-chanv-terre/60">{f.key}</td>
              <td className="px-4 py-3">
                <span className="badge-neutral text-[11px]">
                  {FIELD_TYPE_LABEL[f.type] ?? f.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
