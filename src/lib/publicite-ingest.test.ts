/**
 * Jeton de service Studio → Marketing Bleuh (lot L5, plan publicite-bdion,
 * 06-07/11/2026) : refuse sans clé posée, refuse sans en-tête, refuse un
 * jeton différent (même de même longueur, pour exercer la comparaison en
 * temps constant et pas seulement la garde de longueur), accepte le bon.
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { hasPubliciteIngestKey } from "./publicite-ingest.ts";

function requeteAvec(enTete?: string): Request {
  const headers: Record<string, string> = {};
  if (enTete !== undefined) headers["x-publicite-ingest-key"] = enTete;
  return new Request("http://localhost/api/publicite/retailer-clicks", { headers });
}

test("refuse quand PUBLICITE_INGEST_KEY n'est pas posée, même avec un en-tête", () => {
  delete process.env.PUBLICITE_INGEST_KEY;
  assert.equal(hasPubliciteIngestKey(requeteAvec("peu-importe")), false);
});

test("refuse sans en-tête, même si la clé est posée", () => {
  process.env.PUBLICITE_INGEST_KEY = "le-bon-jeton";
  try {
    assert.equal(hasPubliciteIngestKey(requeteAvec()), false);
  } finally {
    delete process.env.PUBLICITE_INGEST_KEY;
  }
});

test("accepte le bon jeton", () => {
  process.env.PUBLICITE_INGEST_KEY = "le-bon-jeton";
  try {
    assert.equal(hasPubliciteIngestKey(requeteAvec("le-bon-jeton")), true);
  } finally {
    delete process.env.PUBLICITE_INGEST_KEY;
  }
});

test("refuse un jeton différent, de longueur différente ou identique", () => {
  process.env.PUBLICITE_INGEST_KEY = "le-bon-jeton";
  try {
    assert.equal(hasPubliciteIngestKey(requeteAvec("le-mauvais-jeton-plus-long")), false);
    assert.equal(hasPubliciteIngestKey(requeteAvec("le-bon-jetan")), false); // même longueur, 1 caractère différent
  } finally {
    delete process.env.PUBLICITE_INGEST_KEY;
  }
});
