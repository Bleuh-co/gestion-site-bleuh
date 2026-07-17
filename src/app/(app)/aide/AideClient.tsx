"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  return (
    <div
      className="rounded-xl p-4"
      style={{ border: "1px solid var(--chanv-fibre)" }}
    >
      <p className="font-bold mb-2">{titre}</p>
      <p className="text-sm mb-1.5 leading-relaxed">
        <span className="font-semibold">{t("aide.chiffreSource")}</span> {ou}
      </p>
      <p className="text-sm mb-1.5 leading-relaxed">
        <span className="font-semibold">{t("aide.chiffreMeaning")}</span> {veut}
      </p>
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">{t("aide.chiffreRead")}</span> {lire}
      </p>
    </div>
  );
}

function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-bold mt-6 mb-3">{children}</h3>;
}

export function AideClient({ denied = false }: { denied?: boolean }) {
  const t = useT();

  if (denied) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-bold mb-6">{t("aide.title")}</h1>
        <div className="card p-8 text-center text-gray-400">
          <p>{t("aide.accessDenied")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-2">{t("aide.title")}</h1>
      <p className="text-gray-500 mb-8">{t("aide.intro")}</p>

      <div className="space-y-6">
        {/* Introduction */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.welcomeTitle")}</h2>
          <p className="mb-4">{t("aide.welcomeBody")}</p>
          <p className="mb-3 font-semibold">{t("aide.accessLevelIntro")}</p>
          <div className="flex flex-wrap gap-2">
            <span className="badge-neutral">{t("aide.badgeConsulter")}</span>
            <span className="badge-neutral">{t("aide.badgeGestionnaire")}</span>
            <span className="badge-accent">{t("aide.badgeAdmin")}</span>
          </div>
        </section>

        {/* Produits */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.produitsTitle")}</h2>
          <p className="mb-3">
            {t("aide.produitsIntro1")}{" "}
            <code>products</code>
            {t("aide.produitsIntro2")}
          </p>
          <p className="mb-2">
            {t("aide.produitsRolesLead")}
            <strong>{t("aide.produitsRoleCreer")}</strong>
            {t("aide.produitsRolesSep1")}
            <strong>{t("aide.produitsRoleModifier")}</strong>
            {t("aide.produitsRolesSep2")}
            <strong>{t("aide.produitsRoleSupprimer")}</strong>
            {t("aide.produitsRolesEnd")}
          </p>
          <SousTitre>{t("aide.produitsFilterTitle")}</SousTitre>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>
              <strong>{t("aide.produitsFilterCollectionLabel")}</strong>
              {t("aide.produitsFilterCollectionBody")}
            </li>
            <li>
              <strong>{t("aide.produitsFilterProvinceLabel")}</strong>
              {t("aide.produitsFilterProvinceBody")}
            </li>
            <li>
              <strong>{t("aide.produitsFilterStatutLabel")}</strong>
              {t("aide.produitsFilterStatutSep0")}
              <em>{t("aide.produitsFilterStatutDraft")}</em>
              {t("aide.produitsFilterStatutDraftNote")}
              <em>{t("aide.produitsFilterStatutPublished")}</em>
              {t("aide.produitsFilterStatutPublishedNote")}
              <em>{t("aide.produitsFilterStatutArchived")}</em>
              {t("aide.produitsFilterStatutArchivedNote")}
            </li>
            <li>
              <strong>{t("aide.produitsFilterSearchLabel")}</strong>
              {t("aide.produitsFilterSearchBody")}
            </li>
          </ul>
          <SousTitre>{t("aide.produitsFicheTitle")}</SousTitre>
          <p className="text-sm">{t("aide.produitsFicheBody")}</p>
        </section>

        {/* Assistant IA */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.assistantTitle")}</h2>
          <p className="mb-3">{t("aide.assistantIntro")}</p>
          <SousTitre>{t("aide.assistantConfigTitle")}</SousTitre>
          <p className="text-sm mb-2">{t("aide.assistantConfigBody1")}</p>
          <p className="text-sm">{t("aide.assistantConfigBody2")}</p>
          <SousTitre>{t("aide.assistantSandboxTitle")}</SousTitre>
          <p className="text-sm">
            {t("aide.assistantSandboxBody1")}
            <strong>{t("aide.assistantSandboxAvant")}</strong>
            {t("aide.assistantSandboxBody2")}
          </p>
          <SousTitre>{t("aide.assistantAutotestTitle")}</SousTitre>
          <p className="text-sm">{t("aide.assistantAutotestBody")}</p>
          <SousTitre>{t("aide.assistantTranscriptsTitle")}</SousTitre>
          <p className="text-sm mb-3">{t("aide.assistantTranscriptsBody")}</p>
          <div className="space-y-3">
            <Chiffre
              titre={t("aide.chiffreVolumeJourTitre")}
              ou={t("aide.chiffreVolumeJourOu")}
              veut={t("aide.chiffreVolumeJourVeut")}
              lire={t("aide.chiffreVolumeJourLire")}
            />
            <Chiffre
              titre={t("aide.chiffreTauxEscaladeStatsTitre")}
              ou={t("aide.chiffreTauxEscaladeStatsOu")}
              veut={t("aide.chiffreTauxEscaladeStatsVeut")}
              lire={t("aide.chiffreTauxEscaladeStatsLire")}
            />
            <Chiffre
              titre={t("aide.chiffreDepenseJourTitre")}
              ou={t("aide.chiffreDepenseJourOu")}
              veut={t("aide.chiffreDepenseJourVeut")}
              lire={t("aide.chiffreDepenseJourLire")}
            />
          </div>
        </section>

        {/* Analyse CEO */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.ceoTitle")}</h2>
          <p className="mb-3">
            {t("aide.ceoIntro1")}
            <strong>{t("aide.ceoIntroWindow")}</strong>
            {t("aide.ceoIntro2")}
          </p>
          <div className="space-y-3 mb-4">
            <Chiffre
              titre={t("aide.chiffreVolumeInteractionsTitre")}
              ou={t("aide.chiffreVolumeInteractionsOu")}
              veut={t("aide.chiffreVolumeInteractionsVeut")}
              lire={t("aide.chiffreVolumeInteractionsLire")}
            />
            <Chiffre
              titre={t("aide.chiffreCoutIaTitre")}
              ou={t("aide.chiffreCoutIaOu")}
              veut={t("aide.chiffreCoutIaVeut")}
              lire={
                <>
                  {t("aide.chiffreCoutIaLire1")}
                  <strong>{t("aide.chiffreCoutIaLireEstimation")}</strong>
                  {t("aide.chiffreCoutIaLire2")}
                </>
              }
            />
            <Chiffre
              titre={t("aide.chiffreSessionsTitre")}
              ou={t("aide.chiffreSessionsOu")}
              veut={t("aide.chiffreSessionsVeut")}
              lire={t("aide.chiffreSessionsLire")}
            />
            <Chiffre
              titre={t("aide.chiffreTauxEscaladeTitre")}
              ou={t("aide.chiffreTauxEscaladeOu")}
              veut={t("aide.chiffreTauxEscaladeVeut")}
              lire={t("aide.chiffreTauxEscaladeLire")}
            />
            <Chiffre
              titre={t("aide.chiffreFrequentationTitre")}
              ou={t("aide.chiffreFrequentationOu")}
              veut={t("aide.chiffreFrequentationVeut")}
              lire={
                <>
                  {t("aide.chiffreFrequentationLire1")}
                  <strong>{t("aide.chiffreFrequentationLireBadge")}</strong>
                  {t("aide.chiffreFrequentationLire2")}
                </>
              }
            />
            <Chiffre
              titre={t("aide.chiffreClicsTitre")}
              ou={t("aide.chiffreClicsOu")}
              veut={t("aide.chiffreClicsVeut")}
              lire={t("aide.chiffreClicsLire")}
            />
            <Chiffre
              titre={t("aide.chiffreCatalogueTitre")}
              ou={t("aide.chiffreCatalogueOu")}
              veut={t("aide.chiffreCatalogueVeut")}
              lire={t("aide.chiffreCatalogueLire")}
            />
          </div>
          <SousTitre>{t("aide.ceoRealAnalysisTitle")}</SousTitre>
          <p className="text-sm mb-2">{t("aide.ceoRealAnalysisBody1")}</p>
          <p className="text-sm text-gray-500">{t("aide.ceoRealAnalysisBody2")}</p>
        </section>

        {/* Outils */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.outilsTitle")}</h2>
          <p className="mb-3">{t("aide.outilsIntro")}</p>
          <SousTitre>{t("aide.outilsStatutTitle")}</SousTitre>
          <p className="text-sm mb-3">
            {t("aide.outilsStatutBody1")}
            <strong>{t("aide.outilsStatutReussit")}</strong>
            {t("aide.outilsStatutBody2")}
            <em>{t("aide.outilsStatutSucces")}</em>
            {t("aide.outilsStatutBody3")}
          </p>
          <SousTitre>{t("aide.outilsSyncsTitle")}</SousTitre>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>
              <strong>{t("aide.outilsSyncOntarioLabel")}</strong>
              {t("aide.outilsSyncOntarioBody")}
            </li>
            <li>
              <strong>{t("aide.outilsSyncLotsLabel")}</strong>
              {t("aide.outilsSyncLotsBody")}
            </li>
            <li>
              <strong>{t("aide.outilsSyncLivraisonsLabel")}</strong>
              {t("aide.outilsSyncLivraisonsBody")}
            </li>
            <li>
              <strong>{t("aide.outilsSyncStoreLocatorLabel")}</strong>
              {t("aide.outilsSyncStoreLocatorBody")}
            </li>
            <li>
              <strong>{t("aide.outilsSyncInventaireLabel")}</strong>
              {t("aide.outilsSyncInventaireBody")}
            </li>
          </ul>
          <SousTitre>{t("aide.outilsOverridesTitle")}</SousTitre>
          <p className="text-sm mb-2">{t("aide.outilsOverridesBody1")}</p>
          <p className="text-sm text-gray-500">{t("aide.outilsOverridesBody2")}</p>
          <p className="text-sm text-gray-500 mt-3">{t("aide.outilsOverridesBody3")}</p>
        </section>

        {/* Audit */}
        <section className="section-card">
          <h2 className="text-lg font-bold mb-3">{t("aide.auditTitle")}</h2>
          <p className="mb-2">{t("aide.auditBody1")}</p>
          <p className="text-sm mb-2">{t("aide.auditBody2")}</p>
          <p className="text-sm text-gray-500">{t("aide.auditBody3")}</p>
        </section>
      </div>

      <p className="text-center text-sm text-gray-500 mt-8">{t("aide.footer")}</p>
    </main>
  );
}
