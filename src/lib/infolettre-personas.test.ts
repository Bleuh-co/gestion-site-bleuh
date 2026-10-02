/**
 * Tests de lib/infolettre-personas — répartition des abonnés par persona
 * (onglet Groupes de l'Infolettre).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PERSONAS, tallyPersonas } from "./infolettre-personas.ts";

test("PERSONAS : les trois valeurs enregistrées par le formulaire de bleuh.co", () => {
  assert.deepEqual(
    PERSONAS.map((p) => p.value),
    ["Consumer", "Budtender", "Retailer"]
  );
});

test("tallyPersonas : compte chaque persona, les vides et les valeurs inconnues", () => {
  assert.deepEqual(
    tallyPersonas(["Consumer", "Budtender", "Budtender", "Retailer", "", null, undefined, "Influenceur"]),
    { Consumer: 1, Budtender: 2, Retailer: 1, other: 1, none: 3 }
  );
});

test("tallyPersonas : ignore la casse et les espaces d'une saisie à la main", () => {
  assert.deepEqual(tallyPersonas([" budtender ", "RETAILER", "   "]), {
    Consumer: 0,
    Budtender: 1,
    Retailer: 1,
    other: 0,
    none: 1,
  });
});

test("tallyPersonas : liste vide → tout à zéro", () => {
  assert.deepEqual(tallyPersonas([]), { Consumer: 0, Budtender: 0, Retailer: 0, other: 0, none: 0 });
});
