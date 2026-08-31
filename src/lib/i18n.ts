"use client";

/**
 * Mini-système i18n trilingue (FR/EN/ES), piloté par le hub Gandalf.
 *
 * - La langue vient de useGandalf().lang (headers au SSR, postMessage en live).
 * - Clés à plat `section.element` ; repli : fr, puis la clé elle-même.
 * - Interpolation optionnelle : t("items.count", { n: 3 }) → "… (3)".
 *
 * AJOUTER ICI toutes les chaînes visibles des pages métier (FR/EN/ES).
 */

import { useCallback } from "react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";

export type Lang = "fr" | "en" | "es";

/** Locale de formatage (dates, nombres) par langue. */
export const LANG_LOCALES: Record<Lang, string> = {
  fr: "fr-CA",
  en: "en-CA",
  es: "es",
};

export const MESSAGES: Record<Lang, Record<string, string>> = {
  fr: {
    // Navigation
    "nav.home": "Accueil",
    "nav.subtitle": "Groupe Chanv",
    "nav.backToHub": "Retour au Hub",
    "nav.menu": "Menu",
    "nav.produits": "Produits",
    "nav.varietes": "Variétés",
    "nav.infolettre": "Infolettre",
    "nav.outils": "Outils",
    "nav.assistant": "Assistant IA",
    "nav.analyseCeo": "Analyse CEO",
    "nav.acquisition": "Acquisition",
    "nav.seo": "Analyse SEO",
    "nav.audit": "Audit",
    "nav.aide": "Mode d'emploi",

    // Acquisition — provenance des visites du site vitrine bleuh.co.
    "acq.title": "Acquisition",
    "acq.subtitle":
      "D'où viennent les visites de bleuh.co, le temps passé sur les pages, et les clics vers les détaillants.",
    "acq.days": "{n} jours",
    "acq.loading": "Chargement…",
    "acq.error": "Impossible de charger l'acquisition.",
    "acq.vitrineNote":
      "bleuh.co est un site vitrine : il n'y a aucune vente à mesurer ici. Le clic vers un détaillant (SQDC/OCS) est l'aboutissement le plus proche dont nous disposons — nous savons que la personne est partie chez le détaillant, pas si elle a acheté.",
    "acq.trafficPending.title": "Les visites ne sont pas encore mesurées sur cette période.",
    "acq.trafficPending.body":
      "La provenance des visites et le temps passé viennent d'être ajoutés à la mesure du site : seules les visites postérieures sont comptées. Les compteurs globaux plus anciens restent visibles dans Analyse CEO.",
    "acq.trafficPending.short": "En attente des premières visites mesurées.",
    "acq.kpi.sessions": "Sessions",
    "acq.kpi.pageViews": "{n} pages vues",
    "acq.kpi.avgTime": "Temps moyen par page",
    "acq.kpi.avgTimeSub": "Onglet actif seulement",
    "acq.kpi.retailerClicks": "Clics vers un détaillant",
    "acq.kpi.retailerClicksSub": "Sorties vers SQDC / OCS",
    "acq.kpi.clickRate": "Taux de clic sortant",
    "acq.kpi.clickRateSub": "Clics ÷ sessions — pas un taux de vente",
    "acq.chart.sessions": "Sessions par jour",
    "acq.chart.retailerClicks": "Clics vers un détaillant par jour",
    "acq.channels.title": "Provenance des visites",
    "acq.channels.help":
      "Regroupement par canal. Il absorbe les écarts d'écriture des paramètres de campagne (« cpc », « ppc », « paid » désignent la même chose).",
    "acq.campaigns.title": "Détail par campagne",
    "acq.campaigns.help": "Les 20 premières par nombre de sessions.",
    "acq.pages.title": "Temps passé sur les pages",
    "acq.pages.help":
      "Les 20 pages les plus vues. Le temps est compté onglet actif, plafonné à 30 minutes par page.",
    "acq.col.channel": "Canal",
    "acq.col.sessions": "Sessions",
    "acq.col.pageViews": "Pages vues",
    "acq.col.retailerClicks": "Clics détaillant",
    "acq.col.clickRate": "Taux de clic",
    "acq.col.source": "Source",
    "acq.col.medium": "Support",
    "acq.col.campaign": "Campagne",
    "acq.col.page": "Page",
    "acq.col.views": "Vues",
    "acq.col.avgTime": "Temps moyen",
    "acq.channel.direct": "Direct",
    "acq.channel.organique": "Recherche organique",
    "acq.channel.courriel": "Courriel",
    "acq.channel.social": "Réseaux sociaux",
    "acq.channel.payant": "Publicité payante",
    "acq.channel.reference": "Sites référents",
    "acq.channel.autre": "Autre",
    "acq.footnote": "Jours en UTC · mesure premier-partie, sous réserve du consentement aux témoins",
    "acq.generatedAt": "Calculé le",

    // Rôles
    "role.superadmin": "Super Administrateur",
    "role.admin": "Administrateur",
    "role.gestionnaire": "Gestionnaire",
    "role.consultant": "Consultant",
    "role.blocked": "Bloqué",

    // Connexion
    "login.loading": "Chargement...",
    "login.ssoChecking": "Connexion SSO en cours...",
    "login.signIn": "Se connecter avec Google",
    "login.domains": "Connexion réservée aux domaines",
    "login.sessionNote": "Une session s'ouvrira pour 5 jours.",

    // Carte de refus (deny-by-default)
    "blocked.title": "Accès non autorisé",
    "blocked.message": "Ce compte n'a pas accès à cette application. Contactez un administrateur pour obtenir un rôle, ou essayez un autre compte.",
    "blocked.retry": "Essayer un autre compte",
    "chart.empty": "Aucune donnée à afficher.",

    // Auth (messages du provider)
    "auth.domainNotAllowed": "Domaine non autorisé. Domaines acceptés : {domains}",
    "auth.sessionRefused": "Session refusée ({status})",
    "auth.signInFailed": "Échec de la connexion",

    // Génériques
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.delete": "Supprimer",
    "common.confirm": "Confirmer",
    "common.loading": "Chargement...",
    "common.error": "Une erreur est survenue",
    "common.new": "Nouveau",
    "common.edit": "Modifier",
    "common.search": "Rechercher",

    // Produits
    "produits.title": "Produits",
    "produits.new": "Nouveau produit",
    "produits.detail": "Détail du produit",
    "produits.status.draft": "Brouillon",
    "produits.status.published": "Publié",
    "produits.status.archived": "Archivé",

    // Outils
    "outils.title": "Outils",
    "outils.manage": "Gestion des outils",

    // Assistant
    "assistant.title": "Assistant IA",
    "assistant.placeholder": "Posez votre question...",

    // Analyse CEO
    "ceoAnalysis.title": "Analyse CEO",
    "ceoAnalysis.metrics": "Métriques",
    "ceoAnalysis.insights": "Recommandations",
  },
  en: {
    "nav.home": "Home",
    "nav.subtitle": "Groupe Chanv",
    "nav.backToHub": "Back to Hub",
    "nav.menu": "Menu",
    "nav.produits": "Products",
    "nav.varietes": "Varieties",
    "nav.infolettre": "Newsletter",
    "nav.outils": "Tools",
    "nav.assistant": "AI Assistant",
    "nav.analyseCeo": "CEO Analysis",
    "nav.acquisition": "Acquisition",
    "nav.seo": "SEO Analysis",
    "nav.audit": "Audit",
    "nav.aide": "User Guide",

    // Acquisition — where visits to the bleuh.co showcase site come from.
    "acq.title": "Acquisition",
    "acq.subtitle":
      "Where bleuh.co visits come from, time spent on pages, and clicks through to retailers.",
    "acq.days": "{n} days",
    "acq.loading": "Loading…",
    "acq.error": "Could not load acquisition data.",
    "acq.vitrineNote":
      "bleuh.co is a showcase site: there are no sales to measure here. A click through to a retailer (SQDC/OCS) is the closest outcome we have — we know the person left for the retailer, not whether they bought.",
    "acq.trafficPending.title": "Visits are not measured yet for this period.",
    "acq.trafficPending.body":
      "Visit origin and time spent were just added to the site's measurement: only later visits are counted. Older global counters remain visible in CEO Analysis.",
    "acq.trafficPending.short": "Waiting for the first measured visits.",
    "acq.kpi.sessions": "Sessions",
    "acq.kpi.pageViews": "{n} page views",
    "acq.kpi.avgTime": "Average time per page",
    "acq.kpi.avgTimeSub": "Active tab only",
    "acq.kpi.retailerClicks": "Clicks to a retailer",
    "acq.kpi.retailerClicksSub": "Exits to SQDC / OCS",
    "acq.kpi.clickRate": "Outbound click rate",
    "acq.kpi.clickRateSub": "Clicks ÷ sessions — not a sales rate",
    "acq.chart.sessions": "Sessions per day",
    "acq.chart.retailerClicks": "Clicks to a retailer per day",
    "acq.channels.title": "Where visits come from",
    "acq.channels.help":
      "Grouped by channel. This absorbs inconsistent campaign parameters (“cpc”, “ppc”, “paid” all mean the same thing).",
    "acq.campaigns.title": "Campaign breakdown",
    "acq.campaigns.help": "Top 20 by session count.",
    "acq.pages.title": "Time spent on pages",
    "acq.pages.help":
      "The 20 most viewed pages. Time is counted while the tab is active, capped at 30 minutes per page.",
    "acq.col.channel": "Channel",
    "acq.col.sessions": "Sessions",
    "acq.col.pageViews": "Page views",
    "acq.col.retailerClicks": "Retailer clicks",
    "acq.col.clickRate": "Click rate",
    "acq.col.source": "Source",
    "acq.col.medium": "Medium",
    "acq.col.campaign": "Campaign",
    "acq.col.page": "Page",
    "acq.col.views": "Views",
    "acq.col.avgTime": "Average time",
    "acq.channel.direct": "Direct",
    "acq.channel.organique": "Organic search",
    "acq.channel.courriel": "Email",
    "acq.channel.social": "Social",
    "acq.channel.payant": "Paid advertising",
    "acq.channel.reference": "Referring sites",
    "acq.channel.autre": "Other",
    "acq.footnote": "Days in UTC · first-party measurement, subject to cookie consent",
    "acq.generatedAt": "Computed on",

    "role.superadmin": "Super Administrator",
    "role.admin": "Administrator",
    "role.gestionnaire": "Manager",
    "role.consultant": "Consultant",
    "role.blocked": "Blocked",

    "login.loading": "Loading...",
    "login.ssoChecking": "SSO sign-in in progress...",
    "login.signIn": "Sign in with Google",
    "login.domains": "Sign-in restricted to domains",
    "login.sessionNote": "A session will stay open for 5 days.",

    "blocked.title": "Access denied",
    "blocked.message": "This account does not have access to this application. Contact an administrator to be granted a role, or try another account.",
    "blocked.retry": "Try another account",
    "chart.empty": "No data to display.",

    "auth.domainNotAllowed": "Domain not allowed. Accepted domains: {domains}",
    "auth.sessionRefused": "Session refused ({status})",
    "auth.signInFailed": "Sign-in failed",

    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.confirm": "Confirm",
    "common.loading": "Loading...",
    "common.error": "An error occurred",
    "common.new": "New",
    "common.edit": "Edit",
    "common.search": "Search",

    "produits.title": "Products",
    "produits.new": "New product",
    "produits.detail": "Product details",
    "produits.status.draft": "Draft",
    "produits.status.published": "Published",
    "produits.status.archived": "Archived",

    "outils.title": "Tools",
    "outils.manage": "Manage tools",

    "assistant.title": "AI Assistant",
    "assistant.placeholder": "Ask your question...",

    "ceoAnalysis.title": "CEO Analysis",
    "ceoAnalysis.metrics": "Metrics",
    "ceoAnalysis.insights": "Recommendations",
  },
  es: {
    "nav.home": "Inicio",
    "nav.subtitle": "Groupe Chanv",
    "nav.backToHub": "Volver al Hub",
    "nav.menu": "Menú",
    "nav.produits": "Productos",
    "nav.varietes": "Variedades",
    "nav.infolettre": "Boletín",
    "nav.outils": "Herramientas",
    "nav.assistant": "Asistente IA",
    "nav.analyseCeo": "Análisis CEO",
    "nav.acquisition": "Adquisición",
    "nav.seo": "Análisis SEO",
    "nav.audit": "Auditoría",
    "nav.aide": "Guía de uso",

    // Adquisición — de dónde vienen las visitas del sitio escaparate bleuh.co.
    "acq.title": "Adquisición",
    "acq.subtitle":
      "De dónde vienen las visitas a bleuh.co, el tiempo en las páginas y los clics hacia los distribuidores.",
    "acq.days": "{n} días",
    "acq.loading": "Cargando…",
    "acq.error": "No se pudo cargar la adquisición.",
    "acq.vitrineNote":
      "bleuh.co es un sitio escaparate: aquí no hay ventas que medir. El clic hacia un distribuidor (SQDC/OCS) es el resultado más cercano del que disponemos — sabemos que la persona se fue al distribuidor, no si compró.",
    "acq.trafficPending.title": "Las visitas aún no se miden en este período.",
    "acq.trafficPending.body":
      "El origen de las visitas y el tiempo en página acaban de añadirse a la medición del sitio: solo se cuentan las visitas posteriores. Los contadores globales anteriores siguen visibles en Análisis CEO.",
    "acq.trafficPending.short": "Esperando las primeras visitas medidas.",
    "acq.kpi.sessions": "Sesiones",
    "acq.kpi.pageViews": "{n} páginas vistas",
    "acq.kpi.avgTime": "Tiempo medio por página",
    "acq.kpi.avgTimeSub": "Solo pestaña activa",
    "acq.kpi.retailerClicks": "Clics hacia un distribuidor",
    "acq.kpi.retailerClicksSub": "Salidas hacia SQDC / OCS",
    "acq.kpi.clickRate": "Tasa de clic saliente",
    "acq.kpi.clickRateSub": "Clics ÷ sesiones — no es una tasa de venta",
    "acq.chart.sessions": "Sesiones por día",
    "acq.chart.retailerClicks": "Clics hacia un distribuidor por día",
    "acq.channels.title": "Origen de las visitas",
    "acq.channels.help":
      "Agrupado por canal. Absorbe las diferencias de escritura de los parámetros de campaña («cpc», «ppc», «paid» designan lo mismo).",
    "acq.campaigns.title": "Detalle por campaña",
    "acq.campaigns.help": "Las 20 primeras por número de sesiones.",
    "acq.pages.title": "Tiempo en las páginas",
    "acq.pages.help":
      "Las 20 páginas más vistas. El tiempo se cuenta con la pestaña activa, con un tope de 30 minutos por página.",
    "acq.col.channel": "Canal",
    "acq.col.sessions": "Sesiones",
    "acq.col.pageViews": "Páginas vistas",
    "acq.col.retailerClicks": "Clics distribuidor",
    "acq.col.clickRate": "Tasa de clic",
    "acq.col.source": "Fuente",
    "acq.col.medium": "Medio",
    "acq.col.campaign": "Campaña",
    "acq.col.page": "Página",
    "acq.col.views": "Vistas",
    "acq.col.avgTime": "Tiempo medio",
    "acq.channel.direct": "Directo",
    "acq.channel.organique": "Búsqueda orgánica",
    "acq.channel.courriel": "Correo electrónico",
    "acq.channel.social": "Redes sociales",
    "acq.channel.payant": "Publicidad pagada",
    "acq.channel.reference": "Sitios de referencia",
    "acq.channel.autre": "Otro",
    "acq.footnote": "Días en UTC · medición propia, sujeta al consentimiento de cookies",
    "acq.generatedAt": "Calculado el",

    "role.superadmin": "Superadministrador",
    "role.admin": "Administrador",
    "role.gestionnaire": "Gestor",
    "role.consultant": "Consultor",
    "role.blocked": "Bloqueado",

    "login.loading": "Cargando...",
    "login.ssoChecking": "Conexión SSO en curso...",
    "login.signIn": "Iniciar sesión con Google",
    "login.domains": "Acceso reservado a los dominios",
    "login.sessionNote": "La sesión permanecerá abierta 5 días.",

    "blocked.title": "Acceso no autorizado",
    "blocked.message": "Esta cuenta no tiene acceso a esta aplicación. Contacta a un administrador para obtener un rol, o prueba con otra cuenta.",
    "blocked.retry": "Probar con otra cuenta",
    "chart.empty": "No hay datos para mostrar.",

    "auth.domainNotAllowed": "Dominio no autorizado. Dominios aceptados: {domains}",
    "auth.sessionRefused": "Sesión rechazada ({status})",
    "auth.signInFailed": "Error al iniciar sesión",

    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.confirm": "Confirmar",
    "common.loading": "Cargando...",
    "common.error": "Ocurrió un error",
    "common.new": "Nuevo",
    "common.edit": "Editar",
    "common.search": "Buscar",

    "produits.title": "Productos",
    "produits.new": "Nuevo producto",
    "produits.detail": "Detalle del producto",
    "produits.status.draft": "Borrador",
    "produits.status.published": "Publicado",
    "produits.status.archived": "Archivado",

    "outils.title": "Herramientas",
    "outils.manage": "Gestión de herramientas",

    "assistant.title": "Asistente IA",
    "assistant.placeholder": "Haz tu pregunta...",

    "ceoAnalysis.title": "Análisis CEO",
    "ceoAnalysis.metrics": "Métricas",
    "ceoAnalysis.insights": "Recomendaciones",
  },
};

/** Traduit une clé avec interpolation `{var}` optionnelle. */
export function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>
): string {
  const raw = MESSAGES[lang]?.[key] ?? MESSAGES.fr[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

/** Hook : t("clé") branché sur la langue live du hub Gandalf. */
export function useT() {
  const { lang } = useGandalf();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
}

/** Hook : locale de formatage correspondant à la langue courante. */
export function useLocale(): string {
  const { lang } = useGandalf();
  return LANG_LOCALES[lang];
}
