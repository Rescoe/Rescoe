STATUT DE REPRISE : PARTIEL (sources récupérées + committées ; en cours : lecture/audit des sources puis config Hardhat d'audit)

# CLAUDE_HANDOFF — Audit Solidity/Hardhat RESCOE

> Fichier de continuité. Mis à jour après chaque étape significative.
> Aucun secret / clé / URL RPC confidentielle / contenu de `.env` ne doit apparaître ici.

## 1. Mission et périmètre exacts de cette session

Session PARALLÈLE à une autre session qui gère frontend / build Next.js / API.
**Ne JAMAIS toucher** aux fichiers frontend/API (`pages/`, `src/`, `public/`, `scripts/` racine, `package.json` racine, etc.).

Périmètre autorisé :
- `Hardhat Solidity Deploy/` (tests, scripts d'analyse, contrats d'attaque, snapshot récupéré)
- `Contrats_Solidity_Fonctionnels/` si présent (ABSENT à ce jour)
- `docs/SMART_CONTRACT_AUDIT.md`, `docs/CLAUDE_HANDOFF.md`, `docs/CLAUDE_UNCOMMITTED_DIFF.patch`

Interdictions : aucune tx Base/Base Sepolia, aucun déploiement public, aucun changement de `.env`,
aucun reset/stash global/force push/suppression d'artefacts, ne pas modifier les contrats pour masquer un finding,
RPC éventuel strictement read-only.

Objectif : audit exécutable des contrats RESCOE + vraie suite de tests Hardhat (le "0 passing" actuel est inacceptable)
+ `docs/SMART_CONTRACT_AUDIT.md`.

## 2. Branche Git et commit de départ

- Branche : `claude/compassionate-edison-gecvpi`
- Commit de départ : `15ae68551f83f5cf3c98e337eb51cf6d2960d116` ("feat: adhésions Rescoe 100% on-chain — passage de l'IPFS au stockage natif Base")
- Working tree propre au départ.

## 3. État d'avancement

Terminé :
- Étape 0 : vérification des sources (Cas B confirmé).
- `scripts/audit/recover-sources.js` : extrait les sources des 6 build-info vers `audit-recovered-contracts/build-info/<id>/`, vérifie keccak256 vs métadonnées Remix, associe chaque artifact à son build-info (bytecode identique).
- `npm ci` OK (hardhat 2.28.3, OZ 4.9.6 installé mais NON utilisé par les sources) + `solc@0.8.30` ajouté en devDependency exacte (solcjs, `0.8.30+commit.73712a01`, identique au compilateur d'origine).
- Lecture complète de : Adhesion.sol, RescollectionFactory.sol, ArtFactory.sol, mintArt.sol, IReward.sol.

En cours :
- Lecture MessageEditions.sol / MessageFactory.sol / FaucetSepolia.sol.
- Config Hardhat d'audit (`hardhat.audit.config.js`) : solcjs local (binaires solc bloqués par le proxy) + OZ vendorisé.

Non commencé : fixtures, tests, invariants/fuzz, analyse bytecode/ABI (script), rapport `docs/SMART_CONTRACT_AUDIT.md`.

Bloqué / impossible (réseau) : Sourcify, IPFS, binaires solc et tous les RPC publics Base/Base Sepolia sont refusés par le proxy (HTTP 403 sur CONNECT). Donc : pas de bytecode on-chain, pas de sources vérifiées. Seul npm registry est joignable.

## 4. Fichiers créés / modifiés

- `docs/CLAUDE_HANDOFF.md` (créé) — ce fichier.

## 5. Commandes exécutées et résultats

- `git status` → propre. `git ls-files "*.sol"` → **vide**.
- `git check-ignore -v "Hardhat Solidity Deploy/contracts/AdhesionRescoe.sol"` → `.gitignore:22:*.sol` (racine). **Tous les .sol sont ignorés par Git.**
- `git log --all --name-only | grep .sol` → **aucun .sol n'a jamais été committé** (50 commits).
- `find /home/user/Rescoe -name "*.sol"` (hors node_modules) → **aucun**.
- Inventaire `contracts/` : uniquement `.deploys/`, `.states/vm-prague/`, `artifacts/` (style Remix : `X.json` + `X_metadata.json`) et `artifacts/build-info/` (6 fichiers, format `hh-sol-build-info-1`, solc 0.8.30+commit.73712a01, viaIR=true, optimizer runs=200).

## 6. Décisions techniques

- CAS B (sources absentes) → reconstitution depuis `input.sources` des build-info dans `Hardhat Solidity Deploy/audit-recovered-contracts/`.
- Les `.sol` étant gitignorés, ajouter une règle de ré-inclusion dans `Hardhat Solidity Deploy/.gitignore` (périmètre autorisé) plutôt que toucher le `.gitignore` racine.

## 7. Hypothèses métier

(à compléter)

## 8. Risques / vulnérabilités découverts (même non corrigés)

- **[Process/Critical-pour-l'audit]** Les sources Solidity métier ne sont versionnées nulle part dans Git (`*.sol` ignoré globalement). Seules les artefacts compilés existent. L'audit porte donc sur des sources RÉCUPÉRÉES depuis build-info, pas sur les "dernières sources métier".
- Les 6 build-info ne couvrent PAS : InsectEvolution, InsectImageStorageV3, HaikuEditions, PoetryFactory, MasterFactory, TokenManagement (à confirmer : artifacts Remix présents pour MasterFactory/TokenManagement sans build-info correspondant).

## 9. Modifications partielles / potentiellement cassées

Aucune.

## 10. Prochaine action précise

1. Extraire les `input.sources` de chaque build-info (script `scripts/audit/recover-sources.js`).
2. Chercher les ABI InsectEvolution / InsectImageStorageV3 / HaikuEditions / PoetryFactory dans le frontend (lecture seule).

## 11. Commande de reprise

```bash
cd /home/user/Rescoe && git status --short && sed -n 1,200p docs/CLAUDE_HANDOFF.md
```

## 12. Fichiers à lire en premier

1. `docs/CLAUDE_HANDOFF.md`
2. `Hardhat Solidity Deploy/contracts/artifacts/build-info/*.json` (sources via `input.sources`)
3. `Hardhat Solidity Deploy/hardhat.config.js`

## 13. État Git

- `git status --short` : (propre au départ, hors docs/CLAUDE_HANDOFF.md)
- Dernier commit : `15ae685`
- Commits créés pendant la session : aucun

## 14. Confiance par chantier

- Diagnostic des sources : élevée (vérifié par commandes).
- Le reste : non évalué.

## 15. Non vérifié

- Version exacte d'OpenZeppelin (mélange v4/v5 apparent dans les build-info).
- Disponibilité d'un RPC read-only (non testé).
