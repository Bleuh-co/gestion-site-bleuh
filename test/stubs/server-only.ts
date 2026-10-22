// Doublure de `server-only` pour vitest — voir le commentaire de
// vitest.config.ts. Le marqueur réel n'exporte rien non plus : sa seule
// fonction est de faire échouer la compilation Next si un module serveur
// est tiré dans un paquet client.
export {};
