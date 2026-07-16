import type { ReactNode } from "react";
import { requireRead } from "@/lib/auth-server";

/**
 * Bloc réutilisable pour expliquer un chiffre affiché ailleurs dans l'app.
 * Toujours le même format : D'où ça vient / Ce que ça veut dire / Comment le lire.
 */
function Chiffre({
  titre,
  ou,
  veut,
  lire,
}: {
  titre: string;
  ou: ReactNode;
  veut: ReactNode;
  lire: ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ border: "1px solid var(--chanv-fibre)" }}
    >
      <p className="font-bold mb-2">{titre}</p>
      <p className="text-sm mb-1.5 leading-relaxed">
        <span className="font-semibold">D&apos;où ça vient :</span> {ou}
      </p>
      <p className="text-sm mb-1.5 leading-relaxed">
        <span className="font-semibold">Ce que ça veut dire :</span> {veut}
      </p>
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">Comment le lire :</span> {lire}
      </p>
    </div>
  );
}

function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-bold mt-6 mb-3">{children}</h3>;
}

export default async function AidePage() {
  const session = await requireRead().catch(() => null);
  if (!session) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">Mode d&apos;emploi</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>Accès refusé.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-2">Mode d&apos;emploi</h1>
      <p className="text-gray-500 mb-8">
        Un guide complet pour comprendre l&apos;application, chaque module et chaque chiffre
        affiché à l&apos;écran — d&apos;où il vient, ce qu&apos;il veut dire, et comment le lire.
      </p>

      <div className="space-y-6">
        {/* Introduction */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">Bienvenue sur Gestion Site Bleuh</h2>
          <p className="mb-4">
            Cette application est la console d&apos;administration du site web Bleuh. C&apos;est
            ici que l&apos;équipe met à jour le catalogue de produits, configure l&apos;assistant
            IA du site, suit les performances et lance les outils techniques.
          </p>
          <p className="mb-3 font-semibold">Votre accès dépend de votre niveau :</p>
          <div className="flex flex-wrap gap-2">
            <span className="badge-neutral">Consulter — voir sans modifier</span>
            <span className="badge-neutral">Gestionnaire — créer, modifier, lancer les outils</span>
            <span className="badge-accent">Administrateur — tout, plus les journaux d&apos;audit</span>
          </div>
        </section>

        {/* Produits */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">📦 Produits</h2>
          <p className="mb-3">
            C&apos;est le catalogue des produits Bleuh, tel qu&apos;il apparaît (ou non) sur le
            site public. Chaque fiche vit dans la base de données du site (Firestore, collection{" "}
            <code>products</code>) : créer, modifier ou publier une fiche ici change directement
            ce que les visiteurs voient.
          </p>
          <p className="mb-2">
            Vous pouvez consulter la liste complète et ouvrir une fiche pour voir ses détails.
            Selon votre rôle, vous pouvez aussi <strong>créer</strong>, <strong>modifier</strong>{" "}
            ou <strong>supprimer</strong> une fiche produit.
          </p>
          <SousTitre>Filtrer et chercher</SousTitre>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>
              <strong>Collection</strong> : les gammes de produits (par ex. Bleuh, Bleuh Light,
              Blakh, Blanh, Goldh, Grindh, Skyh). C&apos;est un champ libre côté données, donc
              d&apos;autres valeurs peuvent apparaître avec le temps.
            </li>
            <li>
              <strong>Province</strong> : Québec (qc) ou Ontario (on) — un produit peut être
              vendu dans l&apos;une, l&apos;autre, ou les deux.
            </li>
            <li>
              <strong>Statut</strong> : <em>brouillon</em> (non visible publiquement),{" "}
              <em>publié</em> (visible sur le site) ou <em>archivé</em> (retiré).
            </li>
            <li>
              <strong>Recherche texte</strong> : filtre la liste au fil de la frappe (avec un
              court délai pour éviter de relancer une recherche à chaque lettre).
            </li>
          </ul>
          <SousTitre>Ce que contient une fiche</SousTitre>
          <p className="text-sm">
            Nom et adresse web (slug) en français et en anglais, collection, marque, type
            (indica / sativa / hybride), taux de THC (min/max), format et poids, provinces de
            vente, indicateurs (nouveau, exclusif web, à venir), description et méta-description
            bilingues, détails (format, variété, effets, terpènes, lieu de culture, distribution),
            images (principale + galerie), badges, liens d&apos;achat vers les détaillants
            (SQDC/OCS), code GTIN/SKU, variétés de rotation, produits liés, statut et dates de
            création/modification.
          </p>
        </section>

        {/* Assistant IA */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">🤖 Assistant IA</h2>
          <p className="mb-3">
            C&apos;est ici que se gère le chatbot du site (celui que les visiteurs voient en bas
            à droite). Cette page ne fait qu&apos;afficher et modifier le service qui fait
            réellement tourner l&apos;assistant (hébergé séparément) — rien n&apos;est simulé
            localement. Quatre onglets :
          </p>
          <SousTitre>Configuration</SousTitre>
          <p className="text-sm mb-2">
            Tout ce que vous modifiez ici change le comportement réel de l&apos;assistant en
            production dès que vous publiez. Vous pouvez éditer : l&apos;activation/désactivation,
            le modèle IA utilisé, le courriel d&apos;escalade (où sont envoyées les conversations
            transférées à un humain), l&apos;identité et le ton (français et anglais), les amorces
            de conversation suggérées aux visiteurs, la FAQ (question/réponse en FR et EN), le
            budget quotidien maximal en dollars US, le nombre maximal de messages par session, le
            nombre maximal de requêtes par heure et par adresse IP, la longueur maximale d&apos;un
            message entrant et la longueur maximale d&apos;une réponse. Le « socle légal »
            (les règles de conformité de base, en FR et EN) est affiché mais non modifiable ici.
          </p>
          <p className="text-sm">
            Quand vous publiez, l&apos;auteur enregistré est toujours votre propre courriel de
            session (jamais une valeur que vous pourriez saisir), et la publication lance
            automatiquement un auto-test en arrière-plan pour vérifier que rien n&apos;est cassé.
          </p>
          <SousTitre>Bac à sable</SousTitre>
          <p className="text-sm">
            Un espace pour tester une conversation avec la configuration que vous êtes en train
            d&apos;éditer — <strong>avant</strong> de la publier. Vous choisissez la langue et la
            région (Québec/Canada) du visiteur simulé. La réponse arrive mot à mot, comme sur le
            vrai site, et le bac à sable indique si le bot aurait déclenché une escalade ou
            atteint la limite de messages d&apos;une session.
          </p>
          <SousTitre>Auto-test</SousTitre>
          <p className="text-sm">
            Une batterie d&apos;environ 36 vérifications de conformité qui interroge réellement le
            modèle IA — donc consomme du budget. Une confirmation est demandée avant de lancer,
            et le résultat indique combien de tests ont réussi, échoué, et le détail de chacun.
          </p>
          <SousTitre>Transcripts &amp; stats</SousTitre>
          <p className="text-sm mb-3">
            Les conversations réelles des visiteurs (date, langue, région, issue, nombre de
            messages, contenu déroulable) et un résumé chiffré des 7 derniers jours.
          </p>
          <div className="space-y-3">
            <Chiffre
              titre="Volume par jour (7 derniers jours)"
              ou="Compté directement par le service de l'assistant, pas recalculé dans cette application."
              veut="Combien de conversations le chatbot a reçues chaque jour récemment."
              lire="Une hausse ou une baisse soudaine mérite d'être mise en relation avec un changement sur le site (nouvelle page, promo, panne)."
            />
            <Chiffre
              titre="Taux d'escalade (onglet stats)"
              ou="Fourni par le service de l'assistant lui-même, sur la même base que les conversations comptées ci-dessus."
              veut="À quelle fréquence le bot n'a pas pu répondre seul et a transféré la conversation à un humain."
              lire="Bas = le bot se débrouille seul. En hausse = des sujets manquent probablement dans la configuration ou la FAQ — à corriger dans l'onglet Configuration."
            />
            <Chiffre
              titre="Dépense estimée du jour (USD)"
              ou="Calculée par le service de l'assistant à partir des tokens réellement consommés aujourd'hui et du tarif du modèle actif."
              veut="Combien coûte l'assistant IA en dollars américains, pour la journée en cours seulement."
              lire="À comparer au budget quotidien maximal défini dans la Configuration : si elle s'en approche, l'assistant risque d'être coupé automatiquement le reste de la journée."
            />
          </div>
        </section>

        {/* Analyse CEO */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">📊 Analyse CEO</h2>
          <p className="mb-3">
            Un tableau de bord de la performance du site vitrine et de l&apos;assistant IA, avec
            un sélecteur de fenêtre <strong>7 / 30 / 90 jours</strong> en haut de la page. Changer
            la fenêtre recharge tous les chiffres ci-dessous ; si une analyse approfondie était
            affichée, elle disparaît (elle ne correspondrait plus à la nouvelle fenêtre) et il
            faut relancer le bouton pour en obtenir une nouvelle.
          </p>
          <div className="space-y-3 mb-4">
            <Chiffre
              titre="Volume d'interactions"
              ou="Somme du nombre de requêtes envoyées au chatbot chaque jour, sur la fenêtre choisie (base de données de l'assistant)."
              veut="À quel point les visiteurs utilisent l'assistant IA du site."
              lire="Une tendance à la hausse indique un engagement croissant ; une chute soudaine peut signaler un problème technique (bot désactivé, panne)."
            />
            <Chiffre
              titre="Coût IA estimé (CAD)"
              ou={
                <>
                  Calculé à partir des tokens réellement consommés (entrée + sortie), multipliés
                  par le tarif du modèle IA actuellement configuré, puis convertis en dollars
                  canadiens avec un taux de change fixe (pas un taux en direct).
                </>
              }
              veut="Ce que coûte l'assistant IA sur la période, en argent réel."
              lire={
                <>
                  C&apos;est une <strong>estimation</strong>, pas une facture exacte : le tarif du
                  modèle actuellement actif est appliqué rétroactivement à toute la fenêtre, même
                  si le modèle a changé entretemps ; et si le modèle n&apos;est pas reconnu, le
                  tarif le plus cher est utilisé par prudence (pour ne jamais sous-estimer le
                  coût). Le montant est donc plutôt une borne haute prudente qu&apos;un chiffre
                  exact.
                </>
              }
            />
            <Chiffre
              titre="Sessions et « X escaladée(s) »"
              ou="Une session = une conversation complète d'un visiteur avec le bot. Comptées sur la fenêtre choisie ; « escaladée » = le bot a marqué cette conversation comme transférée à un humain (par exemple vers le courriel d'escalade configuré dans l'assistant)."
              veut="Combien de conversations ont eu lieu, et combien d'entre elles ont dû sortir des mains du bot."
              lire="Un nombre élevé d'escalades sur peu de sessions est un signal fort à regarder en premier."
            />
            <Chiffre
              titre="Taux d'escalade"
              ou="Nombre de sessions escaladées divisé par le nombre total de sessions sur la fenêtre. Si aucune session n'existe sur la période, le taux n'est pas calculé et un tiret (—) est affiché plutôt qu'un 0 % trompeur."
              veut="À quelle fréquence le bot n'a pas suffi et a dû passer la main à un humain."
              lire="Bas = le bot se débrouille seul. En hausse = des sujets manquent probablement dans la configuration ou la FAQ de l'assistant — à corriger dans Assistant IA → Configuration."
            />
            <Chiffre
              titre="Fréquentation du site"
              ou="Comptée directement par le site public lui-même (pages vues, visites), enregistrée jour par jour."
              veut="Combien de personnes visitent le site Bleuh."
              lire={
                <>
                  Si aucune donnée n&apos;a encore été enregistrée sur la fenêtre choisie, la carte
                  affiche <strong>« En attente des premières visites »</strong> — c&apos;est normal
                  pour un site récent ou peu après une remise à zéro, pas une erreur.
                </>
              }
            />
            <Chiffre
              titre="Clics vers les détaillants (SQDC/OCS)"
              ou="Comptés par le site public quand un visiteur clique vers un point de vente (SQDC au Québec, OCS en Ontario), enregistrés jour par jour."
              veut="C'est l'équivalent d'une « conversion » : le site Bleuh ne vend pas directement, il redirige vers les détaillants, donc un clic sortant est le signe qu'un visiteur est passé à l'achat."
              lire="À mettre en relation avec la fréquentation : un ratio clics/visites en baisse peut indiquer un problème de mise en avant des produits ou des liens d'achat."
            />
            <Chiffre
              titre="Catalogue en marché"
              ou="Compte les fiches produits au statut « publié » dans la base de données, et dénombre les collections et les provinces distinctes qui y apparaissent."
              veut="La taille réelle du catalogue actuellement visible par les visiteurs, pas le nombre total de fiches créées (les brouillons et archives ne comptent pas)."
              lire="Si le catalogue est vide, la carte indique « Non instrumenté » plutôt qu'un chiffre à zéro qui prêterait à confusion."
            />
          </div>
          <SousTitre>Bouton « Lancer une vraie analyse »</SousTitre>
          <p className="text-sm mb-2">
            Réservé aux Gestionnaires et plus. Il recalcule tous les chiffres ci-dessus pour la
            fenêtre choisie, puis envoie ces chiffres à un modèle IA plus avancé (celui utilisé
            pour les analyses approfondies, différent du modèle plus léger qui génère
            automatiquement le petit résumé affiché par défaut) avec des instructions plus
            détaillées, pour produire entre 5 et 8 constats stratégiques, chacun accompagné
            d&apos;une recommandation concrète (contre 3 à 5 puces factuelles courtes pour le
            résumé automatique).
          </p>
          <p className="text-sm text-gray-500">
            Ce bouton consomme du budget IA réel (contrairement au résumé automatique déjà
            affiché) et l&apos;action est enregistrée dans le journal d&apos;audit.
          </p>
        </section>

        {/* Outils */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">🧰 Outils</h2>
          <p className="mb-3">
            La console d&apos;opérations techniques. Elle communique directement avec les
            systèmes qui alimentent le site (feuilles Google Sheets, Google Drive, SFTP
            fournisseur, API des détaillants) : lancer une synchro ici a un effet réel sur les
            données du site.
          </p>
          <SousTitre>Statut et « dernière exécution »</SousTitre>
          <p className="text-sm mb-3">
            Chaque synchro pose un horodatage seulement quand elle <strong>réussit</strong>. La
            « dernière exécution » affichée est donc le dernier <em>succès</em> connu de chaque
            tâche — pas la dernière tentative. Si une synchro échoue plusieurs fois de suite, la
            date affichée peut sembler « vieille » alors que la tâche a bien été relancée : c&apos;est
            un signal à surveiller.
          </p>
          <SousTitre>Les synchronisations, une par une</SousTitre>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>
              <strong>Ontario</strong> — relit la feuille Google Sheet maîtresse, croise les
              produits et les lots filtrés pour la province Ontario, puis réimporte le catalogue
              et les lots Ontario.
            </li>
            <li>
              <strong>Lots</strong> — relit la feuille maîtresse et une feuille secondaire de
              production (qui relie chaque lot à sa variété), puis réimporte tous les lots et
              refait la liaison Ontario.
            </li>
            <li>
              <strong>Livraisons</strong> — retrouve le dossier Google Drive du mois en cours
              (nommé en français, par ex. « MARS 2026 ») et synchronise les livraisons à partir
              des fichiers qui s&apos;y trouvent.
            </li>
            <li>
              <strong>Store locator</strong> — télécharge la feuille Google Sheet « Master DB
              Products » et resynchronise le localisateur de magasins (via l&apos;API SQDC et les
              coordonnées GPS).
            </li>
            <li>
              <strong>Inventaire web (SFTP)</strong> — va chercher elle-même le dernier fichier
              CSV sur le SFTP du fournisseur MetroGreen (remplace l&apos;ancien mécanisme
              automatique de l&apos;ancien site WordPress) et remplace entièrement
              l&apos;inventaire web existant par ce nouveau fichier.
            </li>
          </ul>
          <SousTitre>Overrides de lots</SousTitre>
          <p className="text-sm mb-2">
            Réservé aux Gestionnaires et plus. Permet de forcer manuellement l&apos;affichage
            d&apos;un ou plusieurs lots précis pour un magasin et un produit (GTIN) donnés — cela
            contourne la rotation automatique normale des lots (premier entré, premier sorti).
            C&apos;est le même mécanisme que l&apos;ancien outil du site WordPress, simplement
            déplacé ici.
          </p>
          <p className="text-sm text-gray-500">
            Champs : magasin, GTIN, lot(s) et quantités associées, quantité affichée en vitrine,
            et un seuil de fin (quantité vendue ou lot épuisé) — l&apos;override s&apos;arrête
            automatiquement une fois ce seuil atteint.
          </p>
          <p className="text-sm text-gray-500 mt-3">
            D&apos;autres outils ponctuels sont aussi disponibles sur cette page : géocodage des
            adresses Ontario, courriel de contenu manquant, brouillon de campagne MailerLite,
            import CSV d&apos;inventaire de secours, export CSV brut MetroGreen, et conversion
            ChatPot (Excel vers PDF).
          </p>
        </section>

        {/* Audit */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">📋 Audit</h2>
          <p className="mb-2">
            Le journal « qui a fait quoi » dans l&apos;application. Réservé aux Administrateurs —
            les autres rôles voient le message « Accès réservé aux administrateurs ».
          </p>
          <p className="text-sm mb-2">
            Chaque action importante (publier une configuration d&apos;assistant, lancer une
            analyse approfondie, etc.) tente d&apos;écrire une ligne ici : qui (courriel et rôle),
            quoi (une action précise), sur quoi (la cible), et parfois des détails complémentaires
            propres à l&apos;action. La liste affiche les 200 entrées les plus récentes, triées de
            la plus récente à la plus ancienne.
          </p>
          <p className="text-sm text-gray-500">
            L&apos;écriture dans ce journal est « au mieux » : si elle échoue pour une raison
            technique, l&apos;action que vous avez faite (publier, lancer une analyse, etc.)
            reste quand même effectuée normalement — seul l&apos;enregistrement dans le journal
            peut manquer.
          </p>
        </section>
      </div>

      <p className="text-center text-sm text-gray-500 mt-8">
        Vous ne voyez que ce que votre niveau d&apos;accès permet.
      </p>
    </main>
  );
}
