"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Product, Role } from "@/lib/types";
import { KNOWN_COLLECTIONS, PROVINCE_LABELS, STATUS_LABELS, statusBadgeClass } from "./constants";

interface ProduitsListClientProps {
  role: Role;
}

export function ProduitsListClient({ role }: ProduitsListClientProps) {
  const canWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [collection, setCollection] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (collection) params.set("collection", collection);
    if (province) params.set("province", province);
    if (status) params.set("status", status);
    if (qDebounced) params.set("q", qDebounced);

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/produits?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((data: Product[]) => {
        if (!cancelled) setProducts(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Impossible de charger les produits.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection, province, status, qDebounced]);

  const count = useMemo(() => products.length, [products]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-bold">Produits</h1>
        {canWrite && (
          <Link href="/produits/nouveau" className="btn-primary">
            + Nouveau produit
          </Link>
        )}
      </div>

      <div className="card p-4 mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Collection</label>
          <select className="input" value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="">Toutes</option>
            {KNOWN_COLLECTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Province</label>
          <select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(PROVINCE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Recherche</label>
          <input
            className="input"
            placeholder="Nom, slug, SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Chargement…</div>
      ) : count === 0 ? (
        <div className="card p-8 text-center text-gray-400">Aucun produit ne correspond aux filtres.</div>
      ) : (
        <>
          <p className="text-sm text-chanv-terre/60 mb-3">
            {count} produit{count > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/produits/${encodeURIComponent(p.id)}`}
                className="card p-4 flex gap-3 hover:shadow-lg transition-shadow"
              >
                <div className="w-16 h-16 rounded-lg bg-chanv-fibre flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {p.images?.main ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images.main} alt={p.name?.fr || ""} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-chanv-terre/40">Aucune image</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-sm truncate">{p.name?.fr || "(sans nom)"}</h2>
                    <span className={`badge ${statusBadgeClass(p.status)} whitespace-nowrap`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  <p className="text-xs text-chanv-terre/60 mt-1">{p.collection}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(p.provinces || []).map((pr) => (
                      <span key={pr} className="badge-neutral text-[10px]">
                        {PROVINCE_LABELS[pr] ?? pr}
                      </span>
                    ))}
                    {p.sku && <span className="badge-neutral text-[10px]">{p.sku}</span>}
                  </div>
                  {(p.weight || p.thc) && (
                    <p className="text-xs text-chanv-terre/40 mt-2">
                      {p.weight} {p.thc}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
