# Note — pistes d'amélioration (suite de la tranche sécurité)

Périmètre : frontend / API Next.js. Les contrats Solidity/Hardhat sont traités dans une branche parallèle.
Chaque piste vient d'un constat fait pendant la session ; ce qui n'a **pas** été vérifié est signalé.
Effort : S < ½ j · M ≈ 1–2 j · L > 2 j.

## P0 — Avant de déployer (S)

| Piste | Détail |
|---|---|
| Rotation des secrets | Révoquer le JWT Pinata « œuvres » (il était dans le bundle public) et le recréer dans `PINATA_JWT_ARTWORKS`. Définir `WALLET_SESSION_SECRET`. Retirer `NEXT_PUBLIC_PINATA_JWT_OEUVRES` de Vercel et des `.env*` (le build échoue sinon, volontairement). |
| Test réel de signature | `personal_sign` via `provider.request` a été testé avec de vraies signatures **ethers** (tests + smoke), **jamais avec MetaMask ni Web3Auth dans un navigateur**. À valider sur un environnement de préproduction avant la prod. |
| Premier déploiement en préprod | Vérifier : 503 attendu tant que `WALLET_SESSION_SECRET` manque, puis connexion, claim, upload Pinata, éclosion. |

## P1 — Robustesse (M)

1. **Rate limiting partagé.** Aujourd'hui en mémoire et par instance (`src/server/security/rateLimit.ts`). Brancher Vercel KV / Upstash derrière `checkRateLimit` : l'interface est déjà isolée, seul ce fichier change. Même remarque pour les verrous `inflight.ts` (par instance : deux instances peuvent lancer le même upload ; les vérifications on-chain `hasInsectImage` / `isInsectRegistered` limitent les dégâts mais pas le gaspillage de gas).
2. **Signer une fois, à la connexion.** Le premier appel protégé déclenche la fenêtre de signature au milieu d'un flux (ex. juste après l'achat de points, `DashBoard.tsx`). Meilleur : ouvrir la session dans `AuthProvider` au moment de `connectWallet`, pour que les appels suivants soient silencieux. Prévoir le cas « l'utilisateur refuse de signer ».
3. **Budget et cloisonnement du relayer.** Une seule clé `RELAYER_PK` sert au faucet, aux distributions de points et aux uploads on-chain. Pistes : clés séparées (blast radius), plafond de dépense journalier, alerte quand le solde est bas (aujourd'hui seulement un `console.error`), puis à terme un relayer géré (Defender/KMS) plutôt qu'une clé en variable d'environnement.
4. **Routes de lecture encore publiques et sans limite** : `/api/data/{collections,insects,members}`, `/api/token/{adhesion-metadata,adhesion-state,art-metadata,art-state,generate-onchain-uri,insect-image,next-evolution}`. Ajouter rate limit + en-têtes de cache CDN ; relire `/api/moralis/[...moralis]` et la config `next-auth` (non relues).
5. **`/api/webhook` (Moralis Streams).** C'est un no-op sans vérification de signature. Si on l'utilise pour déclencher des invalidations, vérifier la signature Moralis (en-tête `x-signature`) avant d'agir.
6. **Pinata.** (a) Au-delà de 3 Mo : URL d'upload signées Pinata côté serveur plutôt que base64 dans un JSON. (b) Décider si `oeuvres` est réservé aux membres (lecture `members()` mise en cache) — décision métier laissée ouverte. (c) Les ZIP génératifs contiennent HTML/JS servi depuis une passerelle : prévoir une règle de modération. (d) Quota par wallet sur la durée, pas seulement par fenêtre de 10 min.

## P2 — Qualité et dette repérée

1. **`AuthProvider` bloque tout le rendu serveur** tant que Web3Auth s'initialise : le HTML pré-rendu de **toutes** les pages (dont `/cgu`) ne contient que le loader « Démarrage 0 % ». Impact SEO et pages légales sans JavaScript. Rendre les pages publiques indépendantes de l'état d'authentification, et n'afficher le loader que pour les zones protégées.
2. **Bug trouvé en passant, non corrigé** : `src/hooks/Moralis/UserTransactionsFeed.tsx` (~l.696) construit `/api/proxy?url=https://api.basescan.org/api?module=…&address=…` **sans `encodeURIComponent`** : l'URL est tronquée au premier `&`. À vérifier fonctionnellement avant correction.
3. **`package.json`** : une entrée `"p5": "^1.4.0"` se trouve par erreur dans `scripts` (la vraie dépendance est dans `dependencies`).
4. **Dépendance non déclarée** : `axios` était importé sans figurer dans `package.json` (retiré des fichiers touchés). Vérifier le reste du dépôt (`grep -rn "from \"axios\""`).
5. **Pas de lint actif** : `next lint` est ignoré faute de configuration ESLint. Ajouter ESLint avec la règle `no-restricted-syntax` / `no-restricted-properties` pour interdire `error.message` dans `res.json` et tout `NEXT_PUBLIC_*SECRET|JWT|PRIVATE` (le test d'inventaire fait déjà une partie du travail).
6. **En-têtes de sécurité** : seulement dans `vercel.json`. Ajouter une CSP et HSTS (CSP délicate : Web3Auth, Moralis, Stripe, iframes Google Docs de la CGU) ; le faire en mode `Report-Only` d'abord.
7. **Clé d'explorateur publique** : `NEXT_PUBLIC_ETHERSCAN_API_KEY` est exposée par conception. La remplacer par un appel via `/api/basescan` si le quota compte.
8. **`npm audit`** : jamais lancé (interdit `--force`). Faire un triage lecture seule.
9. **Session wallet — évolutions** : adopter le format standard SIWE (EIP-4361) pour un affichage clair dans les wallets ; support des wallets à contrat (EIP-1271, Safe/AA) **non géré** aujourd'hui (Web3Auth et MetaMask fournissent des EOA, donc OK pour l'existant) ; pas de révocation fine (changer `WALLET_SESSION_SECRET` déconnecte tout le monde).

## P2 — Tests et CI (T4, volontairement reporté)

- Aucun CI détecté dans ce qui a été lu (`.github/` non inspecté) : workflow `typecheck → vitest → build → smoke → smoke:studio`.
- Smoke **navigateur** (Playwright est préinstallé dans l'environnement cloud) : chargement des pages, parcours de connexion avec un wallet de test, flux Pinata.
- Tests des hooks clients : `useWalletFetch` / `authedFetch` avec un provider simulé (jeton expiré → une seule re-signature, signatures concurrentes dédupliquées).
- Les erreurs TypeScript citées au départ (`Admin.tsx`, `CreateCollection.tsx`, `useReproduction.ts`) sont dans les modifications locales du propriétaire : à corriger là-bas, puis relancer `npm run typecheck && npm run build`.

## Point de coordination avec la branche contrats

`.gitignore` contient `*.sol` : **les sources Solidity ne sont pas dans le dépôt**, seulement des artifacts (`Hardhat Solidity Deploy/contracts/artifacts`, dont les `build-info` contiennent les sources compilées). Une revue de contrats reproductible dépend donc de ces artifacts, qui peuvent différer de ce qui est déployé. À signaler à l'autre session.
Côté frontend, les routes relayer dépendent de fonctions on-chain (`distributeToAdhesion`, `rewardRelayer`, `claimTo`, `registerInsect`…) : tout changement de droits `owner`/`relayer` côté contrat doit être répercuté ici.

## Ordre suggéré

P0 (½ j) → rate limit partagé + signature à la connexion (2 j) → routes de lecture + webhook (1 j) → AuthProvider non bloquant (1–2 j) → CI et tests navigateur (1–2 j) → dette P2.
