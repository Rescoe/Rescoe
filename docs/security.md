# Sécurité — routes API, secrets, Deploy Studio

Ce document décrit le durcissement de la tranche 1 et les décisions prises quand une règle métier manquait
(on a toujours retenu le comportement **le plus sûr**). L'audit des contrats Solidity/Hardhat est traité
séparément, dans une branche parallèle ; il n'est pas couvert ici.

## À faire AVANT de déployer ce code

| # | Action | Pourquoi |
|---|--------|----------|
| 1 | Définir `WALLET_SESSION_SECRET` côté serveur (Vercel → Environment Variables), ≥ 32 caractères : `openssl rand -hex 32` | Sans lui, **toutes** les routes protégées répondent `503` en production (échec fermé). Hors production, un secret éphémère est généré. |
| 2 | **Révoquer puis régénérer** le JWT Pinata « œuvres » (celui qui était dans `NEXT_PUBLIC_PINATA_JWT_OEUVRES`), le mettre dans `PINATA_JWT_ARTWORKS` (sans `NEXT_PUBLIC_`), puis supprimer `NEXT_PUBLIC_PINATA_JWT_OEUVRES` de Vercel et des `.env*` | Ce JWT a été embarqué dans le JavaScript public : il doit être considéré comme compromis. Le build échoue tant qu'une variable `NEXT_PUBLIC_*` de ce type existe. |
| 3 | Vérifier `PINATA_JWT_BADGES`, `PINATA_JWT_ARTWORKS`, `RELAYER_PK`, `STRIPE_PRIVATE`, `REVALIDATE_SECRET` côté serveur | Utilisés par les routes ; leur absence donne `503`/`500` sans détail au client. |
| 4 | Ne **pas** définir `ENABLE_DEPLOY_STUDIO` sur Vercel / en production | Le Studio est refusé de toute façon (`NODE_ENV=production` ou `VERCEL`), mais il ne doit pas être activé par erreur. |

## Modèle d'authentification : session wallet

```
navigateur                                   serveur
   │  personal_sign("Rescoe — connexion…      │
   │   Adresse / Domaine / Nonce / Émis le")  │  (UNE signature, sans frais, sans transaction)
   ├──────── POST /api/wallet/session ───────▶│  vérifie : signature ↔ adresse, domaine = Host,
   │                                          │  fraîcheur ≤ 5 min  → jeton HMAC-SHA256, 30 min
   │◀─────────────── { token } ───────────────┤
   │  Authorization: Bearer <token>           │
   ├──────── routes protégées ───────────────▶│  jeton valide ET adresse visée = adresse du jeton
```

- Sans état : aucune base, compatible serverless. Code : `src/server/security/walletSession.ts`, `guards.ts`.
- Côté navigateur : `src/utils/walletSession.ts` + hook `useWalletFetch()` (cache 30 min, une seule signature à la fois,
  re-signature automatique sur `401`).
- Le message est lié au **domaine** (un site tiers ne peut pas rejouer une signature) et daté.

## Routes sensibles

