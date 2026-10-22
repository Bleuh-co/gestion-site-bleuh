import "server-only";

/**
 * Envoi d'une notification au hub Gandalf (tiroir 🔔 + push mobile).
 *
 * `POST {HUB_URL}/api/notifications` avec l'en-tête `X-Notif-Key` est la SEULE
 * voie ouverte à une application extérieure. Le hub y crée un document
 * `notifications` ; son veilleur (lib/notification-watcher.js) le pousse ensuite
 * sur les appareils abonnés à cette adresse.
 *
 * Le DM dans le chat Gandalf n'est PAS accessible de l'extérieur : il passe par
 * `sendBotDm()`, une fonction interne du hub qu'aucune route M2M n'expose.
 * On n'essaie pas de l'imiter en écrivant à la main dans Firestore.
 *
 * DEUX PIÈGES DU SDK, contournés ici en appelant l'API directement (mêmes
 * conclusions que site-mdh/src/lib/gandalf-notify.ts, vérifiées sur
 * hub-chanv/routes/notifications.js) :
 *   1. le hub exige `user_email`, alors que le type de
 *      `@bleuh-co/gandalf-sdk-next/notify` expose `to` — un `notify({ to })`
 *      littéral se prend un 400 « user_email et title requis » ;
 *   2. le hub ne lit JAMAIS l'en-tête `X-Notif-App` et n'a aucun registre de
 *      clés par application, malgré ce qu'annonce le README du SDK. La clé est
 *      globale et s'appelle `NOTIF_API_KEY` côté hub.
 * Le paquet est présent dans node_modules : ne pas s'y laisser reprendre.
 *
 * Dégradation : sans clé, la fonction ne fait rien et le DIT (`not_configured`).
 * Elle ne lève JAMAIS — aucun geste de Marketing Bleuh ne doit tomber en
 * erreur parce que le hub est indisponible.
 *
 * Porté de marketing-mdh/src/lib/hub-notify.ts (plan « Pages d'atterrissage et
 * infolettres », 22/10/2026, lot L9). Seul l'identifiant de l'app change.
 */

const HUB_URL = (): string =>
  (process.env.HUB_URL || process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(
    /\/+$/,
    ""
  );

/**
 * Deep-link à déposer dans une notification pour rouvrir CETTE application.
 *
 * `?app=<cible>` et non `?view=<app>` : la grammaire d'URL du hub
 * (public/js/shell-route.js) ne connaît que ses propres sections dans `view`
 * — `?view=marketing-mdh` retomberait sur Aujourd'hui. `?app=` accepte l'id
 * exact du document `apps`, sinon un fragment de nom ou d'URL
 * (hub-chanv/public/js/shell.js#applyDeepLinkParams).
 */
export function hubAppLink(): string {
  const cible = process.env.GESTIONSITEBLEUH_APP_ID || "gestion-site-bleuh";
  return `/?app=${encodeURIComponent(cible)}`;
}

export interface HubNotification {
  user_email: string;
  title: string;
  body?: string;
  url?: string;
  /** Emoji affiché dans le tiroir 🔔 et sur le push. */
  icon?: string;
  /** Étiquette de provenance (routage de canal Android côté hub). */
  source?: string;
  title_en?: string;
  body_en?: string;
  title_es?: string;
  body_es?: string;
}

export interface HubNotifyResult {
  sent: number;
  skipped: number;
  /** `not_configured`, `no_recipients`, `http_401`, … — pour les journaux. */
  reason?: string;
}

/**
 * Envoie la MÊME notification à plusieurs personnes.
 *
 * Une requête par destinataire : le hub n'accepte qu'un `user_email` à la
 * fois. En série et non en parallèle — la route n'a aucune limite de débit,
 * c'est justement une raison de ne pas la marteler.
 */
export async function sendHubNotification(
  recipients: string[],
  notification: Omit<HubNotification, "user_email">,
  deps: { fetch?: typeof fetch } = {}
): Promise<HubNotifyResult> {
  const key = process.env.NOTIF_API_KEY || process.env.GANDALF_NOTIF_KEY;
  if (!key) {
    console.warn("[hub-notify] NOTIF_API_KEY absente — notification non envoyée.");
    return { sent: 0, skipped: recipients.length, reason: "not_configured" };
  }
  if (recipients.length === 0) return { sent: 0, skipped: 0, reason: "no_recipients" };

  const f = deps.fetch ?? fetch;
  let sent = 0;
  let skipped = 0;
  let reason: string | undefined;

  for (const email of recipients) {
    try {
      const res = await f(`${HUB_URL()}/api/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Notif-Key": key },
        body: JSON.stringify({ user_email: email, ...notification }),
      });
      if (res.ok) {
        sent++;
      } else {
        skipped++;
        // 401/403 → mauvaise clé ; 404 → HUB_URL périmée. La distinction est
        // ce qui évite de chercher du côté du code quand c'est la config.
        reason = `http_${res.status}`;
        console.warn(`[hub-notify] refus du hub (${res.status}) pour ${email}`);
      }
    } catch (err) {
      skipped++;
      reason = err instanceof Error ? err.message : "fetch_failed";
      console.warn("[hub-notify] envoi impossible :", reason);
    }
  }
  return { sent, skipped, ...(reason ? { reason } : {}) };
}
