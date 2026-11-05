STATUT DE REPRISE : PARTIEL (suite d'audit exécutable : 135 tests verts ; sources canoniques absentes ; what-if/invariants/Insect* non faits)

# Handoff Solidity — audit RESCOE (session parallèle, périmètre Solidity/Hardhat uniquement)

Document complémentaire : `docs/CLAUDE_HANDOFF.md` (historique détaillé de la session) et `docs/SMART_CONTRACT_AUDIT.md` (rapport).
Aucun secret, clé, JWT, URL RPC privée ni contenu `.env` dans ce fichier ni dans les commits.

## 1. Faits établis (vérifiés par commandes)

- **Aucun fichier `.sol` dans le checkout.** `git ls-files "*.sol"` → vide ; `find /home/user/Rescoe -name "*.sol"` (hors node_modules) → aucun avant mes ajouts ; aucun `.sol` jamais committé (50 commits).
- **Règle responsable** : `.gitignore` racine, ligne 22 : `*.sol` (`git check-ignore -v "Hardhat Solidity Deploy/contracts/AdhesionRescoe.sol"` → `.gitignore:22:*.sol`).
- **Artifacts Remix** (`Hardhat Solidity Deploy/contracts/artifacts/`) : AdhesionRescoe, ArtFactory, ArtNFT, IAdhesionContract, ICollectionFactory, MasterFactory, MessageFactory, ResCoellectionManager, SepoliaFaucet, TokenManagement (chacun `X.json` + `X_metadata.json`) ; plus `.deploys/pinned-contracts/{84532,vm-prague}` et `.states/vm-prague/state.json`.
- **Six build-info** (`contracts/artifacts/build-info/`, `hh-sol-build-info-1`, solc `0.8.30+commit.73712a01`, viaIR=true, optimizer 200 runs, evm prague) :
  `1bb837b7f243b38cc11e87aeb9c2b718` (SepoliaFaucet) ; `62c65c2725c5f8e7a251e20ca5f75b4b` (Adhesion.sol → AdhesionRescoe) ; `a6daef4aad03a7efa2b02383993f611a` (RescollectionFactory.sol → ResCoellectionManager) ;
  `d6da86064fab1a7b67a461342738ad26` (MessageEditions + MessageFactory) ; `e7e63d83b71107699b601bbabf24d633` (ArtFactory + mintArt → ArtNFT) ; `f248304931c349a3454c072f67d0dbe2` (mintArt.sol seul, octet-identique à celui de e7e63d83).
- **Récupérables depuis build-info** : AdhesionRescoe, ResCoellectionManager, MessageEditions, MessageFactory, ArtFactory, ArtNFT, SepoliaFaucet (+ interfaces IReward, ICollectionFactory, IAdhesionContract embarquée dans RescollectionFactory.sol).
- **Introuvables dans les build-info** : MasterFactory, TokenManagement (artifacts Remix présents, sans build-info), HaikuEditions, PoetryFactory, InsectEvolution, InsectImageStorageV3 (ni artifact ni build-info ; seulement ABI frontend pour Haiku/Poetry/InsectStorage ; rien pour InsectEvolution).
- **Compilateur utilisé pour l'audit** : paquet npm `solc@0.8.30` (solcjs) → `solc.version()` = `0.8.30+commit.73712a01.Emscripten.clang`, identique au compilateur des build-info. Les binaires solc ne sont pas téléchargeables (proxy).
- **Méthode keccak256** : `keccak256(utf8(input.sources[chemin].content))` (ethers) comparé à `sources[chemin].keccak256` des `*_metadata.json` Remix ; en plus `deployedBytecode`/`bytecode` de chaque artifact comparés à `output.contracts` du build-info ; en plus recompilation de l'`input` standard-JSON (solcjs) comparée octet à octet.
- **ABI frontend AdhesionRescoe ≠ artifact récupérable** : frontend `src/components/ABI/ABIAdhesion.json` = 141 entrées, constructeur `(initialOwner,_artist,_insectStorage)`, `safeMint` à 8 paramètres, fonctions `evolve/hatchEgg/relayerMint/mintRelayer/insectStorage/reproduce(uint256,uint256,uint8)/spendPoints…` ; artifact récupéré = 87 entrées, constructeur `(initialOwner)`, `safeMint` à 6 paramètres, `burnAndUpgrade/evolveManual/reproduce(uint256,uint256)` ; ABI épinglée Base Sepolia `0x83848a57…` = 71 entrées (3e version).
- **TokenManagement** : `TokenManagement_metadata.json` référence `Adhesion.sol` keccak256 `0xed39f1df0bc6a305…` ; la source récupérée (AdhesionRescoe) a `0x4dfa93861a81ee1b…` ⇒ **versions différentes** ; la plus récente est perdue.
- **Réseau** : Sourcify, IPFS (ipfs.io), `binaries.soliditylang.org`, `sepolia.base.org`, `mainnet.base.org`, publicnode : tous refusés par le proxy (`CONNECT tunnel failed, response 403`). Seul `registry.npmjs.org` répond. ⇒ **aucune comparaison avec le bytecode déployé (Base Sepolia ou mainnet) n'a été possible**. Aucune transaction n'a été envoyée.

## 2. Provenance par source (récupérée ≠ source actuelle)

| Source | build-info d'origine | Compilateur | Hash attendu | Hash obtenu | Concordance | Artifact associé | Confiance |
|---|---|---|---|---|---|---|---|
| `FaucetSepolia.sol` | `1bb837b7f243b38cc11e87aeb9c2b718` | 0.8.30+commit.73712a01 | `0x09abff3127e7e70b…` | `0x09abff3127e7e70b…` | oui (SepoliaFaucet) | SepoliaFaucet | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `Adhesion.sol` | `62c65c2725c5f8e7a251e20ca5f75b4b` | 0.8.30+commit.73712a01 | `0x4dfa93861a81ee1b…` | `0x4dfa93861a81ee1b…` | oui (AdhesionRescoe) ; NON pour TokenManagement | AdhesionRescoe | MOYENNE (diverge de TokenManagement) |
| `IReward.sol` | `62c65c2725c5f8e7a251e20ca5f75b4b` | 0.8.30+commit.73712a01 | `0x00593f6a7a5f27d3…` | `0x00593f6a7a5f27d3…` | oui (AdhesionRescoe, ArtFactory, ArtNFT, MasterFactory, MessageFactory, TokenManagement) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `RescollectionFactory.sol` | `a6daef4aad03a7efa2b02383993f611a` | 0.8.30+commit.73712a01 | `0xc245143dbc5fa5ca…` | `0xc245143dbc5fa5ca…` | oui (IAdhesionContract, ICollectionFactory, ResCoellectionManager) | ResCoellectionManager | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `MessageFactory.sol` | `d6da86064fab1a7b67a461342738ad26` | 0.8.30+commit.73712a01 | `0x21d38862b02446af…` | `0x21d38862b02446af…` | oui (MasterFactory, MessageFactory) | MessageFactory | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `ICollectionFactory.sol` | `d6da86064fab1a7b67a461342738ad26` | 0.8.30+commit.73712a01 | `0xe309f4b0e10e052c…` | `0xe309f4b0e10e052c…` | oui (ArtFactory, MasterFactory, MessageFactory) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `MessageEditions.sol` | `d6da86064fab1a7b67a461342738ad26` | 0.8.30+commit.73712a01 | `0x6d49c3d617b7c80d…` | `0x6d49c3d617b7c80d…` | oui (MasterFactory, MessageFactory) | (aucun artifact Remix ; build-info seul) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `IReward.sol` | `d6da86064fab1a7b67a461342738ad26` | 0.8.30+commit.73712a01 | `0x00593f6a7a5f27d3…` | `0x00593f6a7a5f27d3…` | oui (AdhesionRescoe, ArtFactory, ArtNFT, MasterFactory, MessageFactory, TokenManagement) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `ArtFactory.sol` | `e7e63d83b71107699b601bbabf24d633` | 0.8.30+commit.73712a01 | `0x66b84fa9ec930b3d…` | `0x66b84fa9ec930b3d…` | oui (ArtFactory, MasterFactory) | ArtFactory | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `ICollectionFactory.sol` | `e7e63d83b71107699b601bbabf24d633` | 0.8.30+commit.73712a01 | `0xe309f4b0e10e052c…` | `0xe309f4b0e10e052c…` | oui (ArtFactory, MasterFactory, MessageFactory) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `mintArt.sol` | `e7e63d83b71107699b601bbabf24d633` | 0.8.30+commit.73712a01 | `0x9277df70cc3d18b0…` | `0x9277df70cc3d18b0…` | oui (ArtFactory, ArtNFT, MasterFactory) | ArtNFT | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `IReward.sol` | `e7e63d83b71107699b601bbabf24d633` | 0.8.30+commit.73712a01 | `0x00593f6a7a5f27d3…` | `0x00593f6a7a5f27d3…` | oui (AdhesionRescoe, ArtFactory, ArtNFT, MasterFactory, MessageFactory, TokenManagement) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `mintArt.sol` | `f248304931c349a3454c072f67d0dbe2` | 0.8.30+commit.73712a01 | `0x9277df70cc3d18b0…` | `0x9277df70cc3d18b0…` | oui (ArtFactory, ArtNFT, MasterFactory) | ArtNFT | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |
| `IReward.sol` | `f248304931c349a3454c072f67d0dbe2` | 0.8.30+commit.73712a01 | `0x00593f6a7a5f27d3…` | `0x00593f6a7a5f27d3…` | oui (AdhesionRescoe, ArtFactory, ArtNFT, MasterFactory, MessageFactory, TokenManagement) | (interface) | ÉLEVÉE (keccak256 = métadonnée Remix + bytecode identique) |

Toute source ci-dessus est un **instantané historique compilé dans Remix** : ne jamais la présenter comme la source actuelle.

## 3. Fichiers et scripts créés (tous sous `Hardhat Solidity Deploy/` sauf docs)

- `scripts/audit/recover-sources.js` (extraction + vérif keccak256 + mappage artifact↔build-info → `audit-recovered-contracts/`), `stage-sources.js` (arbre compilable `audit-src/recovered` + `audit-vendor/@openzeppelin`, échoue sur conflit de versions), `recompile-exact.js` (recompilation exacte), `analyze-artifacts.js` (tailles EIP-170, ABI compilée/épinglée/frontend → `audit-reports/`), `probe-master.js` (sonde MasterFactory).
- `audit-recovered-contracts/` (sources RÉCUPÉRÉES, `MANIFEST.json`, `RECOMPILE_RESULT.json`, README d'avertissement, `.gitattributes -text` pour préserver le CRLF d'origine).
- `audit-src/attackers/Attackers.sol` (contrats d'attaque/mocks écrits à la main), `audit-src/recovered/` et `audit-vendor/` (générés).
- `hardhat.audit.config.js` (config d'audit hors-ligne) ; `test/audit/{01_adhesion,02_artnft,03_manager,04_message_editions,06_artifacts_blackbox}.test.js` + `helpers/fixtures.js`.
- `audit-reports/abi-bytecode-report.{json,md}`.
- `docs/SMART_CONTRACT_AUDIT.md`, `docs/CLAUDE_HANDOFF.md`, `docs/CLAUDE_HANDOFF_SOLIDITY.md`.
- `Hardhat Solidity Deploy/.gitignore` : ré-inclusion `!audit-recovered-contracts/**/*.sol`, `!audit-src/**/*.sol`, `!audit-vendor/**/*.sol`, `!test/audit/**/*.sol` ; ignore `/cache-audit`, `/artifacts-audit`.
- **package.json / package-lock.json** : ajout de `solc` en devDependency exacte `0.8.30` (**nécessaire** pour compiler hors-ligne ; à conserver). `hardhat.config.js` de production **non modifié**. `package.json` racine **non modifié**. Le script `test` de `Hardhat Solidity Deploy/package.json` est toujours `echo "Error: no test specified" && exit 1` (non modifié, à remplacer par `hardhat --config hardhat.audit.config.js test`).
- Piège connu : `node scripts/audit/stage-sources.js` supprime et régénère `audit-vendor/` (donc son `.gitattributes`) : faire `git restore "Hardhat Solidity Deploy/audit-vendor/.gitattributes"` ensuite (déjà fait ; à corriger dans le script).

## 4. Commandes exécutées en fin de session (résultats exacts)

| Commande (depuis `Hardhat Solidity Deploy/`) | Code de sortie | Résultat |
|---|---|---|
| `node scripts/audit/recover-sources.js` | 0 | 6 build-info ; 6 artifacts mappés (exact) ; non appariés : IAdhesionContract, ICollectionFactory, MasterFactory, TokenManagement |
| `node scripts/audit/stage-sources.js` | 0 | `staged: 9 sources métier, 22 fichiers OpenZeppelin, 0 conflit` |
| `node scripts/audit/analyze-artifacts.js` | 0 | rapport régénéré (`audit-reports/`) ; MessageFactory 23 680 o = 96,4 % EIP-170 |
| `npx hardhat --config hardhat.audit.config.js test` | 0 | **135 passing, 0 failing** (~10 s) ; 68 tests `[F-…]` = tests de REPRODUCTION de bugs (verts tant que le défaut existe) ; 8 tests `[ABI-…]` |
| `node scripts/audit/recompile-exact.js` (exécuté plus tôt dans la session) | 0 | `TOTAL contrats comparés: 44 \| identiques (déployé+création): 44` ; relancé en fin de session : non (un lancement parallèle a échoué à cause d'une variable shell non définie, sans effet sur le dépôt) |
| `npx hardhat --config hardhat.audit.config.js compile --force` (plus tôt) | 0 | 32 fichiers, 35 s, aucun téléchargement |

Aucun contrat n'a été modifié pour faire passer un test. `git status` en fin de session ne montrait que `docs/` non suivis (avant commit).
La suite complète **s'exécute** car les sources récupérées sont compilables ; ce n'est **pas** une validation des sources actuelles (limite structurelle : sources canoniques absentes).

## 5. Reprise

- Branche : `claude/compassionate-edison-gecvpi` ; commit de départ `15ae68551f83f5cf3c98e337eb51cf6d2960d116`.
- Commande de reprise :

```bash
cd "/home/user/Rescoe/Hardhat Solidity Deploy" && npm ci && node scripts/audit/stage-sources.js \
 && git restore "audit-vendor/.gitattributes" && npx hardhat --config hardhat.audit.config.js test
```

- Cinq fichiers à lire en premier : `docs/SMART_CONTRACT_AUDIT.md` ; `docs/CLAUDE_HANDOFF_SOLIDITY.md` ; `Hardhat Solidity Deploy/audit-recovered-contracts/README.md` + `MANIFEST.json` ; `Hardhat Solidity Deploy/test/audit/helpers/fixtures.js` ; `Hardhat Solidity Deploy/audit-reports/abi-bytecode-report.md`.
- Trois prochaines actions exactes :
  1. Rendre disponibles les **sources Solidity canoniques** correspondant aux contrats actuellement configurés (Adhesion V3 à 141 entrées, InsectEvolution, InsectImageStorageV3, Haiku/Poetry/Master/TokenManagement) : retrouver le dossier Remix/poste d'origine, et versionner les `.sol` (`git add -f` ou retirer `*.sol` du `.gitignore` racine).
  2. Vérifier leur provenance contre artifacts **et bytecode déployé** (RPC lecture seule `eth_getCode`, hors de ce sandbox) en réutilisant `recover-sources.js` / `recompile-exact.js` / `analyze-artifacts.js`.
  3. Compléter fixtures/tests : variante what-if d'Adhesion (`_exists` réparé) pour `buyNFT/renewMembership/listTokenForSale`, `05_invariants` (fuzz seedé : conservation des fonds, niveau ≤ MAX_LEVEL, pas de double comptage), puis tests des contrats Insect*.

## 6. État Git final

- Branche : `claude/compassionate-edison-gecvpi` ; commit de départ : `15ae68551f83f5cf3c98e337eb51cf6d2960d116`.
- Commits créés pendant la session (avant ce dernier commit de handoff) :
```
d6f71ac docs(audit): rapport SMART_CONTRACT_AUDIT.md + handoff de reprise Solidity
1f6dfba audit(solidity): analyse des artefacts + tests boîte noire MasterFactory/TokenManagement (24)
68d3890 audit(solidity): suites ResCoellectionManager (12) et MessageEditions/Factory (27)
5d3ac72 audit(solidity): suite ArtFactory/ArtNFT (31 tests verts)
90851f2 audit(solidity): config Hardhat d'audit hors-ligne + suite Adhesion (41 tests verts)
2d2bd1b audit(solidity): préserver les octets CRLF exacts des sources récupérées
5a7c526 audit(solidity): récupération des sources depuis build-info + preuve de provenance
```
- `git status --short` avant le commit final du handoff : `(propre)` (seulement ce fichier mis à jour).
- Fichiers non committés : aucun (hors ce handoff, committé juste après). `node_modules/`, `cache-audit/`, `artifacts-audit/` sont ignorés (non suivis). Aucun `.env`, secret, JWT ni URL RPC suivi (vérifié par `git ls-files | grep -E "\.env|node_modules"` → vide).
- Push : `git push -u origin claude/compassionate-edison-gecvpi` (sans force) ; résultat consigné dans le message de fin de session.

