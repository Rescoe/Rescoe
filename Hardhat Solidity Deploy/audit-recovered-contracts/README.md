# audit-recovered-contracts — SOURCES RÉCUPÉRÉES, PAS LES SOURCES MÉTIER

> **Ce répertoire n'est pas le code source officiel de RESCOE.**
> Les `.sol` du projet ne sont versionnés nulle part : `*.sol` est ignoré par le `.gitignore` racine
> (ligne 22) et aucun `.sol` n'a jamais été committé (50 commits inspectés). Seuls des artefacts
> compilés existent dans `Hardhat Solidity Deploy/contracts/artifacts/`.
>
> Les fichiers ci-dessous ont été **extraits de `input.sources` des fichiers `build-info/*.json`**
> par `scripts/audit/recover-sources.js`. Ils représentent ce qui a été compilé à un instant T
> dans Remix (solc 0.8.30+commit.73712a01, viaIR, optimizer 200 runs, evm prague), **pas
> nécessairement la dernière version métier**.

## Preuve de provenance

`MANIFEST.json` rattache chaque source à son build-info (`sha256`, `keccak256`) et chaque artifact
Remix au build-info qui a produit exactement son bytecode :

| Artifact (contracts/artifacts) | build-info | Source | Bytecode déployé |
|---|---|---|---|
| AdhesionRescoe | `62c65c27…` | `Adhesion.sol` | identique (exact) |
| ResCoellectionManager | `a6daef4a…` | `RescollectionFactory.sol` | identique (exact) |
| MessageFactory (+ MessageEditions) | `d6da8606…` | `MessageFactory.sol`, `MessageEditions.sol` | identique (exact) |
| ArtFactory (+ ArtNFT) | `e7e63d83…` | `ArtFactory.sol`, `mintArt.sol` | identique (exact) |
| ArtNFT | `e7e63d83…` et `f2483049…` | `mintArt.sol` (octets identiques dans les deux) | identique (exact) |
| SepoliaFaucet | `1bb837b7…` | `FaucetSepolia.sol` | identique (exact) |

Le `keccak256` de chaque source est aussi comparé à celui des `*_metadata.json` Remix.

## Ce qui N'EST PAS récupérable

Aucune source (et aucun build-info) pour : **MasterFactory**, **TokenManagement** (`AdhesionManagement.sol`),
**HaikuEditions**, **PoetryFactory**, **InsectEvolution**, **InsectImageStorageV3**.
Pour MasterFactory et TokenManagement, seuls ABI + bytecode Remix existent. Les métadonnées
de TokenManagement référencent un `Adhesion.sol` **différent** (`keccak256 0xed39f1df…`) de celui
récupéré ici (`0x4dfa9386…`) : **versions divergentes, la plus récente est perdue**.

## Écart avec le frontend

L'ABI `src/components/ABI/ABIAdhesion.json` (141 entrées, `evolve`, `hatchEgg`, `reproduce`,
`insectStorage`…) décrit un contrat **beaucoup plus récent** que le `Adhesion.sol` récupéré (ABI de 87
entrées). Voir `docs/SMART_CONTRACT_AUDIT.md` §Périmètre.

## Dossiers

- `build-info/<id>/…` : arbre de sources tel que fourni au compilateur (y compris les fichiers
  `@openzeppelin/contracts/**` **exactement comme compilés**, mélange de versions inclus).
- `build-info/<id>/settings.json` : réglages solc d'origine.
- `MANIFEST.json` : hashes, mappage artifact ↔ build-info, tailles de bytecode.

Régénération : `node scripts/audit/recover-sources.js` (lecture seule sur `contracts/artifacts`).
