import { requireRead } from "@/lib/auth-server";

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
        Un guide simple pour comprendre l&apos;application et ce que vous pouvez y faire.
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
          <p>
            C&apos;est le catalogue des produits Bleuh. Vous pouvez consulter la liste complète
            et ouvrir une fiche pour voir ses détails. Selon votre rôle, vous pouvez aussi{" "}
            <strong>créer</strong>, <strong>modifier</strong> ou <strong>supprimer</strong> une
            fiche produit.
          </p>
        </section>

        {/* Assistant IA */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">🤖 Assistant IA</h2>
          <p className="mb-2">
            C&apos;est ici que se gère le chatbot du site. Vous y trouverez :
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>La configuration</strong> : la personnalité et les consignes données à l&apos;assistant.</li>
            <li><strong>Le bac à sable</strong> : un espace pour tester des questions avant qu&apos;elles arrivent aux visiteurs.</li>
            <li><strong>L&apos;historique</strong> : les conversations (transcripts) déjà eues avec les visiteurs.</li>
            <li><strong>Les statistiques</strong> : le volume d&apos;utilisation de l&apos;assistant.</li>
          </ul>
        </section>

        {/* Analyse CEO */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">📊 Analyse CEO</h2>
          <p className="mb-2">
            Un tableau de bord de la performance du site vitrine et de l&apos;assistant IA :
            fréquentation du site, clics vers les détaillants (SQDC/OCS — le site ne vend pas
            directement, il redirige vers eux, c&apos;est ça la « conversion »), taille du
            catalogue en marché, et le coût de l&apos;IA (en dollars canadiens).
          </p>
          <p className="mb-2">
            Un bouton <strong>« Lancer une vraie analyse »</strong> permet de générer une courte
            synthèse stratégique rédigée par IA à partir de ces chiffres.
          </p>
          <p className="text-sm text-gray-500">
            Certaines cartes peuvent afficher « En attente des premières visites » : c&apos;est
            normal tant qu&apos;il n&apos;y a pas encore de données réelles à afficher.
          </p>
        </section>

        {/* Outils */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">🧰 Outils</h2>
          <p>
            La console d&apos;opérations techniques. Vous pouvez y voir le statut des
            synchronisations, lancer des synchros ou des exports à la demande, et — réservé aux
            Gestionnaires et plus — gérer les overrides de lots.
          </p>
        </section>

        {/* Audit */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">📋 Audit</h2>
          <p>
            Le journal « qui a fait quoi » dans l&apos;application. Réservé aux Administrateurs.
          </p>
        </section>
      </div>

      <p className="text-center text-sm text-gray-500 mt-8">
        Vous ne voyez que ce que votre niveau d&apos;accès permet.
      </p>
    </main>
  );
}
