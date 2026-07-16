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
    "nav.infolettre": "Infolettre",
    "nav.outils": "Outils",
    "nav.assistant": "Assistant IA",
    "nav.analyseCeo": "Analyse CEO",
    "nav.audit": "Audit",
    "nav.aide": "Mode d'emploi",

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
    "nav.infolettre": "Newsletter",
    "nav.outils": "Tools",
    "nav.assistant": "AI Assistant",
    "nav.analyseCeo": "CEO Analysis",
    "nav.audit": "Audit",
    "nav.aide": "User Guide",

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
    "nav.infolettre": "Boletín",
    "nav.outils": "Herramientas",
    "nav.assistant": "Asistente IA",
    "nav.analyseCeo": "Análisis CEO",
    "nav.audit": "Auditoría",
    "nav.aide": "Guía de uso",

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