| Route | Secret / effet | Accès | Limites |
|-------|----------------|-------|---------|
| `POST /api/wallet/session` | émet un jeton | signature de wallet | 4 ko, 20 / 10 min / IP |
| `POST /api/claim-reward` | `RELAYER_PK` (gas) | session **et** `user` = adresse de la session | 2 ko, 10 / min / IP, 3 / min / adresse, verrou par adresse |
| `POST /api/claim` (faucet) | `RELAYER_PK` | session, `user` = adresse de la session | 2 ko, 5 / h / IP, cooldown 24 h / adresse |
| `POST /api/create-onramp-session` | Stripe | session, `walletAddress` = adresse de la session | 2 ko, 5 / 10 min / IP ; IP transmise à Stripe = IP calculée côté serveur |
| `POST /api/pinata/upload` | JWT Pinata | session | 4 Mo (image ≤ 3 Mo, GIF/PNG/JPEG/WebP identifiés par leurs octets), métadonnées ≤ 64 ko, 20 / 10 min / IP, 10 / 10 min / wallet ; `image` imposée par le serveur |
| `POST /api/pinata/pin` (nouveau) | JWT Pinata | session | 4 Mo, 120 / 10 min / IP, 60 / 10 min / wallet ; nom de fichier assaini |
| `POST /api/token/upload-insect-relayer[-v3]`, `upload-egg-relayer` | `RELAYER_PK` | session | 2 ko, 30 / 10 min / IP, 15 / 10 min / wallet, verrou par ressource, clé validée par `hasOwn` |
| `GET /api/admin/insect-storage-status` | RPC | session **du owner** (plus un paramètre d'URL) | 20 / min |
| `GET\|POST /api/revalidate` | invalide les caches | `REVALIDATE_SECRET` en en-tête (comparaison à temps constant ; en query uniquement hors production) | 60 / min |
| `GET /api/proxy`, `/api/basescan`, `/api/ipfs/*`, `/api/metadata/*` | clé Moralis / Basescan | publiques (lecture) | GET + HTTPS + hôtes autorisés, adresse/CID validés, 60–300 / min / IP |
| `/api/admin/deploy/*` | `child_process`, fichiers | **Deploy Studio** (ci-dessous) | corps 16 ko – 2 Mo selon la route |

Aucune réponse n'inclut `error.message` d'ethers/axios/RPC ni de corps d'erreur Pinata/Discord : ils contiennent
des URL avec clé API. Les erreurs sont journalisées **masquées** (`redactSecrets`) et le client reçoit un code stable
(`{ "error": "upload_failed" }`).

## Deploy Studio (local uniquement, opt-in)

Toutes les routes `/api/admin/deploy/*` appellent `guardDeployStudio()` en première instruction. Il faut **toutes** ces conditions :

1. `ENABLE_DEPLOY_STUDIO=true` dans l'environnement serveur (opt-in explicite, désactivé par défaut) ;
2. `NODE_ENV` ≠ `production`, et ni `VERCEL` ni `VERCEL_ENV` ;
3. `HARDHAT_DIR` défini (plus de chemin personnel par défaut) ;
4. connexion depuis la boucle locale (`127.0.0.1`/`::1`) **sans** en-tête `X-Forwarded-*` ;
5. en-tête `Host` = `localhost` / `127.0.0.1` / `[::1]` (anti DNS-rebinding) ;
6. requêtes modifiantes : en-tête `x-requested-with: rescoe-deploy-studio` (anti-CSRF) et `Origin` = `Host`.

Le déploiement sur **Base mainnet** exige en plus `ENABLE_DEPLOY_STUDIO_MAINNET=true`. Les commandes Hardhat sont lancées
avec `execFile` (arguments en tableau, dossier via `cwd`), un environnement enfant **minimal** (pas de `STRIPE_PRIVATE`,
JWT Pinata, etc.) et des entrées validées (nom de contrat `^[A-Za-z][A-Za-z0-9_]{0,63}$`, réseau en liste fermée,
arguments primitives uniquement). L'arrêt du nœud ne tue que le processus lancé par le Studio.

Activer en local :

```bash
# environnement serveur local (par ex. .env.local, jamais commité)
ENABLE_DEPLOY_STUDIO=true
HARDHAT_DIR=/chemin/vers/HardhatRescoe
npm run dev
```

Résiduel : sur une machine partagée, un autre utilisateur local peut atteindre `127.0.0.1`. Ne pas activer le Studio sur un poste partagé.

## Secrets publics

`scripts/check-public-secrets.js` (lancé par `npm run build`, ou `npm run check:secrets`) échoue si :
une variable `NEXT_PUBLIC_*` porte un nom de secret (`PINATA`, `JWT`, `PRIVATE`, `SECRET`, `RELAYER`, `_PK`…),
si sa **valeur** ressemble à un JWT, ou si le code (`pages/`, `src/`) référence un tel nom. Il n'affiche que des noms et
des `fichier:ligne`, jamais une valeur.

## Décisions métier retenues (comportement le plus sûr)

- **Pinata** : session wallet requise, mais **pas** de contrôle « membre on-chain » : le flux d'adhésion envoie le badge
  avant que l'adresse soit membre. À reconsidérer si l'on veut réserver `oeuvres` aux artistes.
- **Faucet / onramp / claim-reward** : réservés à **sa propre adresse** (impossible de dépenser le gas du relayer pour un tiers).
- **Rate limiting en mémoire** : frein best-effort, **par instance** serverless (voir `rateLimit.ts`). Pour une garantie globale : Vercel KV / Upstash.
- **Uploads ≤ 3 Mo** (limite de corps Vercel 4,5 Mo + base64). Au-delà : prévoir des URL d'upload signées Pinata.
- **Mainnet** désactivé par défaut dans le Studio.
- `/api/proxy` reste public (les galeries l'utilisent) mais n'est plus un relais ouvert.

## Vérifier

```bash
npm run typecheck      # tsc --noEmit --incremental false
npm test               # Vitest : validateurs, session wallet, gardes, routes, rendu SSR CGU
npm run build          # garde secrets publics + next build strict
npm run smoke          # démarre next start et vérifie pages publiques / refus d'accès / auth de bout en bout
```
