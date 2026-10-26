# syntax=docker/dockerfile:1.6
# Image multi-étages pour Next.js standalone — déployable sur Cloud Run

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps
WORKDIR /app
# .npmrc pointe @bleuh-co vers GitHub Packages ; le token est injecté en
# secret de build BuildKit (jamais gravé dans les layers).
COPY package.json package-lock.json* .npmrc ./
RUN --mount=type=secret,id=gh_token \
    GITHUB_PACKAGES_TOKEN="$(cat /run/secrets/gh_token 2>/dev/null)" \
    npm install --no-audit --no-fund

# Les tests passent AVANT l'image : un test rouge arrête le build, donc le
# déploiement (plan « Pages d'atterrissage et infolettres », lot L9).
# cloudbuild.yaml lance d'abord cette cible seule (étape « test », lisible
# dans le journal) ; le builder ci-dessous en dépend aussi, pour qu'aucune
# image ne puisse naître d'un code rouge, même construite à la main.
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm test && touch /tmp/tests-verts

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
WORKDIR /app
# BuildKit ne construit que les étages référencés : cette copie rend l'étage
# « test » obligatoire avant le build.
COPY --from=test /tmp/tests-verts /tmp/tests-verts
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Les variables NEXT_PUBLIC_* doivent être disponibles au BUILD (inlined)
# Défauts = DEV, overridés par cloudbuild.yaml en PROD
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCyGRvYpQPpr27fIJQ5-w8yeR-yzVDtdRY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gandalf-dev-497413.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=gandalf-dev-497413
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gandalf-dev-497413.firebasestorage.app
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=802272023583
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:802272023583:web:b75abb24714f154a28312a
ARG NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=chanv.com,bleuh.co,lafeuilleverte.ca,maisondherbes.com
ARG NEXT_PUBLIC_HUB_URL=https://chanv-apps-hub-dev-802272023583.northamerica-northeast1.run.app
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=$NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS \
    NEXT_PUBLIC_HUB_URL=$NEXT_PUBLIC_HUB_URL
RUN npm run build

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV PORT=8080
EXPOSE 8080
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
