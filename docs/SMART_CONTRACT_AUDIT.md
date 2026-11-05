# Audit des smart contracts RESCOE — rapport de fin de session

> **Avertissement fondamental.** Les sources Solidity métier **ne sont versionnées nulle part** (`*.sol` est ignoré par
> `.gitignore:22`, aucun `.sol` n'a jamais été committé). Cet audit porte sur des **sources RÉCUPÉRÉES depuis les `build-info`**
> (`Hardhat Solidity Deploy/audit-recovered-contracts/`), **pas sur les dernières sources métier**. « PROUVÉ » signifie : démontré
> par un test Hardhat exécuté localement **sur ces sources récupérées**. Aucune comparaison avec le bytecode déployé sur Base / Base Sepolia
> n'a été possible (RPC bloqués). L'impact en production **n'est donc pas confirmé**, sauf mention contraire.

## Résumé exécutif

- Suite Hardhat d'audit : **135 tests passants, 0 échec** (`npx hardhat --config hardhat.audit.config.js test`, exit 0, ~10 s).
  **68 tests « [F-…] » démontrent un défaut** (ils passent tant que le défaut existe et échoueront une fois le contrat corrigé), **8 tests « [ABI-…] »**
  documentent des incohérences d'ABI ; les ~59 autres vérifient des comportements attendus (permissions, prix, remboursements, répartitions).
- Provenance : 6 artifacts Remix sont **identiques octet pour octet** au bytecode d'un build-info ; la recompilation exacte
  (solcjs `0.8.30+commit.73712a01`) reproduit **44/44 contrats** (création + déployé, métadonnées incluses).
- **6 contrats n'ont aucune source récupérable** : InsectEvolution, InsectImageStorageV3, HaikuEditions, PoetryFactory, MasterFactory (bytecode+ABI Remix seulement), TokenManagement (idem).
  Les contrats prioritaires 2 et 3 de la mission (InsectEvolution, InsectImageStorageV3) **n'ont pu faire l'objet d'aucun audit de code**.
- L'ABI frontend `AdhesionRescoe` (141 entrées) décrit un contrat **beaucoup plus récent** que l'artifact récupérable (87) et que l'ABI épinglée Base Sepolia (71) : trois versions coexistent.
- Findings les plus graves **sur les sources récupérées** (PROUVÉS) : points de récompense modifiables par n'importe qui (F-ADH-01),
  fonctions d'adhésion inutilisables (F-ADH-02) qui bloquent `ResCoellectionManager` (F-MGR-01), évolution manuelle cassée (F-ADH-18),
  annonce périmée permettant le rachat forcé d'un NFT (F-ART-01), factories à création ouverte (F-FAC-01, F-MST-01).
  Aucun n'est qualifié « Critical » : l'exploitabilité en production dépend de la version réellement déployée, non vérifiable ici.

## Sources réellement disponibles

| Élément | État |
|---|---|
| `.sol` dans le checkout | **aucun** (ni suivi, ni ignoré présent sur disque) |
| Cause | règle `*.sol` dans `.gitignore` racine (ligne 22) ; `git check-ignore -v "Hardhat Solidity Deploy/contracts/AdhesionRescoe.sol"` → `.gitignore:22:*.sol` |
| Historique Git | aucun `.sol` jamais committé (50 commits inspectés) |
| Artifacts Remix (`contracts/artifacts/*.json` + `*_metadata.json`) | AdhesionRescoe, ArtFactory, ArtNFT, IAdhesionContract, ICollectionFactory, MasterFactory, MessageFactory, ResCoellectionManager, SepoliaFaucet, TokenManagement |
| `build-info` (6, `hh-sol-build-info-1`, solc 0.8.30+commit.73712a01, viaIR, optimizer 200 runs, evm prague) | `1bb837b7…` Faucet ; `62c65c27…` Adhesion ; `a6daef4a…` RescollectionFactory ; `d6da8606…` MessageEditions+MessageFactory ; `e7e63d83…` ArtFactory+mintArt ; `f2483049…` mintArt |
| Dépôts d'adresses | `contracts/.deploys/pinned-contracts/84532/*.json` (ABI épinglées Base Sepolia) ; `deploy-ui/deployed.json` (réseau `hardhat` local uniquement) |

Mélange OpenZeppelin : `package.json` déclare `@openzeppelin/contracts ^4.9.6` mais les sources compilées utilisent un mélange 4.x/5.x
(`Counters`, `security/ReentrancyGuard` en v4 ; `ERC721Utils`, `_update`, erreurs custom en v5). Les fichiers OZ exacts sont dans `audit-vendor/`.

## Chaîne de provenance des artifacts

Méthode : `keccak256(contenu de input.sources[x])` comparé au `keccak256` de `*_metadata.json` Remix ; bytecode déployé et de création
de chaque artifact comparés à `output.contracts[...]` de chaque build-info ; recompilation de l'`input` standard-JSON avec solcjs et comparaison octet à octet.

| Artifact Remix | build-info producteur | Déployé identique | Création identique |
|---|---|---|---|
| AdhesionRescoe | `62c65c27…` | oui | oui |
| ResCoellectionManager | `a6daef4a…` | oui | oui |
| MessageFactory | `d6da8606…` | oui | oui |
| ArtFactory | `e7e63d83…` | oui | oui |
| ArtNFT | `e7e63d83…` **et** `f2483049…` (`mintArt.sol` octet-identique) | oui | oui |
| SepoliaFaucet | `1bb837b7…` | oui | oui |
| MasterFactory, TokenManagement, IAdhesionContract, ICollectionFactory | **aucun** | — | — |

Sources récupérées (hash « attendu » = métadonnée Remix ; « obtenu » = keccak256 calculé ; tronqués) :

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

Remarques : `Adhesion.sol` concorde avec la métadonnée d'**AdhesionRescoe** mais **diverge** de celle de **TokenManagement**
(`0xed39f1df…` attendu côté TokenManagement vs `0x4dfa9386…`) : TokenManagement a été compilé contre une **autre** version d'`Adhesion.sol`, perdue.
Confiance « ÉLEVÉE » = la source est bien celle qui a produit l'artifact Remix ; **cela ne prouve pas** que cet artifact soit la version déployée en production.
Pour ArtNFT, ResCoellectionManager, ArtFactory, MessageFactory, MasterFactory, TokenManagement, Faucet, l'ABI compilée est **identique** à l'ABI épinglée Base Sepolia (indice favorable, non concluant).
Pour AdhesionRescoe, l'ABI épinglée Base Sepolia (71 entrées) **diffère** de la compilée (87) : la source récupérée n'est pas la version épinglée.

## Contrats non récupérables

| Contrat | Disponible | Conséquence |
|---|---|---|
| InsectEvolution | rien (aucune ABI ni artifact trouvés) | non audité |
| InsectImageStorageV3 | ABI frontend `ABIInsectStorage.json` (21 fonctions) | non audité (analyse d'ABI seulement) |
| HaikuEditions | ABI frontend (37 fonctions, 11 erreurs) | non audité |
| PoetryFactory | ABI frontend **identique** à celle d'ArtFactory | non audité |
| MasterFactory | ABI + bytecode Remix (1 424 o) | **boîte noire** (tests locaux depuis le bytecode) |
| TokenManagement | ABI + bytecode Remix (2 825 o) | **boîte noire** |
| GenerativeArt (`ABI_GENERATIVE_ART.json`) | ABI frontend | non audité |

## Divergences ABI/artifacts

Détail complet généré : `Hardhat Solidity Deploy/audit-reports/abi-bytecode-report.md` (script `scripts/audit/analyze-artifacts.js`).

- **AdhesionRescoe** : constructeur frontend `(initialOwner,_artist,_insectStorage)` vs compilé `(initialOwner)` ; 31 fonctions frontend absentes du compilé
  (`evolve`, `hatchEgg`, `relayerMint`, `mintRelayer`, `insectStorage`, `spendPoints`, `reproductionParents`, `lockAndExtendOneYear`…) ; `safeMint` : 8 paramètres (frontend) vs 6 (compilé). **PRÉLIMINAIRE** quant à la version en production ; l'écart ABI lui-même est **PROUVÉ** (tests ABI-01..03).
- **ArtFactory** : le frontend attend `setAuthorizedCallers`, `masterFactoryAuthorized`, `resCollectionsAuthorized`, `getUserCollectionConfig` ; absents du compilé et de l'ABI épinglée (ABI-04).
- **ResCoellectionManager** : le frontend attend `registerCollection`, `authorizedCollections`, `addPendingPoints`, `claimPendingToRewards`, `rewardRelayer`… ; absents (ABI-05).
- **MasterFactory** : constructeur frontend à 4 factories (`generativeFactoryAddress`) vs 3 dans le bytecode Remix et l'ABI épinglée (ABI-06).
- **MessageFactory** : constructeur frontend `(initialOwner,adhesion)` vs `(adhesion)` ; **MessageEditions** : l'ABI frontend (`mintDiscord`, `mintEdition`, soulbound…) n'a presque rien de commun avec la source (ABI-07).
- **ArtNFT** : frontend `mintBatch`, `setReveal`, `hiddenMetadataURI` absents ; `setTokenMetadataOnChain`, `tokenRarity` absents du frontend.
- **Tailles** : MessageFactory 23 680 o = **96,4 % d'EIP-170** (marge 896 o) ; ArtFactory 80,3 % ; AdhesionRescoe 75 % ; MessageEditions 73,7 % ; tous les initcodes < 49 152 o.

## Tests exécutables

Config : `Hardhat Solidity Deploy/hardhat.audit.config.js` (solcjs local, OZ vendorisé, réseau `hardhat` uniquement, aucun `.env`, aucun RPC).

| Fichier | Tests | Périmètre |
|---|---:|---|
| `01_adhesion.test.js` | 41 | permissions, trial/annuel, prix exact/sous-paiement/remboursement, limites annuelles, burn, évolution, reproduction, transferts, réentrance |
| `02_artnft.test.js` | 31 | ArtFactory + ArtNFT : splits primaire/secondaire, listing périmé, push-payments, gas de `burn`, réentrance, wiring |
| `03_manager.test.js` | 12 | ResCoellectionManager : permissions, quota, admin≠owner, adhésions |
| `04_message_editions.test.js` | 27 | MessageEditions/Factory : mint, répartition, identité des haikus, fonds bloqués, injection JSON/SVG, gas |
| `06_artifacts_blackbox.test.js` | 24 | EIP-170, divergences ABI, MasterFactory & TokenManagement en boîte noire |
| **Total** | **135** | 0 échec |

**Non réalisés** (écrits dans la feuille de route du handoff) : variante « what-if » d'Adhesion avec `_exists` réparé (pour atteindre `buyNFT`/`renewMembership`/`listTokenForSale`),
tests d'invariants/fuzz seedés (`05_invariants`). Les invariants de conservation des fonds ne sont couverts que par des cas déterministes (sommes exactes en primaire/secondaire/mint).

## Findings prouvés

Légende : **PROUVÉ** = test vert sur source récupérée. Sévérités relatives à la **source récupérée** ; impact production non confirmé.

| ID | Sévérité | Contrat.fonction | Résumé / scénario | Préconditions | Test | Correction minimale | Contrats déjà déployés |
|---|---|---|---|---|---|---|---|
| F-ADH-01 | **High** (Critical si version déployée confirmée) | `AdhesionRescoe.mettreAJourPoints(address,uint256)` | aucun contrôle d'accès : n'importe qui s'attribue des points illimités ⇒ coût de reproduction (100 pts) et quota de collections (points/5) contournés | aucune | `[F-ADH-01]`, `[F-MGR-02]`, `[F-ADH-10]` | restreindre aux contrats autorisés (collections enregistrées / relayer). **Attention** : sans liste blanche, les `ArtNFT`/`MessageEditions` existants (qui appellent cette fonction directement) verront toutes leurs ventes revert (F-ART-07) | non corrigeable sans redéploiement ; migration des points nécessaire |
| F-ADH-02 | **High** (disponibilité) | `_exists` / `getUserInfo`, `getRemainingMembershipTime`, `getTokenDetails`, `renewMembership`, `listTokenForSale`, `buyNFT`, `buyRewardPoints` | `_exists` lit `_owners`, jamais écrit ⇒ revert pour tout token existant ; `getUserInfo` revert (membre et non-membre) | aucune | `[F-ADH-02]`, `[F-ADH-02b]` | utiliser `_ownerOf(tokenId) != address(0)` | idem |
| F-MGR-01 | **High** (dispo, conséquence de F-ADH-02) | `ResCoellectionManager.createCollection` | impossible avec le vrai Adhesion récupéré (membre : « Token does not exist » ; non-membre : « User is not a member ») ; idem salons à adhésion (F-MSG-09) | Adhesion récupéré câblé | `[F-MGR-01]`, `[F-MSG-09]` | corriger F-ADH-02 ; ne pas faire revert `getUserInfo` pour un non-membre | idem |
| F-ADH-18 | **High** (fonctionnel) | `evolveManual` | `delete membershipInfo[old]` avant lecture de `info` (pointeur storage) : niveau bloqué à 1, `totalYears`/`autoEvolve` perdus ⇒ niveau 3 et reproduction inaccessibles | aucune | `[F-ADH-18]`, `[F-ADH-18b]` | copier `info` en `memory` avant `delete` | idem |
| F-ADH-04 | **Medium/High** | `burnAndUpgrade` | aucun délai : niveau 3 en 3 appels à 0,0001 ETH ; +10 pts/burn | aucune | `[F-ADH-04]`, `[F-ADH-04b]` | ajouter le contrôle de délai de `evolveManual` ou supprimer la fonction | idem |
| F-ART-01 | **High** | `ArtNFT.buyNFT` / `listNFTForSale` | le flag « en vente » survit à `transferFrom` : un tiers rachète au vieux prix le NFT que la victime détient désormais (la victime reçoit 90 % du vieux prix) | NFT listé puis transféré hors `buyNFT` | `[F-ART-01]` | effacer `_tokenForSale/_tokenPrices` dans `_update` | contrats immuables : listes à retirer manuellement avant tout transfert |
| F-ART-02 / 02b | **Medium** (disponibilité) | `ArtNFT.buyNFT` | un `extraRecipient` ou l'association qui refuse l'ETH bloque définitivement toutes les ventes de la collection (listes immuables) | destinataire = contrat sans `receive` | `[F-ART-02]`, `[F-ART-02b]` | pull-payments (`pendingWithdrawals` existe mais n'est jamais alimenté) | collections concernées irrécupérables |
| F-FAC-02 | **Medium** | `scripts/full-deploy.ts` / `ArtFactory` | association = `ResCoellectionManager` (sans `receive`) ⇒ toute vente ArtNFT revert ; le script référence en outre des contrats inexistants (`Adhesion`, `AdhesionManagement`, `ResCollectionManager`) | suivre ce script | `[F-FAC-02]` | passer le vault réel ; mettre à jour le script | — |
| F-FAC-01 / 01b / F-MST-01 | **Medium** | `ArtFactory`, `MessageFactory`, `MasterFactory.createDynamicCollection(string,string,address,uint256)` | aucun contrôle d'accès : déploiement de collections au nom de n'importe qui, `collectionId` usurpés, registres pollués | nom de config existant | `[F-FAC-01]`, `[F-FAC-01b]`, `[F-MST-01]` | `onlyAuthorized` (le frontend l'attend déjà : ABI-04) | ABI épinglée = sans contrôle |
| F-MSG-01/01b/01c | **High** (fonctionnel) | `MessageEditions._haikuIdFromToken` | éditions ouvertes non listables/vendables/brûlables ; tokens attribués au mauvais haiku (royalties et compteurs faux) | ≥ 2 haikus ou édition ouverte | `[F-MSG-01*]` | stocker `tokenIdToHaikuId` à la création | idem |
| F-MSG-02 | **Medium** | `MessageEditions.mint` | premier haiku d'id 0 = sentinelle ⇒ sa 2e édition crée un nouveau haiku | premier message | `[F-MSG-02]` | démarrer les ids à 1 | idem |
| F-MSG-03/03b | **High** | `MessageEditions.mint` | prix, texte, image fournis par le minteur : édition d'un haiku existant pour 1 wei, métadonnées falsifiées ; squat du `messageId` | messageId public | `[F-MSG-03]`, `[F-MSG-03b]` | lire prix/texte du haiku stocké | idem |
| F-MSG-04/04b | **Medium** | `buyEdition` | surpaiement et royalties vers `address(0)` bloqués définitivement (aucun retrait) | surpaiement / royalty = 0 | `[F-MSG-04]`, `[F-MSG-04b]` | exiger `msg.value == price` ; rembourser | fonds déjà bloqués non récupérables |
| F-MSG-08/08b/08c | **Low/Medium** | `tokenURI` on-chain | `imageUrl` non échappé (injection de champs), `\` non échappé (JSON invalide), SVG avec texte brut (`<script>`) | minteur | `[F-MSG-08*]` | échapper / valider | idem |
| F-ADH-06/07, F-ART-10 | **Medium** | `payable(relayer).transfer`, `.transfer` en général, `call` vers `address(0)` | relayer = `address(0)` ⇒ ETH brûlé ; relayer/owner = wallet intelligent ⇒ mints bloqués (2300 gas) | misconfiguration | `[F-ADH-06]`, `[F-ADH-07]`, `[F-ART-10]` | validation d'adresses ; `call` | idem |
| F-ADH-17 / F-TMG-02 | **Medium** (déploiement) | constructeurs d'`AdhesionRescoe` et `TokenManagement` | `transferOwnership(initialOwner)` onlyOwner ⇒ revert si `initialOwner != msg.sender` ; la clé de déploiement est owner jusqu'au transfert | — | `[F-ADH-17]`, `[F-TMG-02]` | supprimer l'appel redondant | — |
| F-MGR-03/03b | **Medium** | `ResCoellectionManager.admin` | `admin` = déployeur, sans setter : `updateFactoryAddress`, `updateCollection`, `setCollectionActiveStatus` à vie, même après transfert d'ownership | — | `[F-MGR-03*]` | remplacer par `owner()` | — |
| F-MGR-04 | **Medium** | `addAdhesionContract` | pas de retrait ni de validation : une adresse invalide bloque `createCollection` pour tous | erreur d'owner | `[F-MGR-04]` | ajouter `remove`/validation | — |
| F-ART-03 | **Medium** (disponibilité) | `ArtNFT.burn` | O(n) : ≈ 4 800 gas/élément (808 k gas pour le dernier token d'une collection de 150) ⇒ > ~6 000 éditions non brûlables sous 30 M gas | grosses collections | `[F-ART-03]` | mapping d'index | — |
| F-ART-05 | **Low** (décision métier) | `ArtNFT.buyNFT` | vente « primaire » via 2e wallet : frais association 3 % au lieu de 10 % | — | `[F-ART-05]` | décision métier | — |
| Divers Low | | F-ADH-03 (`totalSupply` récursif), -05, -09, -10, -11, -12, -14, -15 ; F-ART-04/06/07/09/11/12/13 ; F-MSG-05/06/07/10/11 ; F-FAC-03/04 ; F-MST-02 ; F-TMG-01 | voir tests homonymes | | | | |

## Findings à confirmer

Tous **PRÉLIMINAIRES** (aucun test possible sans source ou sans RPC) :

1. **MasterFactory permet apparemment la création dynamique à tout appelant** — *PROUVÉ en boîte noire local* : artifact Remix `MasterFactory.json` (bytecode 1 424 o), `createDynamicCollection(string,string,address,uint256)`. Preuve : `[F-MST-01]` (déploiement local depuis le bytecode Remix, un attaquant crée une collection au nom d'un tiers). **À confirmer** : que le contrat déployé sur Base soit ce bytecode (ABI épinglée Base Sepolia identique, bytecode on-chain non comparé). Impact : spam de collections, `collectionId` usurpés ; pas de vol de fonds.
2. **`updateFactory(string,address)` ne valide pas que la nouvelle adresse est un contrat compatible** — *PROUVÉ en boîte noire local* : test « updateFactory… un EOA bloque ensuite toute création ». Préconditions : owner compromis ou erreur. Impact : blocage de la création de collections. Sévérité Low/Medium.
3. **ABI frontend AdhesionRescoe plus récente que l'artifact récupérable** — *PROUVÉ (écart d'ABI)*, impact *PRÉLIMINAIRE* : le comportement du contrat que le frontend appelle réellement est **inconnu** (sources `evolve/hatchEgg/reproduce/insectStorage` introuvables). Tests `[ABI-01]..[ABI-03]`. Blocage : aucune source ni RPC.
4. **TokenManagement construit contre une autre version d'Adhesion** — *PROUVÉ (hash)* : `TokenManagement_metadata.json` référence `Adhesion.sol` `0xed39f1df…` ≠ `0x4dfa9386…` ; `[F-TMG-01]` : `getTokensPaginated` échoue contre l'Adhesion récupéré. Impact production *PRÉLIMINAIRE*.
5. Contrats sans source (InsectEvolution, InsectImageStorageV3, HaikuEditions, PoetryFactory) : **aucune conclusion** ; seules leurs surfaces d'ABI sont connues. `ABIInsectStorage.json` expose `setUploader`, `setInsectImage`, `appendInsectChunk`, `finalizeInsect`, `contributeInsectMeta`, `clearInsectImage` — **contrôles d'accès inconnus**.
6. Réentrance : non exploitable sur les sources récupérées (nonReentrant dans `ArtNFT.buyNFT`, `_transfer` final en cas d'appel intermédiaire, ID de token identique dans `MessageEditions.mint`) mais `MessageEditions` n'a **pas** de garde malgré sa documentation (F-MSG-05).

## Limites de l'audit

- Sources récupérées ≠ sources actuelles ; versions plus récentes (ABI frontend) perdues ou jamais compilées avec Remix.
- Aucun accès réseau utile : RPC Base/Base Sepolia, Sourcify, IPFS, binaires solc (téléchargement) **bloqués** (HTTP 403 sur CONNECT). Aucune comparaison de bytecode déployé. Les compilations utilisent solcjs (npm).
- Pas d'audit de InsectEvolution, InsectImageStorageV3, HaikuEditions, PoetryFactory (aucune source).
- Pas de fuzz/invariants automatisés ni de variante « what-if » d'Adhesion ; les chemins `buyNFT`/`renewMembership`/`listTokenForSale` d'Adhesion sont donc **non testés** au-delà de leur revert (F-ADH-02).
- `deploy-ui` (frontend de déploiement) non audité ; frontend/API non audités (hors périmètre).

## Actions nécessaires pour reprendre

1. Rendre disponibles les **sources canoniques** correspondant aux contrats actuellement configurés (retirer `*.sol` du `.gitignore` racine ou committer avec `git add -f`).
2. Vérifier leur provenance contre artifacts et **bytecode déployé** (RPC lecture seule), pour Adhesion V3 (ABI 141 entrées), Insect*, Haiku/Poetry/Master/TokenManagement.
3. Compléter fixtures/tests métier : what-if Adhesion, invariants/fuzz, tests des contrats Insect.
Voir `docs/CLAUDE_HANDOFF_SOLIDITY.md` pour les commandes exactes.

## Blocages avant mainnet

1. Sources Solidity non versionnées ; version déployée non identifiée (3 versions d'Adhesion).
2. F-ADH-01 (points ouverts) et F-ART-01 (annonce périmée) à corriger **ou** confirmer absents de la version déployée.
3. F-ADH-02 / F-ADH-18 / F-MSG-01..03 si ces versions sont celles déployées (fonctions centrales cassées).
4. Création de collections ouverte (F-FAC-01, F-MST-01) tant que `setAuthorizedCallers` n'est pas en place.
5. Wiring : association ≠ contrat sans `receive` ; `relayer` ≠ wallet intelligent ; `admin`/owner définis ; `full-deploy.ts` à réécrire.
6. Aucune revue du code Insect*/Haiku/Poetry.
