STATUT DE REPRISE : PARTIEL — Adhesion testé (41 verts) ; restent ArtNFT/Manager/Message/invariants/artefacts/rapport

# CLAUDE_HANDOFF — Audit Solidity/Hardhat RESCOE

> Fichier de continuité, mis à jour après chaque étape. Aucun secret / clé / URL RPC / contenu `.env` ici.

## 1. Mission et périmètre exacts

Session PARALLÈLE à une session « frontend/Next/API ». **Ne JAMAIS toucher** `pages/`, `src/`, `public/`, `scripts/` (racine), `package.json` racine.
Périmètre autorisé : `Hardhat Solidity Deploy/` (tests, scripts d'analyse, contrats d'attaque, snapshot récupéré), `docs/SMART_CONTRACT_AUDIT.md`, `docs/CLAUDE_HANDOFF.md`, `docs/CLAUDE_UNCOMMITTED_DIFF.patch`.
Interdit : tx Base/Base Sepolia, déploiement public, modif `.env`, reset/stash/force-push, supprimer des artefacts, modifier les contrats pour masquer un finding, RPC non read-only.
Objectif : audit exécutable + vraie suite Hardhat (le « 0 passing » n'est pas acceptable) + `docs/SMART_CONTRACT_AUDIT.md`.

## 2. Git

- Branche : `claude/compassionate-edison-gecvpi` — commit de départ `15ae68551f83f5cf3c98e337eb51cf6d2960d116`.
- Commits de session : voir §13.

## 3. État d'avancement

**Terminé**
- Étape 0 : Cas B confirmé (AUCUN `.sol` suivi ni jamais committé ; `*.sol` gitignoré racine l.22). Seuls artefacts Remix + 6 build-info.
- Récupération + provenance : `scripts/audit/recover-sources.js` → `audit-recovered-contracts/` (+ MANIFEST.json). 6 artifacts Remix ↔ build-info **bytecode identique**.
- Recompilation exacte solcjs 0.8.30 : `scripts/audit/recompile-exact.js` → **44/44 contrats identiques (création + déployé)** aux build-info (`audit-recovered-contracts/RECOMPILE_RESULT.json`).
- Staging compilable : `scripts/audit/stage-sources.js` → `audit-src/recovered` (9 sources, 0 conflit de versions) + `audit-vendor/@openzeppelin` (22 fichiers exacts). Config `hardhat.audit.config.js` (solcjs local, remapping natif OZ, réseau hardhat seul).
- Compilation Hardhat locale : OK (32 fichiers, 35 s). Bytecode Hardhat = Remix hors hash métadonnées.
- Contrats d'attaque : `audit-src/attackers/Attackers.sol` (RejectingReceiver, StorageWritingReceiver, ReentrantReceiver, ForceSend, RewardMock).
- Fixtures : `test/audit/helpers/fixtures.js`.
- `test/audit/01_adhesion.test.js` : **41 passing**.

**En cours / à faire (ordre)**
1. `02_artnft.test.js` (ArtFactory+ArtNFT) : listing périmé, push-payments bloquants, wiring association=manager, burn O(n), dust bloqué, évasion de frais, mettreAJourPoints hard-dependency, réentrance, conservation des fonds.
2. `03_manager_factories.test.js` (ResCoellectionManager, permissions factories, createDynamicCollection ouvert).
3. `04_message_editions.test.js`.
4. What-if Adhesion (copie avec `_exists` corrigé, générée par script, jamais présentée comme source réelle) pour atteindre buyNFT/renew/list : vente, état vendeur/acheteur, points wash-trading, reentrancy.
5. `05_invariants.test.js` (fuzz seedé : conservation ETH ArtNFT/MessageEditions, level ≤ MAX_LEVEL, cohérence ownership/liste, pas de double comptage points).
6. `scripts/audit/analyze-artifacts.js` + `06_artifacts.test.js` : tailles bytecode/EIP-170, ABI Remix vs ABI frontend (`src/components/ABI/*`, LECTURE SEULE), divergences ArtFactory/Poetry/Haiku, MasterFactory/TokenManagement (bytecode Remix, tests boîte noire).
7. `docs/SMART_CONTRACT_AUDIT.md` (rapport final) ; mettre à jour `package.json` `test` → `hardhat --config hardhat.audit.config.js test`.

**Bloqué / impossible**
- Réseau : Sourcify, IPFS, binaires solc, tous les RPC publics Base/Base Sepolia sont refusés par le proxy (403). Seul npm joignable ⇒ pas de bytecode on-chain, pas de comparaison déployé/compilé, pas de sources vérifiées.
- Sources ABSENTES (ni .sol ni build-info) : InsectEvolution, InsectImageStorageV3, HaikuEditions, PoetryFactory, MasterFactory, TokenManagement. Seulement ABI frontend (+ bytecode/ABI Remix pour MasterFactory & TokenManagement).

## 4. Fichiers créés / modifiés

| Fichier | Raison |
|---|---|
| `docs/CLAUDE_HANDOFF.md` | continuité |
| `Hardhat Solidity Deploy/.gitignore` | ré-inclure `.sol` d'audit (`audit-recovered-contracts`, `audit-src`, `audit-vendor`, `test/audit`) + ignorer `cache-audit`, `artifacts-audit` |
| `Hardhat Solidity Deploy/package.json`, `package-lock.json` | `solc@0.8.30` devDependency exacte (solcjs, compilateur identique à l'origine) |
| `Hardhat Solidity Deploy/scripts/audit/{recover-sources,stage-sources,recompile-exact}.js` | provenance / staging / recompilation exacte |
| `Hardhat Solidity Deploy/audit-recovered-contracts/**` | sources RÉCUPÉRÉES (CRLF préservé via `.gitattributes -text`), MANIFEST.json, RECOMPILE_RESULT.json, README |
| `Hardhat Solidity Deploy/audit-src/**`, `audit-vendor/**` | arbre compilable (généré) + attackers (écrit à la main) |
| `Hardhat Solidity Deploy/hardhat.audit.config.js` | config d'audit hors-ligne |
| `Hardhat Solidity Deploy/test/audit/**` | tests |

## 5. Commandes exécutées / résultats exacts

- `git ls-files "*.sol"` → vide ; `git check-ignore -v …/AdhesionRescoe.sol` → `.gitignore:22:*.sol` ; historique : aucun .sol jamais committé.
- `cd "Hardhat Solidity Deploy" && npm ci` → 590 paquets. `npm i -D -E solc@0.8.30` → `0.8.30+commit.73712a01.Emscripten.clang`.
- `node scripts/audit/recover-sources.js` → 6 artifacts mappés (SepoliaFaucet, AdhesionRescoe, ResCoellectionManager, MessageFactory, ArtFactory, ArtNFT) ; sans build-info : MasterFactory, TokenManagement, IAdhesionContract, ICollectionFactory. Hash `Adhesion.sol` ≠ celui référencé par la métadonnée de TokenManagement.
- `node scripts/audit/stage-sources.js` → 9 sources métier, 22 OZ, 0 conflit.
- `npx hardhat --config hardhat.audit.config.js compile --force` → 32 fichiers OK en 35 s.
- `node scripts/audit/recompile-exact.js` → 44/44 identiques.
- `npx hardhat --config hardhat.audit.config.js test test/audit/01_adhesion.test.js` → **41 passing, 0 failing**.

## 6. Décisions techniques

- Config d'audit séparée (`hardhat.audit.config.js`) ; `hardhat.config.js` de prod NON modifiée.
- solcjs (npm) car binaires solc bloqués ; version identique à l'origine, vérifiée par recompilation exacte.
- OZ vendorisé à l'identique via `TASK_COMPILE_GET_REMAPPINGS` (TASK_COMPILE_TRANSFORM_IMPORT_NAME déprécié, HH215). Alternative écartée : `npm i @openzeppelin/contracts@5` (les sources utilisent un mélange 4.x/5.x : `Counters`, `security/ReentrancyGuard`).
- Convention tests : `[F-XXX-nn]` = test qui DÉMONTRE un bug (vert tant que le bug existe ; rougira une fois corrigé).
- `.gitattributes -text` local pour préserver les octets CRLF (sinon hashes du MANIFEST faux).

## 7. Hypothèses métier

- 1 point = 0.001 ETH de vente (ArtNFT) ; reproduction = 100 pts ; quota collections = points/5 ; membre trial 7 j, annuel 365 j.
- L'ABI frontend (`ABIAdhesion.json`, 141 entrées) décrit une version PLUS RÉCENTE d'Adhesion que la source récupérée (87 entrées). Les constats ci-dessous valent pour la source récupérée = artifact Remix `AdhesionRescoe.json`.

## 8. Findings déjà PROUVÉS par test (voir tests `[F-…]`)

Adhesion (source récupérée) : F-ADH-01 `mettreAJourPoints` sans contrôle d'accès (Critical) ; F-ADH-02 `_exists` lit un mapping jamais écrit ⇒ getUserInfo/getTokenDetails/getRemaining…/renew/list/buyNFT/buyRewardPoints revert (High/Critical dispo) ; F-ADH-03 `totalSupply()` récursif ; F-ADH-04 `burnAndUpgrade` sans délai (niveau 3 immédiat) ; F-ADH-05 listes obsolètes après burn ; F-ADH-06/06b ETH brûlé si relayer=0, burnNFT payé par le contrat (DoS si solde<DUST) ; F-ADH-07 `.transfer` incompatible wallets intelligents ; F-ADH-08 adhésion active/œuf transférables ; F-ADH-09 `_totalMinted` mort ; F-ADH-10 reproduction illimitée, généalogie absente, `Reproduced` jamais émis ; F-ADH-11 trop-perçu non remboursé (evolve/burnUpgrade) ; F-ADH-12 limite annuelle = bucket époque ; F-ADH-14 `membersByRole` doublons ; F-ADH-15 URI libre ; F-ADH-17 constructeur impose initialOwner==msg.sender ; **F-ADH-18 `evolveManual` : `delete` avant lecture ⇒ niveau bloqué à 1, totalYears/autoEvolve perdus**.

Suspicions lues dans le code (à prouver) : ArtNFT listing périmé après transfert (High) ; ArtNFT push-payments bloquants ; wiring `full-deploy.ts` (association = ResCoellectionManager sans receive ⇒ ventes ArtNFT bloquées) ; factories `createDynamicCollection` ouvertes ; Manager `admin` immuable ≠ owner, `addAdhesionContract` irréversible ; MessageEditions `_haikuIdFromToken` faux, haikuId 0 = sentinelle, prix non vérifié sur éditions existantes, surpaiement bloqué, pas de ReentrancyGuard malgré la doc, `getRemainingEditions` underflow ; `full-deploy.ts` référence des noms de contrats inexistants.

## 9. Modifications partielles / cassées

Aucune connue. Les tests `01_adhesion` sont verts.

## 10. Prochaine action précise

Écrire `test/audit/02_artnft.test.js` (voir §3 point 1) puis lancer : `cd "Hardhat Solidity Deploy" && npx hardhat --config hardhat.audit.config.js test test/audit/02_artnft.test.js`.

## 11. Commande de reprise

```bash
cd "/home/user/Rescoe/Hardhat Solidity Deploy" && npm ci && node scripts/audit/stage-sources.js \
 && npx hardhat --config hardhat.audit.config.js test
```

## 12. À lire en premier

1. ce fichier ; 2. `audit-recovered-contracts/README.md` ; 3. `audit-src/recovered/*.sol` ; 4. `test/audit/helpers/fixtures.js` ; 5. `test/audit/01_adhesion.test.js` ; 6. `hardhat.audit.config.js`.

## 13. État Git

- Commits de session : `5a7c526` (récupération), `2d2bd1b` (CRLF), + commits suivants (voir `git log --oneline 15ae685..HEAD`).
- `git status --short` : voir fin de session.

## 14. Confiance

- Provenance sources↔artifacts : très élevée (44/44 identiques).
- Tests Adhesion : élevée (exécutés, verts).
- Tout le reste : non évalué.

## 15. Non vérifié

- Comportement du contrat réellement déployé sur Base / Base Sepolia (aucun RPC).
- Contrats sans source (Insect*, Haiku/Poetry/Master/TokenManagement).
- Existence/ABI exactes des versions plus récentes que celles récupérées.
