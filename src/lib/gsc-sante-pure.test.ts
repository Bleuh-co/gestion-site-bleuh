/**
 * Tests de lib/gsc-sante-pure — santé Google (plan du site, vieilles pages).
 * Les cas viennent du relevé réel du 06/11/2026 sur bleuh.co et maisondherbes.com.
 */

import { test } from "vitest";
import assert from "node:assert/strict";

import {
  aggregateShownPages,
  classifyChain,
  headerHasNoindex,
  htmlHasNoindex,
  isNormalizationHop,
  parseRobotsSitemaps,
  santeWindow,
  searchConsoleUrl,
  siteOrigin,
  sitemapsToRecheck,
  sitemapsToSubmit,
  sortSignals,
  type GscPageSignal,
  type ProbeHop,
} from "./gsc-sante-pure.ts";

const hop = (url: string, status: number | null, location: string | null = null, extra: Partial<ProbeHop> = {}): ProbeHop => ({
  url,
  status,
  location,
  ...extra,
});

test("santeWindow : 7 jours publiés, J-8 → J-2", () => {
  assert.deepEqual(santeWindow(new Date("2026-11-06T11:45:00Z")), { start: "2026-10-29", end: "2026-11-04" });
});

test("siteOrigin : propriété Domaine ou Préfixe d'URL", () => {
  assert.equal(siteOrigin("sc-domain:bleuh.co"), "https://bleuh.co");
  assert.equal(siteOrigin("https://maisondherbes.com/"), "https://maisondherbes.com");
});

test("parseRobotsSitemaps : lignes Sitemap, casse libre, sans doublon", () => {
  const robots = "User-agent: *\nAllow: /\nSitemap: https://bleuh.co/sitemap.xml\nsitemap:https://bleuh.co/sitemap.xml\r\nSITEMAP: /relatif.xml\n";
  assert.deepEqual(parseRobotsSitemaps(robots), ["https://bleuh.co/sitemap.xml"]);
});

test("plans : envoyer l'annoncé manquant, relire seulement les déclarés non annoncés", () => {
  const expected = ["https://bleuh.co/sitemap.xml"];
  const declared = ["https://bleuh.co/sitemap_index.xml"];
  assert.deepEqual(sitemapsToSubmit(expected, declared), ["https://bleuh.co/sitemap.xml"]);
  assert.deepEqual(sitemapsToRecheck(expected, declared), ["https://bleuh.co/sitemap_index.xml"]);
  assert.deepEqual(sitemapsToRecheck(expected, expected), []);
});

test("isNormalizationHop : https, www, barre finale, préfixe de langue", () => {
  assert.ok(isNormalizationHop("http://bleuh.co/", "https://bleuh.co/"));
  assert.ok(isNormalizationHop("https://www.bleuh.co/", "https://bleuh.co/"));
  assert.ok(isNormalizationHop("https://bleuh.co/fr/", "/fr"));
  assert.ok(isNormalizationHop("https://bleuh.co/", "/fr"));
  assert.ok(isNormalizationHop("https://bleuh.co/produit/h27-indica", "/fr/produit/h27-indica"));
  assert.ok(!isNormalizationHop("https://bleuh.co/en/nous", "/en/our-story"));
  assert.ok(!isNormalizationHop("https://bleuh.co/en/product/sky-sativa", "/en"));
  assert.ok(!isNormalizationHop("https://bleuh.co/a?x=1", "/fr/a"), "la requête compte");
});

test("classifyChain : page saine, normalisée ou servie en 200", () => {
  assert.equal(classifyChain([hop("https://bleuh.co/fr/notre-histoire", 200)]), null);
  assert.equal(
    classifyChain([
      hop("http://bleuh.co/", 302, "https://bleuh.co/"),
      hop("https://bleuh.co/", 307, "https://bleuh.co/fr"),
      hop("https://bleuh.co/fr", 200),
    ]),
    null
  );
});

test("classifyChain : déplacée (permanente) — Google suivra seul", () => {
  const r = classifyChain([
    hop("https://bleuh.co/en/nous", 308, "https://bleuh.co/en/our-story"),
    hop("https://bleuh.co/en/our-story", 200),
  ]);
  assert.deepEqual(r, {
    kind: "deplacee",
    status: 308,
    finalUrl: "https://bleuh.co/en/our-story",
    finalStatus: 200,
  });
});

test("classifyChain : produit retiré renvoyé vers l'accueil", () => {
  const r = classifyChain([
    hop("https://bleuh.co/en/product/sky-sativa", 307, "https://bleuh.co/en"),
    hop("https://bleuh.co/en", 200),
  ]);
  assert.equal(r?.kind, "accueil");
});

test("classifyChain : redirection temporaire vers une autre page", () => {
  const r = classifyChain([
    hop("https://maisondherbes.com/produit/creme-musculaire-60ml/", 307, "https://maisondherbes.com/produit/creme-musculaire-chanv/"),
    hop("https://maisondherbes.com/produit/creme-musculaire-chanv/", 200),
  ]);
  assert.equal(r?.kind, "temporaire");
});

