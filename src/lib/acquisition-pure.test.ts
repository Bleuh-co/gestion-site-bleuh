/**
 * Tests de lib/acquisition-pure — volet « Frictions sur le site ».
 *
 * Lancé par `npm test` (vitest depuis le lot L9 ; d'abord `node --test`).
 * Les modules serveur se testent sous test/, avec l'alias `@/` et la doublure
 * de `server-only` de vitest.config.ts.
 */

import { test } from "vitest";
import assert from "node:assert/strict";

import {
  aggregateFrictions,
  aggregateRetailerClicks,
  buildAcquisitionReport,
  formatFrictionOutcome,
  type FrictionInput,
  type RetailerClickInput,
} from "./acquisition-pure.ts";

test("aggregateFrictions : recolle la même signature à travers plusieurs jours", () => {
  const rows: FrictionInput[] = [
    { id: "echec_api_abc", type: "echec_api", page: "/fr/produit/x", libelle: "GET /api/x", statut: 500, n: 3, date: "2026-09-28" },
    { id: "echec_api_abc", type: "echec_api", page: "/fr/produit/x", libelle: "GET /api/x", statut: 500, n: 2, date: "2026-09-29" },
    { id: "clic_mort_def", type: "clic_mort", page: "/fr", libelle: "button.hero", statut: null, n: 1, date: "2026-09-28" },
  ];
  const out = aggregateFrictions(rows);
  assert.equal(out.length, 2);
  const [first, second] = out;
  // Triée par nombre décroissant : la friction API (5) passe avant le clic mort (1).
  assert.equal(first.id, "echec_api_abc");
  assert.equal(first.count, 5);
  assert.equal(first.lastDay, "2026-09-29", "garde le jour le plus récent, pas le premier lu");
  assert.equal(second.id, "clic_mort_def");
  assert.equal(second.count, 1);
});

test("aggregateFrictions : un type inconnu ou absent retombe sur « autres »", () => {
  const [row] = aggregateFrictions([
    { id: "x", type: "quelque_chose_dinconnu", page: "/fr", libelle: "x", n: 1, date: "2026-09-28" },
  ]);
  assert.equal(row.type, "autres");
});

test("aggregateFrictions : une ligne sans identifiant est ignorée", () => {
  const out = aggregateFrictions([
    { id: "", type: "clic_mort", page: "/fr", libelle: "x", n: 1, date: "2026-09-28" } as unknown as FrictionInput,
  ]);
  assert.equal(out.length, 0);
});

test("aggregateFrictions : n manquant ou non numérique compte pour 0, la page à défaut est «—»", () => {
  const [row] = aggregateFrictions([{ id: "x", type: "clic_mort", libelle: "x", n: "beaucoup", date: "2026-09-28" }]);
  assert.equal(row.count, 0);
  assert.equal(row.page, "—");
});

test("formatFrictionOutcome : ajoute le statut quand il y en a un", () => {
  assert.equal(formatFrictionOutcome("GET /api/produits", 500), "GET /api/produits · 500");
  assert.equal(formatFrictionOutcome("GET /api/produits", null), "GET /api/produits");
  assert.equal(formatFrictionOutcome("", null), "—");
});

test("buildAcquisitionReport : porte les frictions agrégées dans le rapport", () => {
  const report = buildAcquisitionReport({
    trafficSources: [],
    pages: [],
    frictions: [
      { id: "erreur_js_1", type: "erreur_js", page: "/fr", libelle: "x is undefined", n: 4, date: "2026-09-29" },
    ],
    days: ["2026-09-29"],
  });
  assert.equal(report.frictions.length, 1);
  assert.equal(report.frictions[0].count, 4);
  // N'affecte pas le statut « mesure en attente », qui ne regarde que les sessions.
  assert.equal(report.trafficPending, true);
});

// ─────────────────────────────────────────────────────────────
// Lot L5 (plan publicite-bdion, 06-07/11/2026) — clics vers un détaillant
// ─────────────────────────────────────────────────────────────

