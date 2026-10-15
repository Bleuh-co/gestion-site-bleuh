/**
 * Tests de lib/studio-chanv-pure — détection de conversion HEIC/TIFF,
 * construction des paramètres de pagination Studio, lecture de la réponse de
 * check-duplicates. Lancé par `npm test` (voir acquisition-pure.test.ts pour
 * la convention).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStudioAssetListParams,
  convertedFilename,
  detectStudioConversion,
  parseStudioDuplicateCheck,
} from "./studio-chanv-pure.ts";

test("detectStudioConversion : reconnaît HEIC et TIFF par type MIME", () => {
  assert.equal(detectStudioConversion("image/heic", null), "heic");
  assert.equal(detectStudioConversion("image/heif", null), "heic");
  assert.equal(detectStudioConversion("image/tiff", null), "tiff");
  assert.equal(detectStudioConversion("image/x-tiff", null), "tiff");
  assert.equal(detectStudioConversion("image/jpeg", null), null);
});

test("detectStudioConversion : retombe sur l'extension quand le MIME ne tranche pas", () => {
  assert.equal(detectStudioConversion("application/octet-stream", "photo.HEIC"), "heic");
  assert.equal(detectStudioConversion("application/octet-stream", "scan.tif"), "tiff");
  assert.equal(detectStudioConversion("application/octet-stream", "photo.png"), null);
  assert.equal(detectStudioConversion("", null), null);
});

test("convertedFilename : remplace l'extension d'origine par .jpg", () => {
  assert.equal(convertedFilename("photo.heic", "asset-123"), "photo.jpg");
  assert.equal(convertedFilename("scan.TIFF", "asset-123"), "scan.jpg");
  assert.equal(convertedFilename(null, "asset-123"), "asset-123.jpg");
  assert.equal(convertedFilename("", ""), "image.jpg");
});

test("buildStudioAssetListParams : mode parcourir (pas de recherche) envoie le curseur, jamais page", () => {
  const params = buildStudioAssetListParams({
    brand: "bleuh",
    assetType: "image",
    limit: 60,
    search: "",
    cursor: "abc123",
    page: 7,
  });
  assert.equal(params.get("cursor"), "abc123");
  assert.equal(params.get("page"), null);
  assert.equal(params.get("search"), null);
  assert.equal(params.get("brand"), "bleuh");
  assert.equal(params.get("limit"), "60");
});

test("buildStudioAssetListParams : mode recherche envoie page, jamais cursor", () => {
  const params = buildStudioAssetListParams({
    brand: "bleuh",
    assetType: "image",
    limit: 60,
    search: "  Candy Kush  ",
    cursor: "abc123",
    page: 2,
  });
  assert.equal(params.get("search"), "Candy Kush");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("cursor"), null);
});

test("buildStudioAssetListParams : page par défaut à 1, jamais 0 ou négative", () => {
  const params = buildStudioAssetListParams({
    brand: "bleuh",
    assetType: "image",
    limit: 60,
    search: "kush",
    page: 0,
  });
  assert.equal(params.get("page"), "1");
});

test("parseStudioDuplicateCheck : lit la liste de hachages dupliqués", () => {
  const { duplicateHashes } = parseStudioDuplicateCheck({
    duplicate_hashes: ["aa", "bb"],
    duplicate_count: 2,
    total_checked: 3,
  });
  assert.equal(duplicateHashes.size, 2);
  assert.ok(duplicateHashes.has("aa"));
  assert.ok(duplicateHashes.has("bb"));
  assert.ok(!duplicateHashes.has("cc"));
});

test("parseStudioDuplicateCheck : réponse absente ou malformée → ensemble vide", () => {
  assert.equal(parseStudioDuplicateCheck(null).duplicateHashes.size, 0);
  assert.equal(parseStudioDuplicateCheck({}).duplicateHashes.size, 0);
  assert.equal(parseStudioDuplicateCheck({ duplicate_hashes: "aa" }).duplicateHashes.size, 0);
  assert.equal(parseStudioDuplicateCheck({ duplicate_hashes: [1, "aa", null] }).duplicateHashes.size, 1);
});
