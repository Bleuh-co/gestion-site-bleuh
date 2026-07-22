"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || !!pathname?.startsWith(href + "/");
}

export function NavBar() {
  const { embedded } = useGandalf();
  const { session } = useAuth();
  const pathname = usePathname();
  const t = useT();

  // Vrai framing : le flag `embedded` du SDK vient du cookie gandalf_embed
  // COLLANT → une visite embarquée contaminait ensuite le standalone (chrome
  // d'embed sans header/burger). On décide le chrome par le vrai cadrage iframe.
  const [framed, setFramed] = useState(embedded);
  useEffect(() => {
    setFramed(window.self !== window.top);
  }, []);

  if (!session) return null;

  const role = session.role;
  const isRead = role === "consultant" || role === "gestionnaire" || role === "admin" || role === "superadmin";
  const isWrite = role === "gestionnaire" || role === "admin" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";

  // Liens de navigation de l'app — « masqué ≠ perdu » : chaque lien du header
  // plein doit exister ici aussi (et dans la Sidebar).
  const links: { href: string; label: string; icon?: React.ReactNode; show: boolean }[] = [
    { href: "/produits", label: t("nav.produits"), show: isRead },
    { href: "/infolettre", label: t("nav.infolettre"), show: isRead },
    { href: "/outils", label: t("nav.outils"), show: isRead },
    { href: "/shop", label: t("nav.shop"), show: isRead },
    { href: "/assistant", label: t("nav.assistant"), show: isRead },
    // Masqué pour Bleuh — tableau de bord business (trafic/conversions) réservé à la
    // future app Maison d'Herbes (MDH). Code/page/routes conservés, dé-commenter pour réactiver.
    // { href: "/analyse-ceo", label: t("nav.analyseCeo"), show: isRead },
    { href: "/seo", label: t("nav.seo"), show: isRead },
    { href: "/audit", label: t("nav.audit"), show: isAdmin },
    { href: "/aide", label: t("nav.aide"), show: isRead },
  ];

  if (framed) {
    // Contrat d'embed Gandalf — nav interne d'embed (modèle Gestion-Parc-It /
    // XeroFacture) : barre claire sticky sur fond parchemin, pastilles blanches
    // arrondies, pastille active or. Le hub fournit logo/titre/profil.
    return (
      <nav id="gandalf-embed-nav" className="sticky top-0 z-40 flex flex-wrap items-center gap-1.5 bg-[#F4EFE3] px-4 pb-1 pt-3">
        {links
          .filter((l) => l.show)
          .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                isActive(pathname, l.href)
                  ? "border-[#A8863F] bg-[#A8863F] font-bold text-white"
                  : "border-black/10 bg-white text-black/60 hover:border-[#A8863F]/40 hover:text-[#282828]",
              )}
            >
              {l.icon}
              <span>{l.label}</span>
            </Link>
          ))}
      </nav>
    );
  }

  return (
    <header className="chanv-header">
      <div className="mx-auto max-w-6xl flex items-center gap-6 flex-wrap relative flex-col md:flex-row text-center md:text-left">
        <a
          href={process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"}
          className="chanv-logo-wrapper flex items-center"
          title={t("nav.backToHub")}
        >
          <Image
            src="/logo-groupe-chanv.svg"
            alt="Chanv"
            width={130}
            height={44}
            priority
            className="h-10 w-auto"
          />
        </a>
        <div>
          <h1 className="text-xl font-bold m-0 leading-tight">Marketing Bleuh</h1>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[3px] opacity-70 mt-1 m-0">
            {t("nav.subtitle")}
          </p>
        </div>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link key={l.href} href={l.href} className={cn("chanv-nav-link", isActive(pathname, l.href) && "active")}>
                {l.icon}
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            ))}
        </nav>

        <div className="flex items-center gap-3 md:ml-auto flex-shrink-0 absolute top-0 right-0 md:relative md:top-auto md:right-auto">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              {session.displayName || session.email}
            </div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider whitespace-nowrap">
              {t(`role.${session.role}`)}
            </div>
          </div>
          <Sidebar />
        </div>
      </div>
    </header>
  );
}