test("aggregateRetailerClicks : recolle la même signature à travers plusieurs jours", () => {
  const rows: RetailerClickInput[] = [
    {
      id: "fiche_produit~on~blh-r1-wildberry-nouveau-ontario~clip1-916-en~bleuh-original-wildberry",
      chemin: "fiche_produit",
      zone: "on",
      utmCampaign: "blh-r1-wildberry-nouveau-ontario",
      utmContent: "clip1-916-en",
      productId: "bleuh-original-wildberry",
      productName: "Bleuh Original Wildberry",
      count: 3,
      date: "2026-11-10",
    },
    {
      id: "fiche_produit~on~blh-r1-wildberry-nouveau-ontario~clip1-916-en~bleuh-original-wildberry",
      chemin: "fiche_produit",
      zone: "on",
      utmCampaign: "blh-r1-wildberry-nouveau-ontario",
      utmContent: "clip1-916-en",
      productId: "bleuh-original-wildberry",
      productName: "Bleuh Original Wildberry",
      count: 2,
      date: "2026-11-11",
    },
    {
      id: "pied_de_page~qc~-~-~-",
      chemin: "pied_de_page",
      zone: "qc",
      utmCampaign: null,
      utmContent: null,
      productId: null,
      productName: null,
      count: 1,
      date: "2026-11-10",
    },
  ];
  const out = aggregateRetailerClicks(rows);
  assert.equal(out.length, 2);
  const [first, second] = out;
  // Triée par nombre décroissant : la fiche produit (5) passe avant le pied de page (1).
  assert.equal(first.chemin, "fiche_produit");
  assert.equal(first.zone, "on");
  assert.equal(first.campaign, "blh-r1-wildberry-nouveau-ontario");
  assert.equal(first.creation, "clip1-916-en");
  assert.equal(first.product, "Bleuh Original Wildberry");
  assert.equal(first.clicks, 5);
  assert.equal(first.lastDay, "2026-11-11", "garde le jour le plus récent, pas le premier lu");
  assert.equal(second.chemin, "pied_de_page");
  assert.equal(second.campaign, "—", "sans campagne (clic direct) : un tiret, jamais une chaîne vide");
  assert.equal(second.clicks, 1);
});

test("aggregateRetailerClicks : un chemin inconnu ou absent retombe sur « autre »", () => {
  const [row] = aggregateRetailerClicks([
    { id: "x", chemin: "chemin_pas_prevu", zone: "qc", count: 1, date: "2026-11-10" },
  ]);
  assert.equal(row.chemin, "autre");
});

test("aggregateRetailerClicks : une zone hors qc/on retombe sur un tiret, jamais sur la zone du site (ca)", () => {
  const [row] = aggregateRetailerClicks([
    { id: "x", chemin: "localisateur", zone: "ca", count: 1, date: "2026-11-10" },
  ]);
  assert.equal(row.zone, "—");
});

test("aggregateRetailerClicks : une ligne sans identifiant est ignorée", () => {
  const out = aggregateRetailerClicks([
    { id: "", chemin: "localisateur", zone: "qc", count: 1, date: "2026-11-10" } as unknown as RetailerClickInput,
  ]);
  assert.equal(out.length, 0);
});

test("aggregateRetailerClicks : count manquant ou non numérique compte pour 0", () => {
  const [row] = aggregateRetailerClicks([
    { id: "x", chemin: "localisateur", zone: "qc", count: "beaucoup", date: "2026-11-10" },
  ]);
  assert.equal(row.clicks, 0);
});

test("buildAcquisitionReport : porte les clics vers un détaillant agrégés dans le rapport", () => {
  const report = buildAcquisitionReport({
    trafficSources: [],
    pages: [],
    frictions: [],
    retailerClicks: [
      { id: "wildberry~on~blh-r1~clip1~bleuh-original-wildberry", chemin: "wildberry", zone: "on", count: 2, date: "2026-11-10" },
    ],
    days: ["2026-11-10"],
  });
  assert.equal(report.retailerClicks.length, 1);
  assert.equal(report.retailerClicks[0].clicks, 2);
});

test("buildAcquisitionReport : sans retailerClicks (appelant ou test antérieur à ce lot), rend une liste vide plutôt que de planter", () => {
  const report = buildAcquisitionReport({ trafficSources: [], pages: [], frictions: [], days: [] });
  assert.deepEqual(report.retailerClicks, []);
});
