#!/usr/bin/env node
/**
 * Range en fiches les pages de bleuh.co faites avant l'espace « Pages
 * d'atterrissage » de Marketing Bleuh (plan « Pages d'atterrissage et
 * infolettres », 22/10/2026, lot L10).
 *
 * À LANCER SOI-MÊME, une fois : le déploiement ne le fait pas.
 *   node scripts/amorcer-atterrissages.mjs            → montre ce qui serait écrit
 *   node scripts/amorcer-atterrissages.mjs --ecrire   → écrit
 *
 * Identifiants : les ADC du poste (gcloud auth application-default login), qui
 * écrivent dans antigravity-20260107. Une fiche qui existe déjà n'est JAMAIS
 * réécrite (`create`, pas `set`) : Daphnée a pu la régler entre-temps. Un
 * produit absent du catalogue est retiré de la fiche, et dit.
 *
 * Les fiches naissent « livrées » et allumées : ces pages sont en ligne depuis
 * leur début, les visiteurs ne doivent voir aucune différence.
 */
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ECRIRE = process.argv.includes("--ecrire");
const PROJET = process.env.FIRESTORE_PROJECT || "antigravity-20260107";
const COLLECTION = "bleuh_site_atterrissages";
const { fiches } = JSON.parse(readFileSync(new URL("./atterrissages-existantes.json", import.meta.url), "utf8"));

initializeApp({ credential: applicationDefault(), projectId: PROJET });
const db = getFirestore();
const maintenant = new Date().toISOString();

for (const [id, f] of Object.entries(fiches)) {
  const ref = db.collection(COLLECTION).doc(id);
  if ((await ref.get()).exists) {
    console.log(`= ${id} : fiche déjà là, laissée telle quelle.`);
    continue;
  }
  const produits = [];
  for (const p of f.produits) {
    if ((await db.collection("products").doc(p).get()).exists) produits.push(p);
    else console.warn(`  ! ${id} : produit « ${p} » absent du catalogue, retiré de la fiche.`);
  }
  const doc = {
    nom: f.nom,
    adresse: f.adresse,
    zones: f.zones,
    langues: f.langues,
    active: true,
    livree: true,
    debut: f.debut,
    fin: null,
    apercu: null,
    visibilite: "publique",
    apres: "terminee",
    renvoi: null,
    produits,
    demande: null,
    note: f.note,
    rangee_le: maintenant,
    cree_le: maintenant,
    cree_par: "amorcer-atterrissages.mjs",
  };
  if (!ECRIRE) {
    console.log(`+ ${id} (à écrire) :`, JSON.stringify(doc));
    continue;
  }
  await ref.create(doc);
  console.log(`+ ${id} : fiche créée (${f.zones.join("+")}, dès le ${f.debut}, ${produits.length} produit(s)).`);
}
if (!ECRIRE) console.log("\nRien n'est écrit. Relancer avec --ecrire.");
