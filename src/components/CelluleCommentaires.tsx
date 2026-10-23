"use client";

import { MessageSquare } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { EtatFil } from "@/lib/fils-pure";

/**
 * La cellule « Commentaires » d'un tableau (pages d'atterrissage) : le nombre
 * de messages de la discussion, « nouveau » quand un message est arrivé
 * depuis la dernière ouverture. Un clic ouvre le volet. Porté de Marketing MDH.
 */
export function CelluleCommentaires({ etat, onOuvrir }: { etat: EtatFil; onOuvrir: () => void }) {
  const t = useT();
  if (!etat.filId) return <span className="text-chanv-terre/40">—</span>;
  return (
    <button
      type="button"
      onClick={onOuvrir}
      title={t("fil.ouvrir")}
      aria-label={`${t("fil.ouvrir")} (${etat.compte})`}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-1 whitespace-nowrap hover:bg-chanv-fibre/60",
        etat.compte ? "text-chanv-terre" : "text-chanv-terre/45"
      )}
    >
      <MessageSquare size={14} aria-hidden="true" />
      <span className="font-medium tabular-nums">{etat.compte ? etat.compte : "—"}</span>
      {etat.nouveau && (
        <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-700">{t("fil.nouveau")}</span>
      )}
    </button>
  );
}
