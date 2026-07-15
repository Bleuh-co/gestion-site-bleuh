import { NextResponse } from "next/server";
import { requireAudit } from "@/lib/auth-server";
import { listAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireAudit();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const entries = await listAudit(200);
  return NextResponse.json(entries);
}
