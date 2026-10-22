import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
  resolve: {
    alias: [
      /**
       * `@/…` → `src/…`, comme les `paths` de tsconfig : les routes s'importent
       * telles quelles dans les tests. Une EXPRESSION, pas la clé « @ » : une
       * clé de chaîne est comparée en PRÉFIXE et capturerait aussi
       * `@bleuh-co/…` et tous les paquets à portée.
       */
      { find: /^@\/(.*)$/, replacement: resolve(__dirname, "src") + "/$1" },
      /**
       * `server-only` n'est pas un vrai module : c'est un marqueur que le
       * bundler Next remplace par une erreur s'il atterrit dans un paquet
       * client. Vitest ne sait pas le résoudre et refuserait de charger tout
       * module serveur. On l'aiguille vers un fichier vide ; le marqueur garde
       * tout son rôle dans la compilation Next.
       */
      { find: "server-only", replacement: resolve(__dirname, "test/stubs/server-only.ts") },
    ],
  },
});
