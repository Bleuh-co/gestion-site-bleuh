"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { shopFetch, fmtMoney, fmtDate, type ShopOrder, type WooList } from "./shop-types";

interface ShopOrdersCardProps {
  canWrite: boolean;
}

const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded"] as const;

function statusLabelKey(status: string): string {
  // pending → shop.orderStatusPending ; on-hold → shop.orderStatusOnhold
  const clean = status.replace(/-/g, "");
  return `shop.orderStatus${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

// Onglet Commandes — table (n°, date, client, total, statut) + détail dépliable
// (articles, adresse, coupons) + select statut si canWrite.
// GET /api/shop/commandes ; PATCH /api/shop/commandes/[id].
export function ShopOrdersCard({ canWrite }: ShopOrdersCardProps) {
  const t = useT();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopFetch<WooList<ShopOrder>>("/commandes");
      setOrders(data.items);
    } catch (e) {
      setOrders([]);
      setError(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeStatus = async (id: number, status: string) => {
    setBusyId(id);
    try {
      await shopFetch(`/commandes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(t("shop.saved"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("shop.errorGeneric"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("shop.ordersTitle")}</h2>
        <button type="button" className="btn-secondary" onClick={() => void load()}>
          {t("shop.refresh")}
        </button>
      </div>

      {!canWrite && <p className="text-xs text-chanv-terre/50">{t("shop.readOnlyNotice")}</p>}
      {error && (
        <div className="card p-4 border-l-4 border-rose-400 bg-rose-50 text-rose-700 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-chanv-fibre">
              <th className="px-3 py-2">{t("shop.colOrder")}</th>
              <th className="px-3 py-2">{t("shop.colDate")}</th>
              <th className="px-3 py-2">{t("shop.colCustomer")}</th>
              <th className="px-3 py-2">{t("shop.colTotal")}</th>
              <th className="px-3 py-2">{t("shop.colStatus")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-chanv-fibre">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.loading")}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-chanv-terre/50">
                  {t("shop.empty")}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <FragmentRow
                  key={o.id}
                  order={o}
                  expanded={expanded === o.id}
                  onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
                  canWrite={canWrite}
                  busy={busyId === o.id}
                  onStatus={(s) => void changeStatus(o.id, s)}
                  t={t}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({
  order,
  expanded,
  onToggle,
  canWrite,
  busy,
  onStatus,
  t,
}: {
  order: ShopOrder;
  expanded: boolean;
  onToggle: () => void;
  canWrite: boolean;
  busy: boolean;
  onStatus: (status: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const customer =
    [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ") ||
    order.billing?.email ||
    "—";
  return (
    <>
      <tr>
        <td className="px-3 py-2 font-medium">{order.number}</td>
        <td className="px-3 py-2 text-chanv-terre/60">{fmtDate(order.date_created)}</td>
        <td className="px-3 py-2">{customer}</td>
        <td className="px-3 py-2">{fmtMoney(order.total, order.currency)}</td>
        <td className="px-3 py-2">
          {canWrite ? (
            <select
              className="input"
              value={order.status}
              disabled={busy}
              onChange={(e) => onStatus(e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(statusLabelKey(s))}
                </option>
              ))}
            </select>
          ) : (
            <span className="badge-neutral">{t(statusLabelKey(order.status))}</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" className="btn-ghost" onClick={onToggle}>
            {expanded ? t("shop.hideDetails") : t("shop.viewDetails")}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-3 py-3 bg-chanv-fibre/20">
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">{t("shop.orderItems")}</h4>
                <ul className="space-y-1">
                  {order.line_items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2">
                      <span className="text-chanv-terre/70">
                        {it.quantity} × {it.name}
                      </span>
                      <span>{fmtMoney(it.total, order.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1">{t("shop.orderShipping")}</h4>
                <address className="not-italic text-chanv-terre/70 leading-relaxed">
                  {[order.shipping?.first_name, order.shipping?.last_name].filter(Boolean).join(" ")}
                  <br />
                  {order.shipping?.address_1}
                  {order.shipping?.address_2 ? `, ${order.shipping.address_2}` : ""}
                  <br />
                  {[order.shipping?.city, order.shipping?.state, order.shipping?.postcode]
                    .filter(Boolean)
                    .join(", ")}
                  <br />
                  {order.shipping?.country}
                </address>
                {order.customer_note && (
                  <p className="mt-2 text-chanv-terre/60">
                    <span className="font-semibold">{t("shop.orderNote")} : </span>
                    {order.customer_note}
                  </p>
                )}
              </div>
              <div>
                <h4 className="font-semibold mb-1">{t("shop.orderCoupons")}</h4>
                {order.coupon_lines?.length ? (
                  <ul className="space-y-1">
                    {order.coupon_lines.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span className="text-chanv-terre/70">{c.code}</span>
                        <span>−{fmtMoney(c.discount, order.currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-chanv-terre/50">—</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
