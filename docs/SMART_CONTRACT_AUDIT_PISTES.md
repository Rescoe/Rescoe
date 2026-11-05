# Pistes d'amélioration — suite de l'audit Solidity RESCOE

> Note ciblée, **sans modification de code**. Complète `docs/SMART_CONTRACT_AUDIT.md` (constats) et `docs/CLAUDE_HANDOFF_SOLIDITY.md` (reprise).
> Classement par ordre de rentabilité : ce qui débloque le plus d'audit en premier.

## 1. Débloquer l'audit (bloquant, effort faible)

1. **Versionner les sources `.sol`.** Aujourd'hui `*.sol` est ignoré (`.gitignore` racine, l.22) : aucun historique, aucune revue, aucun CI possible.
   Piste : retirer la règle racine, ou la limiter (`!Hardhat Solidity Deploy/contracts/**`), et committer les sources canoniques.
2. **Retrouver les sources perdues** (Adhesion V3 à 141 entrées, InsectEvolution, InsectImageStorageV3, Haiku/Poetry/Master/TokenManagement). Sources possibles, à tester depuis une machine avec réseau :
   - le workspace Remix local (dossier ou stockage du navigateur) et ses `.states/`, `.deploys/` ;
   - Basescan / Sourcify, par adresse (les adresses Base Sepolia sont dans `contracts/.deploys/pinned-contracts/84532/`) ;
   - le hash IPFS de métadonnées inscrit en fin de bytecode (suffixe CBOR) : il permet de retrouver le JSON de métadonnées si Remix l'a publié ;
   - une sauvegarde ou un poste de développement antérieur.
3. **Comparer au bytecode déployé** avec un RPC en lecture seule (`eth_getCode`) : c'est le seul moyen de savoir quelle version tourne réellement. Les scripts `recover-sources.js`, `recompile-exact.js` et `analyze-artifacts.js` sont prêts ; il manque seulement l'accès réseau.

## 2. Décisions de conception à prendre avant de corriger

- **Version cible d'Adhesion** : trois versions coexistent (87 / 71 / 141 entrées). Décider laquelle est la référence, puis auditer celle-là.
- **Modèle de points** : aujourd'hui n'importe qui peut en créer (F-ADH-01). Le frontend attend déjà un modèle « collections enregistrées » (`registerCollection`, `authorizedCollections`, `addPendingPoints`). Choisir ce modèle, et décider comment les `ArtNFT` déjà déployés (adhésion immuable par collection) seront traités.
- **Paiements** : passer des envois « push » (`.transfer`, `call` vers les destinataires) à des retraits « pull » (`pendingWithdrawals` existe déjà mais n'est jamais alimenté). Cela règle les blocages par destinataire (F-ART-02), les wallets intelligents (F-ADH-07) et les fonds bloqués (F-MSG-04).
- **Annonces de vente** : décider qu'un transfert annule toute annonce (F-ART-01).
- **Droits** : une seule source de vérité pour `owner` / `admin` / `relayer` ; transfert d'ownership en deux étapes ; contrôle d'accès sur toutes les factories (le frontend attend `setAuthorizedCallers`).
- **Identifiants** : démarrer les ids de haikus à 1 et stocker le haiku de chaque token à la création (F-MSG-01, F-MSG-02).

## 3. Plan de correction par priorité (à exécuter après réception des sources canoniques)

| Priorité | Sujet | Findings |
|---|---|---|
| P0 | Contrôle d'accès des points, liste blanche des collections | F-ADH-01, F-ART-07 |
| P0 | Existence de token et évolution cassées | F-ADH-02, F-ADH-18, F-MGR-01 |
| P0 | Annonce périmée | F-ART-01 |
| P1 | Factories ouvertes, wiring de déploiement | F-FAC-01/02, F-MST-01, `full-deploy.ts` |
| P1 | Pull-payments, `address(0)`, remboursement des surpaiements | F-ART-02/10, F-MSG-04, F-ADH-06/07/11 |
| P1 | Logique des haikus | F-MSG-01/02/03 |
| P2 | Gas non borné, échappement JSON/SVG, taille de bytecode | F-ART-03, F-MSG-06/08, F-ART-13 |

Chaque correction devrait **inverser le test `[F-…]` correspondant** (il passe tant que le bug existe) et ajouter un test du comportement attendu. Prévoir aussi un plan de migration : les collections `ArtNFT`/`MessageEditions` déjà déployées sont immuables.

## 4. Renforcer les tests

- Variante « what-if » d'Adhesion avec `_exists` réparé, pour atteindre `buyNFT`, `renewMembership`, `listTokenForSale` (vente, état du vendeur, rôle de l'acheteur, points).
- Invariants et fuzz : conservation des fonds, niveau ≤ `MAX_LEVEL`, absence de double comptage de points, cohérence propriétaire / liste de tokens. Piste : Foundry ou Echidna, qui lisent directement les sources une fois versionnées.
- Outils complémentaires : Slither (analyse statique), couverture de tests, mutation testing sur les contrats financiers.
- Tests des contrats Insect* dès que leurs sources existent ; en attendant, revue d'ABI uniquement (les contrôles d'accès de `setUploader`, `setInsectImage`, `appendInsectChunk`, `contributeInsectMeta` sont inconnus).

## 5. Hygiène de dépôt et de processus

- Remplacer le script `test` de `Hardhat Solidity Deploy/package.json` (« no test specified ») par la config d'audit.
- Corriger `stage-sources.js`, qui supprime `audit-vendor/.gitattributes` à chaque exécution.
- Mettre en place un CI : `npm ci`, génération des sources, compilation, `recompile-exact`, tests, rapport de tailles (MessageFactory est à 96,4 % d'EIP-170).
- Épingler **une seule** version d'OpenZeppelin (le projet déclare `^4.9.6` mais compile un mélange 4.x/5.x).
- Quitter Remix comme source de vérité : projet Hardhat ou Foundry avec sources dans le dépôt, déploiement scripté, vérification Basescan/Sourcify à chaque déploiement.
- Réécrire `scripts/full-deploy.ts` (noms de contrats inexistants, association = manager) et en faire un test de câblage post-déploiement (le frontend a déjà un `WiringChecker`).

## 6. Critères avant mainnet

1. Sources canoniques versionnées et vérifiées contre le bytecode déployé.
2. P0 corrigés, ou prouvés absents de la version déployée.
3. Audit de code des contrats Insect*, Haiku et Poetry.
4. Plan de migration des contrats immuables déjà déployés.
5. Tests d'invariants verts et rapport de câblage post-déploiement.
