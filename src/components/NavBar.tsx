"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Compass,
  ExternalLink,
  Leaf,
  LineChart,
  Mail,
  Menu,
  Package,
  PanelsTopLeft,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

type NavIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  show: boolean;
}

interface NavSection {
  label: string;
  icon: NavIcon;
  items: NavItem[];
}

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || !!pathname?.startsWith(href + "/");
}

export function NavBar() {
  const { session } = useAuth();
  const pathname = usePathname();
  const t = useT();
  const [navOpen, setNavOpen] = useState(false);

  const role = session?.role;
  const isRead = role === "consultant" || role === "gestionnaire" || role === "admin" || role === "superadmin";
  const isAdmin = role === "admin" || role === "superadmin";

  const sections = useMemo<NavSection[]>(
    () => [
      {
        label: t("nav.sectionCatalogue"),
        icon: PanelsTopLeft,
        items: [
          { href: "/produits", label: t("nav.produits"), icon: Package, show: isRead },
          { href: "/varietes", label: t("nav.varietes"), icon: Leaf, show: isRead },
        ],
      },
      {
        label: t("nav.sectionMarketing"),
        icon: TrendingUp,
        items: [
          { href: "/infolettre", label: t("nav.infolettre"), icon: Mail, show: isRead },
          { href: "/acquisition", label: t("nav.acquisition"), icon: Compass, show: isRead },
          { href: "/seo", label: t("nav.seo"), icon: Search, show: isRead },
          { href: "/gsc", label: t("nav.gsc"), icon: LineChart, show: isRead },
        ],
      },
      {
        label: t("nav.sectionTools"),
        icon: Settings2,
        items: [
          { href: "/outils", label: t("nav.outils"), icon: Wrench, show: isRead },
          { href: "/assistant", label: t("nav.assistant"), icon: Bot, show: isRead },
        ],
      },
      {
        label: t("nav.sectionSystem"),
        icon: ShieldCheck,
        items: [
          { href: "/audit", label: t("nav.audit"), icon: ClipboardList, show: isAdmin },
          { href: "/aide", label: t("nav.aide"), icon: CircleHelp, show: isRead },
        ],
      },
    ],
    [isAdmin, isRead, t],
  );

  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.show) }))
    .filter((section) => section.items.length > 0);
  const activeItem = visibleSections.flatMap((section) => section.items).find((item) => isActive(pathname, item.href));
  const activeSection = visibleSections.find((section) => section.items.some((item) => isActive(pathname, item.href)));

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    document.body.classList.toggle("module-nav-open", navOpen);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("module-nav-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  if (!session) return null;

  return (
    <>
      <button
        type="button"
        className={cn("module-nav-overlay", navOpen && "is-open")}
        aria-label={t("nav.closeMenu")}
        aria-hidden={!navOpen}
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <aside id="module-navigation" className={cn("module-sidebar", navOpen && "is-open")} aria-label={t("nav.mainNavigation")}>
        <div className="module-brand">
          <a href={process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"} className="module-brand-link" title={t("nav.backToHub")}>
            <span className="module-brand-mark" aria-hidden="true">
              <Image src="/favicon.svg" alt="" width={34} height={34} priority />
            </span>
            <span className="module-brand-copy">
              <span>Bleuh</span>
              <strong>Marketing</strong>
            </span>
          </a>
          <button type="button" className="module-sidebar-close" onClick={() => setNavOpen(false)} aria-label={t("nav.closeMenu")}>
            <X size={19} />
          </button>
        </div>

        <nav className="module-nav-list">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            const sectionId = `nav-${section.label.replace(/\s+/g, "-")}`;
            return (
              <section className="module-nav-section" key={section.label} aria-labelledby={sectionId}>
                <h2 id={sectionId}>
                  <SectionIcon size={13} strokeWidth={1.9} aria-hidden="true" />
                  {section.label}
                </h2>
                <div className="module-nav-items">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item.href);
                    return (
                      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("module-nav-link", active && "is-active")}>
                        <Icon size={17} strokeWidth={active ? 2.1 : 1.8} aria-hidden="true" />
                        <span>{item.label}</span>
                        {active && <ChevronRight className="module-nav-current" size={14} aria-hidden="true" />}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="module-sidebar-foot">
          <a href={process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"} className="module-hub-link">
            <span>{t("nav.backToGandalf")}</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </aside>

      <header className="module-topbar">
        <div className="module-topbar-left">
          <button type="button" className="module-menu-button" aria-label={t("nav.openMenu")} aria-controls="module-navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="module-breadcrumb" aria-label={t("nav.currentPage")}>
            <span>{activeSection?.label ?? t("nav.subtitle")}</span>
            <ChevronRight size={13} aria-hidden="true" />
            <strong>{activeItem?.label ?? "Marketing"}</strong>
          </div>
        </div>

        <div className="module-topbar-right">
          <span className="module-workspace-state"><span aria-hidden="true" />{t("nav.workspace")}</span>
          <div className="module-user-copy">
            <strong>{session.displayName || session.email}</strong>
            <span>{t(`role.${session.role}`)}</span>
          </div>
          <Sidebar />
        </div>
      </header>
    </>
  );
}
