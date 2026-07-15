import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { bleuhFetch, binaryHeaders, relayJson, outilsErrorResponse, EXPORT_EXTS, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";

// GET /api/outils/exports/rotations.:ext — download xlsx|csv|pdf (?province=ON).
// Porté depuis GET /exports/rotations.:ext de routes/operations.js.
//
// Express utilise un segment de route littéral "rotations.:ext" (paramètre
// dans un nom de fichier via un point). Next 15 ne supporte pas ce genre de
// segment de dossier de façon fiable ; on utilise donc un segment
// dynamique unique `[filename]` et on parse "rotations.xlsx" nous-mêmes
// (voir brief §2 — option recommandée).
export async function GET(req: NextRequest, ctx: { params: Promise<{ filename: string }> }) {
  try {
    await requireRead();
    const { filename } = await ctx.params;

    const dotIndex = filename.lastIndexOf(".");
    const base = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
    const ext = (dotIndex === -1 ? "" : filename.slice(dotIndex + 1)).toLowerCase();

    if (base !== "rotations" || !EXPORT_EXTS.includes(ext as (typeof EXPORT_EXTS)[number])) {
      return NextResponse.json(
        { success: false, message: `Format d'export invalide : ${filename}.` },
        { status: 400 }
      );
    }

    const province = req.nextUrl.searchParams.get("province");
    const qs = province ? `?province=${encodeURIComponent(province)}` : "";
    const upstream = await bleuhFetch(`/admin/exports/rotations.${ext}${qs}`, {
      timeout: TIMEOUTS.export,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return await relayJson(upstream);
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers: binaryHeaders(upstream) });
  } catch (error) {
    return outilsErrorResponse(error, "GET /api/outils/exports/[filename]");
  }
}