test("classifyChain : introuvable, même au bout d'une redirection", () => {
  assert.equal(classifyChain([hop("https://maisondherbes.com/en/aide/x/", 404)])?.kind, "introuvable");
  const r = classifyChain([
    hop("https://bleuh.co/produit/x/", 308, "https://bleuh.co/produit/x"),
    hop("https://bleuh.co/produit/x", 410),
  ]);
  assert.equal(r?.kind, "introuvable");
  assert.equal(r?.finalStatus, 410);
});

test("classifyChain : noindex, erreur réseau, 5xx, chaîne sans fin", () => {
  assert.equal(classifyChain([hop("https://bleuh.co/fr/x", 200, null, { noindex: true })])?.kind, "noindex");
  assert.equal(classifyChain([hop("https://bleuh.co/fr/x", null, null, { error: "délai" })])?.kind, "erreur");
  assert.equal(classifyChain([hop("https://bleuh.co/fr/x", 503)])?.kind, "erreur");
  assert.equal(
    classifyChain([hop("https://bleuh.co/a", 308, "https://bleuh.co/b"), hop("https://bleuh.co/b", 308, "https://bleuh.co/a")])?.kind,
    "erreur"
  );
});

test("classifyChain : ancien site resté en ligne sur un autre hôte de la propriété", () => {
  const old = [hop("https://old.maisondherbes.com/notre-boutique/", 200)];
  assert.equal(classifyChain(old, "maisondherbes.com")?.kind, "autre_hote");
  assert.equal(classifyChain(old), null, "sans hôte principal, pas de jugement");
  // www et une page du site principal redirigée ailleurs ne sont pas « autre hôte ».
  assert.equal(classifyChain([hop("https://www.bleuh.co/fr", 200)], "bleuh.co"), null);
  assert.equal(
    classifyChain(
      [hop("https://old.maisondherbes.com/boutique/", 301, "https://maisondherbes.com/boutique/"), hop("https://maisondherbes.com/boutique/", 200)],
      "maisondherbes.com"
    )?.kind,
    "deplacee"
  );
  assert.equal(
    classifyChain(
      [hop("https://bleuh.co/fr/boutique", 308, "https://bleuh.shop/"), hop("https://bleuh.shop/", 200)],
      "bleuh.co"
    )?.kind,
    "deplacee",
    "l'accueil d'un autre domaine n'est pas « renvoyée vers l'accueil »"
  );
  assert.equal(
    classifyChain(
      [hop("https://old.maisondherbes.com/vieux-billet/", 301, "https://maisondherbes.com/"), hop("https://maisondherbes.com/", 200)],
      "maisondherbes.com"
    )?.kind,
    "accueil",
    "l'ancien site qui renvoie tout vers l'accueil du site principal"
  );
});

test("noindex : balise meta et en-tête X-Robots-Tag", () => {
  assert.ok(htmlHasNoindex('<head><meta name="robots" content="noindex, follow"></head>'));
  assert.ok(htmlHasNoindex("<meta content='noindex' name='googlebot'/>"));
  assert.ok(!htmlHasNoindex('<meta name="description" content="noindex est un mot">'));
  assert.ok(headerHasNoindex("noindex"));
  assert.ok(headerHasNoindex("googlebot: noindex, nofollow"));
  assert.ok(!headerHasNoindex("otherbot: noindex"));
  assert.ok(!headerHasNoindex(null));
});

test("aggregateShownPages : cumule par adresse, garde le dernier jour, trie par impressions", () => {
  const out = aggregateShownPages([
    { keys: ["https://bleuh.co/en/nous", "2026-11-01"], impressions: 100, clicks: 1, position: 2 },
    { keys: ["https://bleuh.co/en/nous", "2026-11-03"], impressions: 300, clicks: 1, position: 4 },
    { keys: ["https://bleuh.co/fr", "2026-11-02"], impressions: 50, clicks: 9, position: 1 },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    url: "https://bleuh.co/en/nous",
    impressions: 400,
    clicks: 2,
    position: 3.5,
    lastSeen: "2026-11-03",
  });
});

test("sortSignals : gravité d'abord, puis impressions", () => {
  const s = (kind: GscPageSignal["kind"], impressions: number): GscPageSignal => ({
    url: `https://x/${kind}${impressions}`,
    kind,
    status: 0,
    finalUrl: null,
    finalStatus: null,
    impressions,
    clicks: 0,
    position: 0,
    lastSeen: "2026-11-04",
  });
  const out = sortSignals([s("deplacee", 900), s("introuvable", 5), s("introuvable", 50), s("temporaire", 10)]);
  assert.deepEqual(out.map((x) => x.url), ["https://x/introuvable50", "https://x/introuvable5", "https://x/temporaire10", "https://x/deplacee900"]);
});

test("searchConsoleUrl : lien de propriété, encodé", () => {
  assert.equal(searchConsoleUrl("sc-domain:bleuh.co"), "https://search.google.com/search-console?resource_id=sc-domain%3Ableuh.co");
  assert.equal(
    searchConsoleUrl("sc-domain:bleuh.co", "removals"),
    "https://search.google.com/search-console/removals?resource_id=sc-domain%3Ableuh.co"
  );
});
