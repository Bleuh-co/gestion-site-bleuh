import { NextRequest, NextResponse } from "next/server";
import { requireRead } from "@/lib/auth-server";
import { handleError } from "@/lib/products-service";
import { adminDb } from "@/lib/firebase-admin";
import { loadSubscribersFromGCS } from "@/lib/infolettre-storage";
import { INFOLETTRE_SNAPSHOTS_COLLECTION } from "@/lib/infolettre-snapshots";
import type {
  ExportFormat,
  Subscriber,
  SubscriberStatus,
} from "@/lib/infolettre-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// GET /api/infolettre/snapshots/[id]/export?format=csv|json&fields=&status=
// Exige un snapshot terminé (done), sinon 409. requireRead.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRead();
    const { id } = await ctx.params;
    const sp = req.nextUrl.searchParams;
    const format = (sp.get("format") || "csv") as ExportFormat;
    const selectedFields = (sp.get("fields") || "").split(",").filter(Boolean);
    const statusFilters = (sp.get("status") || "")
      .split(",")
      .filter(Boolean) as SubscriberStatus[];

    const doc = await adminDb().collection(INFOLETTRE_SNAPSHOTS_COLLECTION).doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Snapshot introuvable.", code: "not_found" },
        { status: 404 }
      );
    }
    const data = doc.data()!;
    if (data.status !== "done") {
      return NextResponse.json(
        { error: "Le snapshot n'est pas terminé.", code: "not_ready" },
        { status: 409 }
      );
    }

    let subscribers: Subscriber[] = await loadSubscribersFromGCS(id);
    if (statusFilters.length > 0) {
      subscribers = subscribers.filter((s) => statusFilters.includes(s.status));
    }

    const label = (data.label as string) || "snapshot";
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      return new Response(JSON.stringify(subscribers, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="snapshot-${label}-${dateStr}.json"`,
        },
      });
    }

    // CSV — colonnes email,status,groups + clés de champs dynamiques
    const allFieldKeys = new Set<string>();
    for (const sub of subscribers) {
      for (const key of Object.keys(sub.fields || {})) allFieldKeys.add(key);
    }
    const fieldKeys =
      selectedFields.length > 0
        ? selectedFields.filter((f) => allFieldKeys.has(f))
        : Array.from(allFieldKeys);

    const csvLines = [["email", "status", "groups", ...fieldKeys].join(",")];
    for (const sub of subscribers) {
      const row = [
        escapeCsv(sub.email || ""),
        escapeCsv(sub.status || ""),
        escapeCsv(Array.isArray(sub.groups) ? sub.groups.join("; ") : ""),
        ...fieldKeys.map((key) => escapeCsv(String(sub.fields?.[key] ?? ""))),
      ];
      csvLines.push(row.join(","));
    }

    const csvContent = "\uFEFF" + csvLines.join("\n"); // BOM pour Excel
    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="snapshot-${label}-${dateStr}.csv"`,
      },
    });
  } catch (error) {
    return handleError(error, "GET /api/infolettre/snapshots/[id]/export");
  }
}
