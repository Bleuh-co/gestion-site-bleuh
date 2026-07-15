import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { bleuhFetch, binaryHeaders, relayJson, BleuhProxyError, TIMEOUTS } from "@/lib/bleuh-admin-proxy";

export const runtime = "nodejs";

// GET /api/outils/tools/metrogreen-csv — download CSV MetroGreen (SFTP).
// Porté depuis GET /tools/metrogreen-csv de routes/operations.js.
// Timeout court (30s) : tant que MetroGreen n'a pas whitelisté l'IP, on
// répond avec un message explicite plutôt qu'un timeout générique.
export async function GET(_req: NextRequest) {
  try {
    await requireRead();

    const upstream = await bleuhFetch("/admin/tools/metrogreen-csv", {
      timeout: TIMEOUTS.metrogreen,
      cache: "no-store",
    });

    if (!upstream.ok) {
      return await relayJson(upstream);
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers: binaryHeaders(upstream) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    console.error("GET /api/outils/tools/metrogreen-csv :", message);
    if (error instanceof Error && (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN")) {
      return NextResponse.json(
        { success: false, message: error.message === "UNAUTHORIZED" ? "Non authentifié." : "Accès refusé." },
        { status: error.message === "UNAUTHORIZED" ? 401 : 403 }
      );
    }
    const status = error instanceof BleuhProxyError && error.timeout ? 504 : 502;
    return NextResponse.json(
      { success: false, message: "MetroGreen non joignable (whitelist IP en attente)." },
      { status }
    );
  }
}
