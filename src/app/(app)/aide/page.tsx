import { requireRead } from "@/lib/auth-server";
import { AideClient } from "./AideClient";

export default async function AidePage() {
  const session = await requireRead().catch(() => null);
  if (!session) return <AideClient denied />;
  return <AideClient />;
}
