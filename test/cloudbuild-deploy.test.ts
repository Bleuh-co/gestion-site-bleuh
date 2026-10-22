import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Le déploiement doit viser une image TAGUÉE PAR COMMIT.
 *
 * Le pool de workers Cloud Build est partagé avec d'autres dépôts et les builds
 * peuvent se vider DANS LE DÉSORDRE. Avec un tag `latest` mutable, le build le
 * plus ANCIEN peut terminer en dernier, écraser `latest` et faire RECULER la
 * production — en affichant SUCCESS. C'est arrivé sur `sitemdh` le 24/08 :
 * `/api/shipstation` répondait 404 alors que les trois builds étaient verts.
 *
 * Pire, entre le `push` d'un build et son `deploy`, un autre build peut
 * réécrire `latest` : le build A déploie alors le code du build B tout en
 * rapportant le succès de A. Aucune alerte, aucun journal ne le montre.
 *
 * Ce test ne vérifie pas une logique, il vérifie une CHAÎNE DE CARACTÈRES.
 * C'est voulu : le défaut n'est pas algorithmique, il est lexical.
 */

const yaml = readFileSync(resolve(__dirname, "..", "cloudbuild.yaml"), "utf8");

/** Lignes utiles : ni vides, ni commentaires. */
const lignes = yaml
  .split("\n")
  .filter((l) => !l.trim().startsWith("#") && l.trim() !== "");

describe("cloudbuild — l'image déployée est identifiée par le commit", () => {
  it("l'étape deploy vise $SHORT_SHA", () => {
    const image = lignes.find((l) => l.includes("--image="));
    expect(image, "aucune ligne --image= dans cloudbuild.yaml").toBeDefined();
    expect(image).toContain("$SHORT_SHA");
  });

  it("l'étape deploy ne vise JAMAIS le tag mutable", () => {
    const image = lignes.find((l) => l.includes("--image="))!;
    // `${_TAG}` vaut `latest` : mutable, donc inutilisable pour déployer.
    expect(image).not.toContain("${_TAG}");
    expect(image).not.toContain(":latest");
  });

  it("l'image du commit est bien poussée avant d'être déployée", () => {
    // Déployer un tag jamais poussé échouerait au pull, pas au build.
    const pushSha = lignes.findIndex(
      (l) => l.includes('"push"') && l.includes("$SHORT_SHA")
    );
    const deploy = lignes.findIndex((l) => l.includes("--image="));
    expect(pushSha, "aucune étape ne pousse l'image du commit").toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(pushSha);
  });

  /**
   * Cloud Build résout `${…}` LUI-MÊME, avant que bash ne voie la ligne. La
   * syntaxe de valeur par défaut de bash est donc lue comme une substitution
   * inconnue et le build est rejeté au parsing. Laissé nu, un `$SHORT_SHA`
   * absent échoue bruyamment — ce qui est le comportement voulu.
   */
  it("n'utilise pas la syntaxe de repli bash sur une substitution", () => {
    // Sur `lignes`, pas sur `yaml` : le commentaire qui met en garde contre
    // cette syntaxe la CONTIENT, et ferait échouer le test qu'il documente.
    const code = lignes.join("\n");
    expect(code).not.toMatch(/\$\{SHORT_SHA:-/);
    expect(code).not.toMatch(/\$\{[A-Z_]+:-/);
  });
});

/**
 * L'étape `deploy` ne doit JAMAIS fixer les variables d'environnement.
 *
 * Les variables du service vivent sur Cloud Run et NULLE PART dans ce dépôt
 * (GESTIONSITEBLEUH_APP_ID, BLEUH_ADMIN_TOKEN, NOTIF_API_KEY, APP_PUBLIC_URL,
 * les clés MailerLite et Google…).
 *
 * `gcloud run deploy` sans drapeau les PRÉSERVE. Mais `--set-env-vars` et
 * `--set-secrets` REMPLACENT l'ensemble : en ajouter un seul ici pour une
 * nouvelle variable effacerait silencieusement toutes les autres, et la cause
 * serait cherchée partout sauf dans la ligne ajoutée.
 *
 * `--update-env-vars` / `--update-secrets` sont additifs et donc tolérés :
 * c'est ce qu'il faut utiliser, ou mieux, une commande hors dépôt.
 */
describe("cloudbuild — le déploiement ne peut pas effacer la configuration du service", () => {
  const deploy = lignes.join("\n");

  it("n'emploie ni --set-env-vars ni --set-secrets", () => {
    expect(deploy, "--set-env-vars REMPLACE toutes les variables du service").not.toContain(
      "--set-env-vars"
    );
    expect(deploy, "--set-secrets REMPLACE tous les secrets du service").not.toContain(
      "--set-secrets"
    );
  });

  it("ne vide pas la configuration par un drapeau de nettoyage", () => {
    expect(deploy).not.toContain("--clear-env-vars");
    expect(deploy).not.toContain("--clear-secrets");
  });
});

/**
 * Les tests passent AVANT l'image (plan « Pages d'atterrissage et
 * infolettres », lot L9) : un test rouge arrête le build, rien n'est poussé
 * ni déployé.
 */
describe("cloudbuild — un test rouge refuse le déploiement", () => {
  const dockerfile = readFileSync(resolve(__dirname, "..", "Dockerfile"), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

  it("la première étape construit la cible `test` du Dockerfile", () => {
    const iTest = lignes.findIndex((l) => l.includes("- id: test"));
    const iBuild = lignes.findIndex((l) => l.includes("- id: build"));
    expect(iTest, "aucune étape « test » dans cloudbuild.yaml").toBeGreaterThan(-1);
    expect(iBuild).toBeGreaterThan(iTest);
    const etapeTest = lignes.slice(iTest, iBuild).join("\n");
    expect(etapeTest).toContain("--target test");
  });

  it("l'étage `test` lance npm test, et le builder ne peut pas s'en passer", () => {
    const etageTest = dockerfile.indexOf("AS test");
    const etageBuilder = dockerfile.indexOf("AS builder");
    expect(etageTest, "aucun étage « test » dans le Dockerfile").toBeGreaterThan(-1);
    expect(etageBuilder).toBeGreaterThan(etageTest);
    expect(dockerfile.slice(etageTest, etageBuilder)).toMatch(/RUN npm test/);
    // BuildKit saute un étage que personne ne référence : sans cette copie,
    // une image pourrait naître d'un code rouge.
    expect(dockerfile.slice(etageBuilder)).toMatch(/COPY --from=test /);
  });

  it("le script npm test existe et lance vitest", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf8"));
    expect(pkg.scripts?.test).toBe("vitest run");
  });
});
