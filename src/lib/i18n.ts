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
    "nav.gsc": "Performance Google",
    "nav.audit": "Audit",
    "nav.aide": "Mode d'emploi",
    "nav.sectionCatalogue": "Catalogue",
    "nav.sectionMarketing": "Marketing",
    "nav.sectionTools": "Outils",
    "nav.sectionSystem": "Système",
    "nav.openMenu": "Ouvrir la navigation",
    "nav.closeMenu": "Fermer la navigation",
    "nav.mainNavigation": "Navigation principale",
    "nav.currentPage": "Page actuelle",
    "nav.workspace": "Espace Bleuh",
    "nav.backToGandalf": "Retour à Gandalf",
    "nav.accountMenu": "Ouvrir le menu du compte",

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

    "gsc.title": "Performance Google",
    "gsc.subtitle":
      "Vraies données Google Search Console : comment le site apparaît et clique dans la recherche Google. Archivées chaque nuit — historique illimité.",
    "gsc.days": "{n} jours",
    "gsc.loading": "Chargement…",
    "gsc.error": "Impossible de charger le rapport Search Console.",
    "gsc.empty.title": "Aucune donnée archivée pour l'instant.",
    "gsc.empty.body":
      "La première synchronisation avec Google Search Console n'a pas encore tourné. Elle passe automatiquement chaque nuit.",
    "gsc.vsPrev": "vs période précédente",
    "gsc.kpi.clicks": "Clics",
    "gsc.kpi.impressions": "Impressions",
    "gsc.kpi.ctr": "Taux de clic (CTR)",
    "gsc.kpi.position": "Position moyenne",
    "gsc.kpi.positionHint": "Plus bas = mieux classé",
    "gsc.chart.clicks": "Clics par jour",
    "gsc.chart.impressions": "Impressions par jour",
    "gsc.queries.title": "Meilleures requêtes",
    "gsc.queries.help": "Ce que les gens tapent dans Google quand ils nous trouvent, sur la période choisie.",
    "gsc.pages.title": "Meilleures pages",
    "gsc.pages.help": "Les pages du site qui reçoivent des clics depuis Google, sur la période choisie.",
    "gsc.col.query": "Requête",
    "gsc.col.page": "Page",
    "gsc.col.clicks": "Clics",
    "gsc.col.impressions": "Impressions",
    "gsc.col.ctr": "CTR",
    "gsc.col.position": "Position",
    "gsc.devices.title": "Appareils",
    "gsc.countries.title": "Pays",
    "gsc.device.mobile": "Mobile",
    "gsc.device.desktop": "Ordinateur",
    "gsc.device.tablet": "Tablette",
    "gsc.unit.clicks": "clics",
    "gsc.unit.impressions": "impr.",
    "gsc.sitemaps.title": "Indexation (sitemaps)",
    "gsc.sitemaps.help": "État des plans de site déclarés à Google : pages soumises, pages indexées, erreurs.",
    "gsc.col.sitemap": "Sitemap",
    "gsc.col.submitted": "Soumises",
    "gsc.col.indexed": "Indexées",
    "gsc.col.errors": "Erreurs",
    "gsc.sync": "Synchroniser",
    "gsc.syncing": "Synchronisation…",
    "gsc.syncHint": "Rejoue la synchronisation des 3 derniers jours publiés par Google.",
    "gsc.syncDone": "Synchronisation terminée — données rechargées.",
    "gsc.syncError": "Échec de la synchronisation :",
    "gsc.footnote":
      "Données Google Search Console (publiées avec ~2 jours de retard) · propriété {site} · dernier jour archivé : {date}",

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

    // Référencement d'une fiche produit — section « Référencement » du
    // formulaire produit. Règle commune à ces quatre champs : laissé vide,
    // c'est le site qui décide. Les libellés doivent donc dire ce qui se
    // passe quand on n'écrit rien, jamais réclamer un remplissage.
    "produits.seo.section": "Référencement",
    "produits.seo.intro":
      "Ce que Google affiche quand la fiche sort dans ses résultats, et l'image qui accompagne le lien quand on le partage. Chaque champ laissé vide garde la valeur par défaut du site.",
    "produits.seo.preview": "Aperçu dans Google",
    "produits.seo.previewHint":
      "Aperçu indicatif : l'affichage réel varie selon l'appareil et la recherche.",
    "produits.seo.noteTitle": "Le titre, lui, est repris tel quel la plupart du temps.",
    "produits.seo.noteDescription":
      "Google réécrit souvent la description selon la recherche tapée : ce qui est écrit ici est une proposition, pas une garantie.",
    "produits.seo.default": "valeur par défaut du site",
    "produits.seo.emptyDescription": "Vide : Google choisira lui-même un extrait de la page.",
    "produits.seo.untitled": "Nom du produit à venir",
    "produits.seo.chars": "{n}/{max} caractères",
    "produits.seo.charsOver": "Au-delà de {max} caractères, Google coupe souvent la fin.",
    "produits.seo.title.label": "Titre Google ({lang})",
    "produits.seo.title.help": "Laissé vide, le site affiche « {default} ».",
    "produits.seo.title.placeholder": "Laisser vide pour garder le titre par défaut",
    "produits.seo.meta.label": "Méta-description ({lang})",
    "produits.seo.meta.help": "Le texte gris sous le titre, dans les résultats de recherche.",
    "produits.seo.canonical.label": "Adresse canonique ({lang})",
    "produits.seo.canonical.help":
      "À remplir seulement si cette fiche fait double emploi avec une autre page, ou si elle a changé d'adresse. Dans presque tous les cas, laisser vide.",
    "produits.seo.canonical.invalid": "Adresse incomplète : elle doit commencer par « https:// ».",
    "produits.seo.noindex.label": "Retirer cette fiche de Google",
    "produits.seo.noindex.help":
      "La fiche reste en ligne et accessible à qui a le lien ; elle demande seulement à ne plus apparaître dans les résultats de recherche. Le retrait prend en général quelques jours.",
    "produits.seo.noindex.active":
      "Cette fiche demande à ne plus figurer dans les résultats Google.",
    "produits.seo.og.label": "Image de partage",
    "produits.seo.og.help":
      "L'image affichée quand le lien de la fiche est partagé sur Facebook, LinkedIn ou Messenger.",
    "produits.seo.og.placeholder": "Coller une adresse d'image",
    "produits.seo.og.preview": "Aperçu du partage",
    "produits.seo.og.fallback": "Vide : le site utilisera l'image principale du produit.",
    "produits.seo.og.none":
      "Ce produit n'a pas encore d'image principale : le partage affichera l'image générique de Bleuh.",
    "produits.seo.og.usingMain": "Image principale du produit",

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
    "nav.gsc": "Google Performance",
    "nav.audit": "Audit",
    "nav.aide": "User Guide",
    "nav.sectionCatalogue": "Catalog",
    "nav.sectionMarketing": "Marketing",
    "nav.sectionTools": "Tools",
    "nav.sectionSystem": "System",
    "nav.openMenu": "Open navigation",
    "nav.closeMenu": "Close navigation",
    "nav.mainNavigation": "Main navigation",
    "nav.currentPage": "Current page",
    "nav.workspace": "Bleuh workspace",
    "nav.backToGandalf": "Back to Gandalf",
    "nav.accountMenu": "Open account menu",

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

    "gsc.title": "Google Performance",
    "gsc.subtitle":
      "Real Google Search Console data: how the site shows up and gets clicked in Google Search. Archived nightly — unlimited history.",
    "gsc.days": "{n} days",
    "gsc.loading": "Loading…",
    "gsc.error": "Could not load the Search Console report.",
    "gsc.empty.title": "No archived data yet.",
    "gsc.empty.body":
      "The first Google Search Console sync hasn't run yet. It runs automatically every night.",
    "gsc.vsPrev": "vs previous period",
    "gsc.kpi.clicks": "Clicks",
    "gsc.kpi.impressions": "Impressions",
    "gsc.kpi.ctr": "Click-through rate (CTR)",
    "gsc.kpi.position": "Average position",
    "gsc.kpi.positionHint": "Lower = better ranked",
    "gsc.chart.clicks": "Clicks per day",
    "gsc.chart.impressions": "Impressions per day",
    "gsc.queries.title": "Top queries",
    "gsc.queries.help": "What people type into Google when they find us, over the selected period.",
    "gsc.pages.title": "Top pages",
    "gsc.pages.help": "The site pages that receive clicks from Google, over the selected period.",
    "gsc.col.query": "Query",
    "gsc.col.page": "Page",
    "gsc.col.clicks": "Clicks",
    "gsc.col.impressions": "Impressions",
    "gsc.col.ctr": "CTR",
    "gsc.col.position": "Position",
    "gsc.devices.title": "Devices",
    "gsc.countries.title": "Countries",
    "gsc.device.mobile": "Mobile",
    "gsc.device.desktop": "Desktop",
    "gsc.device.tablet": "Tablet",
    "gsc.unit.clicks": "clicks",
    "gsc.unit.impressions": "impr.",
    "gsc.sitemaps.title": "Indexing (sitemaps)",
    "gsc.sitemaps.help": "Status of the sitemaps declared to Google: submitted pages, indexed pages, errors.",
    "gsc.col.sitemap": "Sitemap",
    "gsc.col.submitted": "Submitted",
    "gsc.col.indexed": "Indexed",
    "gsc.col.errors": "Errors",
    "gsc.sync": "Sync now",
    "gsc.syncing": "Syncing…",
    "gsc.syncHint": "Replays the sync of the last 3 days published by Google.",
    "gsc.syncDone": "Sync finished — data reloaded.",
    "gsc.syncError": "Sync failed:",
    "gsc.footnote":
      "Google Search Console data (published with a ~2-day delay) · property {site} · latest archived day: {date}",

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

    "produits.seo.section": "Search engines",
    "produits.seo.intro":
      "What Google shows when this product comes up in its results, and the image that goes with the link when it is shared. Every field left empty keeps the site's default.",
    "produits.seo.preview": "Google preview",
    "produits.seo.previewHint":
      "Indicative preview: the real display varies by device and by search.",
    "produits.seo.noteTitle": "The title, on the other hand, is usually kept as written.",
    "produits.seo.noteDescription":
      "Google often rewrites the description to match the search typed: what is written here is a proposal, not a guarantee.",
    "produits.seo.default": "site default",
    "produits.seo.emptyDescription": "Empty: Google will pick an excerpt from the page itself.",
    "produits.seo.untitled": "Product name to come",
    "produits.seo.chars": "{n}/{max} characters",
    "produits.seo.charsOver": "Past {max} characters, Google often cuts the end off.",
    "produits.seo.title.label": "Google title ({lang})",
    "produits.seo.title.help": "Left empty, the site shows “{default}”.",
    "produits.seo.title.placeholder": "Leave empty to keep the default title",
    "produits.seo.meta.label": "Meta description ({lang})",
    "produits.seo.meta.help": "The grey text under the title, in search results.",
    "produits.seo.canonical.label": "Canonical address ({lang})",
    "produits.seo.canonical.help":
      "Fill this in only if this product duplicates another page, or if it has changed address. In almost every case, leave it empty.",
    "produits.seo.canonical.invalid": "Incomplete address: it must start with “https://”.",
    "produits.seo.noindex.label": "Remove this product from Google",
    "produits.seo.noindex.help":
      "The page stays online and reachable by anyone with the link; it simply asks not to appear in search results any more. Removal usually takes a few days.",
    "produits.seo.noindex.active": "This product asks to be left out of Google results.",
    "produits.seo.og.label": "Sharing image",
    "produits.seo.og.help":
      "The image shown when the product link is shared on Facebook, LinkedIn or Messenger.",
    "produits.seo.og.placeholder": "Paste an image address",
    "produits.seo.og.preview": "Sharing preview",
    "produits.seo.og.fallback": "Empty: the site will use the product's main image.",
    "produits.seo.og.none":
      "This product has no main image yet: sharing will show the generic Bleuh image.",
    "produits.seo.og.usingMain": "Product's main image",

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
    "nav.gsc": "Rendimiento Google",
    "nav.audit": "Auditoría",
    "nav.aide": "Guía de uso",
    "nav.sectionCatalogue": "Catálogo",
    "nav.sectionMarketing": "Marketing",
    "nav.sectionTools": "Herramientas",
    "nav.sectionSystem": "Sistema",
    "nav.openMenu": "Abrir la navegación",
    "nav.closeMenu": "Cerrar la navegación",
    "nav.mainNavigation": "Navegación principal",
    "nav.currentPage": "Página actual",
    "nav.workspace": "Espacio Bleuh",
    "nav.backToGandalf": "Volver a Gandalf",
    "nav.accountMenu": "Abrir el menú de la cuenta",

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

    "gsc.title": "Rendimiento Google",
    "gsc.subtitle":
      "Datos reales de Google Search Console: cómo aparece el sitio y recibe clics en la búsqueda de Google. Archivados cada noche — historial ilimitado.",
    "gsc.days": "{n} días",
    "gsc.loading": "Cargando…",
    "gsc.error": "No se pudo cargar el informe de Search Console.",
    "gsc.empty.title": "Aún no hay datos archivados.",
    "gsc.empty.body":
      "La primera sincronización con Google Search Console aún no se ha ejecutado. Se ejecuta automáticamente cada noche.",
    "gsc.vsPrev": "vs período anterior",
    "gsc.kpi.clicks": "Clics",
    "gsc.kpi.impressions": "Impresiones",
    "gsc.kpi.ctr": "Tasa de clics (CTR)",
    "gsc.kpi.position": "Posición media",
    "gsc.kpi.positionHint": "Más bajo = mejor posicionado",
    "gsc.chart.clicks": "Clics por día",
    "gsc.chart.impressions": "Impresiones por día",
    "gsc.queries.title": "Mejores consultas",
    "gsc.queries.help": "Lo que la gente escribe en Google cuando nos encuentra, en el período elegido.",
    "gsc.pages.title": "Mejores páginas",
    "gsc.pages.help": "Las páginas del sitio que reciben clics desde Google, en el período elegido.",
    "gsc.col.query": "Consulta",
    "gsc.col.page": "Página",
    "gsc.col.clicks": "Clics",
    "gsc.col.impressions": "Impresiones",
    "gsc.col.ctr": "CTR",
    "gsc.col.position": "Posición",
    "gsc.devices.title": "Dispositivos",
    "gsc.countries.title": "Países",
    "gsc.device.mobile": "Móvil",
    "gsc.device.desktop": "Ordenador",
    "gsc.device.tablet": "Tableta",
    "gsc.unit.clicks": "clics",
    "gsc.unit.impressions": "impr.",
    "gsc.sitemaps.title": "Indexación (sitemaps)",
    "gsc.sitemaps.help": "Estado de los sitemaps declarados a Google: páginas enviadas, indexadas, errores.",
    "gsc.col.sitemap": "Sitemap",
    "gsc.col.submitted": "Enviadas",
    "gsc.col.indexed": "Indexadas",
    "gsc.col.errors": "Errores",
    "gsc.sync": "Sincronizar",
    "gsc.syncing": "Sincronizando…",
    "gsc.syncHint": "Repite la sincronización de los últimos 3 días publicados por Google.",
    "gsc.syncDone": "Sincronización terminada — datos recargados.",
    "gsc.syncError": "Fallo de sincronización:",
    "gsc.footnote":
      "Datos de Google Search Console (publicados con ~2 días de retraso) · propiedad {site} · último día archivado: {date}",

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

    "produits.seo.section": "Posicionamiento",
    "produits.seo.intro":
      "Lo que Google muestra cuando la ficha aparece en sus resultados, y la imagen que acompaña al enlace cuando se comparte. Cada campo que se deja vacío conserva el valor por defecto del sitio.",
    "produits.seo.preview": "Vista previa en Google",
    "produits.seo.previewHint":
      "Vista previa orientativa: la presentación real varía según el dispositivo y la búsqueda.",
    "produits.seo.noteTitle": "El título, en cambio, se respeta tal cual la mayoría de las veces.",
    "produits.seo.noteDescription":
      "Google suele reescribir la descripción según la búsqueda escrita: lo que se pone aquí es una propuesta, no una garantía.",
    "produits.seo.default": "valor por defecto del sitio",
    "produits.seo.emptyDescription": "Vacío: Google elegirá él mismo un extracto de la página.",
    "produits.seo.untitled": "Nombre del producto pendiente",
    "produits.seo.chars": "{n}/{max} caracteres",
    "produits.seo.charsOver": "Más allá de {max} caracteres, Google suele cortar el final.",
    "produits.seo.title.label": "Título en Google ({lang})",
    "produits.seo.title.help": "Si se deja vacío, el sitio muestra «{default}».",
    "produits.seo.title.placeholder": "Dejar vacío para conservar el título por defecto",
    "produits.seo.meta.label": "Metadescripción ({lang})",
    "produits.seo.meta.help": "El texto gris bajo el título, en los resultados de búsqueda.",
    "produits.seo.canonical.label": "Dirección canónica ({lang})",
    "produits.seo.canonical.help":
      "Se rellena solo si esta ficha duplica otra página, o si ha cambiado de dirección. En casi todos los casos, dejar vacío.",
    "produits.seo.canonical.invalid": "Dirección incompleta: debe empezar por «https://».",
    "produits.seo.noindex.label": "Retirar esta ficha de Google",
    "produits.seo.noindex.help":
      "La ficha sigue en línea y accesible para quien tenga el enlace; solo pide no aparecer más en los resultados de búsqueda. La retirada suele tardar unos días.",
    "produits.seo.noindex.active": "Esta ficha pide no figurar en los resultados de Google.",
    "produits.seo.og.label": "Imagen para compartir",
    "produits.seo.og.help":
      "La imagen que se muestra cuando el enlace de la ficha se comparte en Facebook, LinkedIn o Messenger.",
    "produits.seo.og.placeholder": "Pegar una dirección de imagen",
    "produits.seo.og.preview": "Vista previa al compartir",
    "produits.seo.og.fallback": "Vacío: el sitio usará la imagen principal del producto.",
    "produits.seo.og.none":
      "Este producto aún no tiene imagen principal: al compartirlo se mostrará la imagen genérica de Bleuh.",
    "produits.seo.og.usingMain": "Imagen principal del producto",

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
