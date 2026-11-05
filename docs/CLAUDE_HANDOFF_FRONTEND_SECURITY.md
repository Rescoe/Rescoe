STATUT DE REPRISE : PRÊT (T1/T2/T3 livrés et vérifiés sur le commit courant ; T4 reporté ; une seule réserve : les erreurs TypeScript citées dans la consigne ne sont pas reproductibles ici, voir « Résultat T1 »)

Branche : `claude/upbeat-gates-1dliug` (poussée, sans force-push, pas de PR). Base : `15ae685`.
Périmètre : frontend / API Next.js. **Aucun fichier Solidity, artifact Hardhat ou test Hardhat n'a été modifié.**
L'audit des contrats Solidity/Hardhat est traité dans une **branche parallèle** par une autre session.

## Résultat T1
- **CGU SSR — corrigé** (`src/components/containers/home/CGU.tsx`) : plus de `window.location` pendant le rendu ; l'origine est lue après montage, le lien PDF est dans le HTML initial. Test de rendu serveur ajouté (échoue sur l'ancien code avec `ReferenceError: window is not defined`, passe sur le nouveau).
- **`scripts/build.js` — corrigé** : les fichiers preuve `.next` (`BUILD_ID`, `routes-manifest.json`, `build-manifest.json`, `server/pages-manifest.json`) sont supprimés avant le build ; `next build` est lancé via `spawn` avec `error` géré ; le verdict est pris par `scripts/build-verdict.js` : code 0 **et** manifests créés pendant ce build, sinon échec. Un code non nul n'est plus jamais « rattrapé » par des manifests ; seule exception conservée, vérifiée : Windows + `ENOENT … unlink` dans la sortie + manifests frais. Testé (8 tests, dont la régression « manifests périmés »).
- **Garde « secrets publics »** (`scripts/check-public-secrets.js`, appelée par `npm run build`) : refuse tout `NEXT_PUBLIC_*` de type Pinata/JWT/clé privée/secret, toute valeur ressemblant à un JWT, toute référence dans `pages/`/`src/`. N'affiche jamais de valeur.
- **Erreurs TypeScript `Admin.tsx` (normalizedUri/metadata), `CreateCollection.tsx` (BigNumber), `useReproduction.ts` (metadata.level/resolvedUri) : NON reproductibles dans ce checkout.** `git status` était vide au démarrage de la session cloud et `tsc --noEmit --incremental false` sort en **EXIT=0** sur le commit courant, ces trois fichiers étant bien analysés (vérifié avec `--listFilesOnly`). Ces erreurs viennent des modifications locales non committées du propriétaire, absentes d'ici. Aucun correctif n'a été inventé. → Action 1 ci-dessous.

## Résultat T2 (socle sécurité serveur) — terminé
`src/server/security/` : `walletSession.ts` (session wallet sans état), `guards.ts`, `rateLimit.ts`, `clientIp.ts`, `validators.ts`, `redact.ts`, `inflight.ts`, `deployStudioGuard.ts` ; `src/shared/loginMessage.ts` (format du message signé) ; client : `src/utils/walletSession.ts`, `src/hooks/useWalletFetch.ts`.
- **Décision d'authentification** : une signature `personal_sign` (sans frais) lie adresse + domaine + nonce + date (fraîcheur 5 min) → jeton HMAC-SHA256 de 30 min (`Authorization: Bearer`). Les routes comparent l'adresse du jeton à l'adresse visée. **Échec fermé** : sans `WALLET_SESSION_SECRET` (≥ 32 car.) en production, les routes protégées répondent 503.
- **Limitation du rate limiting** : compteurs **en mémoire, par instance** serverless (Vercel) → frein best-effort, pas une garantie globale. Remplacer `checkRateLimit` par Vercel KV / Upstash pour une garantie réelle.

