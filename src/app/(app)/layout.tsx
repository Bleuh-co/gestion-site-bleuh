import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { NavBar } from "@/components/NavBar";

// Pages authentifiées : rendu par requête (elles lisent la session via headers/cookies).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  return (
    <>
      <NavBar />
      <div className="chanv-surface mx-auto max-w-5xl px-4 pb-16">{children}</div>
    </>
  );
}