## Résultat T3 (routes durcies) — terminé
| Route | Protection |
|---|---|
| `/api/wallet/session` (nouveau) | signature, domaine, fraîcheur ; 20 / 10 min / IP |
| `/api/claim-reward`, `/api/claim`, `/api/create-onramp-session` | session + adresse = session, validation, 2 ko, rate limit IP(+wallet), verrou |
| `/api/token/upload-insect-relayer`, `-v3`, `upload-egg-relayer` | session, 2 ko, rate limit IP+wallet, verrou, `hasOwn` (la clé `constructor` donnait un 500), erreurs sans URL RPC |
| `/api/pinata/upload`, `/api/pinata/pin` (nouveau) | session, 4 Mo, image ≤ 3 Mo identifiée par octets, métadonnées ≤ 64 ko, CID image imposé serveur, rate limit IP+wallet |
| `/api/admin/insect-storage-status` | session du owner (plus un paramètre d'URL) |
| `/api/revalidate` | secret en en-tête, comparaison à temps constant, query refusée en production, tokenId validé |
| `/api/proxy`, `/basescan`, `/ipfs/*`, `/metadata/*`, `/channel/[id]`, `/news`, `/invalidate-insect-cache`, `/discord/mod-status`, `/token/insects` | entrées validées / GET+HTTPS+hôtes autorisés / rate limit ; plus d'`error.message` renvoyé |
| `/api/admin/deploy/*` (12 routes, dont `access` nouveau) | `guardDeployStudio()` : `ENABLE_DEPLOY_STUDIO=true`, hors production/Vercel, `HARDHAT_DIR` requis (plus de chemin personnel), boucle locale, Host local, anti-CSRF ; mainnet = second opt-in ; `execFile` + env minimal + entrées validées |

**Changements clients** : `useWalletFetch()` dans DashBoard, Faucet, ConnectBouton, Adhesion, useTokenEvolution, useReproduction, usePinataUpload, insect-storage ; les 4 appels directs à Pinata (JWT `NEXT_PUBLIC_`) passent par `/api/pinata/pin` (`src/utils/pinata.ts`) ; `DeployStudioGate` (+ en-tête anti-CSRF dans `useDeployStudio`). `axios` retiré des fichiers touchés (n'était pas une dépendance déclarée).

**Routes NON durcies (lecture, hors périmètre de cette tranche)** : `/api/data/{collections,insects,members}`, `/api/token/{adhesion-metadata,adhesion-state,art-metadata,art-state,generate-onchain-uri,insect-image,next-evolution}` (publiques, sans rate limit ; coût Moralis/RPC), `/api/moralis/[...moralis]` et `/api/auth/[...nextauth]` (libs tierces, non relues), `/api/webhook` (no-op, sans vérification de signature Moralis). L'app Next séparée `Hardhat Solidity Deploy/deploy-ui` (routes app-router de déploiement) n'a pas été relue ni modifiée.

**Risques restants** : (1) le JWT Pinata « œuvres » a été exposé dans le bundle public → **à révoquer/recréer** ; (2) rate limiting par instance ; (3) Pinata sans contrôle « membre on-chain » (le flux d'adhésion envoie le badge avant d'être membre) ; (4) uploads ≤ 3 Mo (prévoir des URL signées Pinata au-delà) ; (5) Deploy Studio : un autre utilisateur local d'une machine partagée atteint `127.0.0.1` ; (6) `AuthProvider` masque tous les enfants pendant l'init Web3Auth : le HTML pré-rendu de `/cgu` (et des autres pages) ne contient que le loader → SEO / page légale sans JS ; (7) `NEXT_PUBLIC_ETHERSCAN_API_KEY` reste public par conception (clé d'explorateur).

## T4 non commencé
Le volet Hardhat/Solidity est retiré de cette session (traité ailleurs). Les 174 tests Vitest et 2 scripts de smoke commités étaient **déjà écrits** avant la consigne « fin de session » ; aucun test n'a été ajouté depuis. Il manque notamment : smoke des pages en navigateur, tests d'intégration des hooks clients (`useWalletFetch`, flux Pinata).

## Validations exécutées
- `npx vitest run` → **Test Files  13 passed (13) | Tests  174 passed (174)** — EXIT=0 (13 fichiers, 0 échec).
- `npx tsc --noEmit --incremental false` → sortie : `EXIT=0` (**0 erreur**).
- `npm run build` (script strict, garde secrets incluse, sur l'arbre committé) → **EXIT=0** ; `✓ Compiled successfully in 16.3s ; ✓ Generating static pages (29/29)` ; `BUILD_ID` recréé pendant le build (07:52:18 UTC).
- `npm run smoke` (serveur de production) → **62/62 OK** ; `npm run smoke:studio` (vrai `next dev`) → **10/10 OK** (exécutés avant la fin de session, code applicatif inchangé depuis hors correctif Studio déjà inclus).
- Recherches : `NEXT_PUBLIC_PINATA*` dans pages/src/scripts → aucune ; routes utilisant `RELAYER_PK`/Pinata/Stripe/`child_process`/`writeFileSync` sans `requireWalletSession(`/`guardDeployStudio(` → aucune ; réponses API renvoyant `error.message`/URL RPC → aucune (garantie aussi par `tests/api/inventory.test.ts`).
- Tests de mutation (7 régressions volontaires : domaine, adresse de session, `hasOwn`, garde Studio, image Pinata, masquage URL, manifests périmés) → **les 7 sont détectées**.

**git status --short final (avant commit du handoff) :**
```
?? docs/CLAUDE_HANDOFF_FRONTEND_SECURITY.md
```
**git log --oneline -5 :**
```
69548af test: Vitest (174 tests : unitaires, API, SSR CGU) et scripts de smoke HTTP
6050d93 build: scripts/build.js strict et garde « secrets publics »
e9b8186 feat(security): Deploy Studio opt-in local, inaccessible sans garde serveur
4585952 fix(security): Pinata uniquement côté serveur — JWT retiré du navigateur
01fa203 fix(security): durcir les routes relayer, Stripe, faucet et lecture publique
```
**Fichiers non committés et pourquoi :** uniquement `docs/CLAUDE_HANDOFF_FRONTEND_SECURITY.md` (ce fichier, committé juste après) ; rien d'autre n'est laissé hors commit. `node_modules/`, `.next/`, `tsconfig.tsbuildinfo` sont ignorés par `.gitignore`.

## Erreurs exactes restantes
Aucune erreur TypeScript, de test ni de build sur le commit courant. Seul écart non résolu : les erreurs `Admin.tsx` / `CreateCollection.tsx` / `useReproduction.ts` citées dans la consigne **n'existent pas dans ce checkout** (cf. « Résultat T1 ») ; elles ne peuvent être corrigées que sur la copie locale du propriétaire. Les routes de lecture listées en T3 restent non protégées.

## Fichiers modifiés
Voir `git diff --stat 15ae685..HEAD` : 45+ fichiers. Nouveaux : `src/server/**`, `src/shared/loginMessage.ts`, `src/utils/{walletSession,pinata}.ts`, `src/hooks/useWalletFetch.ts`, `pages/api/{wallet/session,pinata/pin,admin/deploy/access}.ts`, `DeployStudioGate.tsx`, `scripts/{build-verdict,check-public-secrets,smoke,smoke-deploy-studio}`, `vitest.config.ts`, `tests/**`, `docs/{security,CLAUDE_HANDOFF_FRONTEND_SECURITY}.md`. Renommés `claim.js→claim.ts`, `proxy.js→proxy.ts`, `basescan.js→basescan.ts`. `package.json`/`package-lock.json` : dépendance `vitest` + scripts `typecheck`, `check:secrets`, `test`, `smoke`, `smoke:studio`.

## Commits créés
- `69548af test: Vitest (174 tests : unitaires, API, SSR CGU) et scripts de smoke HTTP`
- `6050d93 build: scripts/build.js strict et garde « secrets publics »`
- `e9b8186 feat(security): Deploy Studio opt-in local, inaccessible sans garde serveur`
- `4585952 fix(security): Pinata uniquement côté serveur — JWT retiré du navigateur`
- `01fa203 fix(security): durcir les routes relayer, Stripe, faucet et lecture publique`
- `3e9e558 feat(security): socle serveur — session wallet, rate limit, validation, masquage des secrets`
- `aa6f4dc fix(cgu): rendre la page CGU côté serveur sans accéder à window`
- (+ le commit de ce handoff, créé juste après)

## Trois prochaines actions
1. **Appliquer sur la copie locale du propriétaire** : récupérer cette branche, puis relancer `npm run typecheck` ; si les erreurs `Admin.tsx` / `CreateCollection.tsx` / `useReproduction.ts` existent dans ses modifications locales non committées, les corriger là (portée de `normalizedUri`/`metadata`/`resolvedUri`, `BigNumber` → `bigint`/ethers v6) — puis relancer `npm run build`.
2. **Avant tout déploiement** (voir `docs/security.md`) : définir `WALLET_SESSION_SECRET` (`openssl rand -hex 32`), révoquer et recréer le JWT Pinata (`PINATA_JWT_ARTWORKS`), supprimer `NEXT_PUBLIC_PINATA_JWT_OEUVRES` de Vercel/`.env*`, ne pas activer `ENABLE_DEPLOY_STUDIO` en production.
3. **Tranche suivante** : rate limit partagé (Vercel KV/Upstash) + durcissement des routes de lecture non protégées + signature Moralis sur `/api/webhook` ; puis T4 (smoke navigateur, hooks clients).

## Commande exacte de reprise
```bash
git fetch origin claude/upbeat-gates-1dliug && git checkout claude/upbeat-gates-1dliug \
  && npm ci --ignore-scripts && npm run typecheck && npm test && npm run build && npm run smoke && npm run smoke:studio
```
