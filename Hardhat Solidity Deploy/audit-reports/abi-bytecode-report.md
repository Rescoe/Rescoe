# Rapport artefacts (généré par `scripts/audit/analyze-artifacts.js`)

## Tailles de bytecode

| Contrat | Origine | Déployé (o) | % EIP-170 (24 576) | Marge (o) | Initcode (o) | % EIP-3860 (49 152) |
|---|---|---:|---:|---:|---:|---:|
| MessageFactory | artifact Remix | 23680 | 96.4 % | 896 | 23830 | 48.5 % |
| ArtFactory | artifact Remix | 19743 | 80.3 % | 4833 | 19931 | 40.5 % |
| AdhesionRescoe | artifact Remix | 18434 | 75 % | 6142 | 19557 | 39.8 % |
| MessageEditions | build-info d6da8606 | 18104 | 73.7 % | 6472 | 20204 | 41.1 % |
| ResCoellectionManager | artifact Remix | 12744 | 51.9 % | 11832 | 13864 | 28.2 % |
| ArtNFT | artifact Remix | 12406 | 50.5 % | 12170 | 14773 | 30.1 % |
| TokenManagement | artifact Remix | 2825 | 11.5 % | 21751 | 3171 | 6.5 % |
| SepoliaFaucet | artifact Remix | 2355 | 9.6 % | 22221 | 2533 | 5.2 % |
| MasterFactory | artifact Remix | 1424 | 5.8 % | 23152 | 1768 | 3.6 % |

## ABI compilée vs ABI frontend vs ABI épinglée Base Sepolia

### AdhesionRescoe
- Frontend : `src/components/ABI/ABIAdhesion.json` (141 entrées) ; compilée : 87 entrées ; épinglée Base Sepolia `0x83848a57947b36e51787ded31554d43fd2417eaa` : 71 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address initialOwner)` | frontend: `(address initialOwner,address _artist,address _insectStorage)` **(DIFFÉRENT)**
  - fonctions : 43 communes ; seulement compilée (13) ; seulement frontend (31) ; mutabilité changée (0)
    - seulement compilée : `DUST_ETH()`, `burnAndUpgrade(uint256,string)`, `buyRewardPoints(address,uint256)`, `evolveManual(uint256,string)`, `feePercentage()`, `getTotalMembersByRole(uint256)`, `mintMultiple(address[],string[],uint256[],string[],string[])`, `pointPrice()`, `renewMembership(uint256,bool)`, `reproduce(uint256,uint256)`, `safeMint(string,uint256,string,string,bool,bool)`, `setPointPrice(uint256)`, `totalSupply()`
    - seulement frontend : `FEE_DENOMINATOR()`, `annualDuration()`, `artist()`, `baseEvolvePrice(uint256)`, `evolutionHistory(uint256,uint256)`, `evolve(uint256,string,string,string)`, `hatchEgg(uint256,string,string,string)`, `hatchedFromEgg(uint256)`, `insectStorage()`, `lockAndExtendOneYear(uint256)`, `lockPriceFactorDen()`, `lockPriceFactorNum()`, `maxMintsPerYear()`, `mintMultiple(address[],string[],string[],string[],uint256[],string[],string[])`, `mintNonce(address)`, `mintRelayer()`, `relayerMint(address,string,string,string,uint256,string,string,bool,bool)`, `renewMembership(uint256)`, `reproduce(uint256,uint256,uint8)`, `reproductionParents(uint256,uint256)`, `rescoeManager()`, `safeMint(string,string,string,uint256,string,string,bool,bool)`, `setAnnualDuration(uint256)`, `setArtist(address)`, `setBaseEvolvePrices(uint256[])`, `setInsectStorage(address)`, `setLockPriceFactor(uint256,uint256)`, `setMaxMintsPerYear(uint8)`, `setMintRelayer(address)`, `setRescoeManager(address)`, `spendPoints(uint256)`
  - événements : seulement compilée 5, seulement frontend 7
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address initialOwner)` | épinglée: `(address initialOwner)` (identique)
  - fonctions : 40 communes ; seulement compilée (16) ; seulement épinglée (3) ; mutabilité changée (0)
    - seulement compilée : `BURN_POINTS_REWARD()`, `DUST_ETH()`, `MAX_LEVEL()`, `REPRODUCE_POINTS_COST()`, `burnAndUpgrade(uint256,string)`, `evolveManual(uint256,string)`, `levelDurations(uint256)`, `membershipInfo(uint256)`, `mintsPerYear(address,uint256)`, `relayer()`, `renewMembership(uint256,bool)`, `reproduce(uint256,uint256)`, `safeMint(string,uint256,string,string,bool,bool)`, `setLevelDurations(uint256[4])`, `setRelayer(address)`, `totalSupply()`
    - seulement épinglée : `renewMembership(uint256)`, `safeMint(string,uint256,string,string)`, `duration()`
  - événements : seulement compilée 3, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address initialOwner)` | frontend: `(address initialOwner,address _artist,address _insectStorage)` **(DIFFÉRENT)**
  - fonctions : 35 communes ; seulement épinglée (8) ; seulement frontend (39) ; mutabilité changée (0)
    - seulement épinglée : `buyRewardPoints(address,uint256)`, `mintMultiple(address[],string[],uint256[],string[],string[])`, `safeMint(string,uint256,string,string)`, `setPointPrice(uint256)`, `duration()`, `feePercentage()`, `getTotalMembersByRole(uint256)`, `pointPrice()`
    - seulement frontend : `BURN_POINTS_REWARD()`, `FEE_DENOMINATOR()`, `MAX_LEVEL()`, `REPRODUCE_POINTS_COST()`, `annualDuration()`, `artist()`, `baseEvolvePrice(uint256)`, `evolutionHistory(uint256,uint256)`, `evolve(uint256,string,string,string)`, `hatchEgg(uint256,string,string,string)`, `hatchedFromEgg(uint256)`, `insectStorage()`, `levelDurations(uint256)`, `lockAndExtendOneYear(uint256)`, `lockPriceFactorDen()`, `lockPriceFactorNum()`, `maxMintsPerYear()`, `membershipInfo(uint256)`, `mintMultiple(address[],string[],string[],string[],uint256[],string[],string[])`, `mintNonce(address)`, `mintRelayer()`, `mintsPerYear(address,uint256)`, `relayer()`, `relayerMint(address,string,string,string,uint256,string,string,bool,bool)`, `reproduce(uint256,uint256,uint8)`, `reproductionParents(uint256,uint256)`, `rescoeManager()`, `safeMint(string,string,string,uint256,string,string,bool,bool)`, `setAnnualDuration(uint256)`, `setArtist(address)`, `setBaseEvolvePrices(uint256[])`, `setInsectStorage(address)`, `setLevelDurations(uint256[4])`, `setLockPriceFactor(uint256,uint256)`, `setMaxMintsPerYear(uint8)`, `setMintRelayer(address)`, `setRelayer(address)`, `setRescoeManager(address)`, `spendPoints(uint256)`
  - événements : seulement épinglée 4, seulement frontend 9
- ABI épinglée Remix VM `0xd9145CCE52D386f254917e481eB44e9943F39138` : 87 entrées ; identique à la compilée : false

### TokenManagement
- Frontend : `src/components/ABI/ABI_ADHESION_MANAGEMENT.json` (16 entrées) ; compilée : 16 entrées ; épinglée Base Sepolia `0x7610cb956354a790758158473d23704db2fa9ad8` : 16 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address _adhesionAddress,address initialOwner)` | frontend: `(address _adhesionAddress,address initialOwner)` (identique)
  - fonctions : 11 communes ; seulement compilée (0) ; seulement frontend (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement frontend 0
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address _adhesionAddress,address initialOwner)` | épinglée: `(address _adhesionAddress,address initialOwner)` (identique)
  - fonctions : 11 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address _adhesionAddress,address initialOwner)` | frontend: `(address _adhesionAddress,address initialOwner)` (identique)
  - fonctions : 11 communes ; seulement épinglée (0) ; seulement frontend (0) ; mutabilité changée (0)
  - événements : seulement épinglée 0, seulement frontend 0

### ArtNFT
- Frontend : `src/components/ABI/ABI_ART.json` (57 entrées) ; compilée : 71 entrées ; épinglée Base Sepolia `0xd0b6772E0DE3e9772492ebF15764744ACD9a3964` : 71 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,address _associationAddress,uint8 _associationFeeSharePercent,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` | frontend: `(address initialOwner,string name_,string symbol_,uint256 _collectionId,string _collectionType,address _rescollection,address _association,uint8 _associationShare,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` **(DIFFÉRENT)**
  - fonctions : 41 communes ; seulement compilée (8) ; seulement frontend (5) ; mutabilité changée (0)
    - seulement compilée : `OWNER_FEE_PERCENTAGE()`, `getTokenLightMetadata(uint256)`, `maxCreatorFee()`, `minCreatorFee()`, `pendingWithdrawals(address)`, `setTokenMetadataOnChain(uint256,uint8)`, `tokenRarity(uint256)`, `userFeePercentage(address)`
    - seulement frontend : `hiddenMetadataURI()`, `mintBatch(string[],uint256[])`, `revealed()`, `setHiddenMetadataURI(string)`, `setReveal(bool)`
  - événements : seulement compilée 2, seulement frontend 1
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,address _associationAddress,uint8 _associationFeeSharePercent,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` | épinglée: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,address _associationAddress,uint8 _associationFeeSharePercent,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` (identique)
  - fonctions : 49 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,address _associationAddress,uint8 _associationFeeSharePercent,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` | frontend: `(address initialOwner,string name_,string symbol_,uint256 _collectionId,string _collectionType,address _rescollection,address _association,uint8 _associationShare,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)` **(DIFFÉRENT)**
  - fonctions : 41 communes ; seulement épinglée (8) ; seulement frontend (5) ; mutabilité changée (0)
    - seulement épinglée : `setTokenMetadataOnChain(uint256,uint8)`, `getTokenLightMetadata(uint256)`, `maxCreatorFee()`, `minCreatorFee()`, `OWNER_FEE_PERCENTAGE()`, `pendingWithdrawals(address)`, `tokenRarity(uint256)`, `userFeePercentage(address)`
    - seulement frontend : `hiddenMetadataURI()`, `mintBatch(string[],uint256[])`, `revealed()`, `setHiddenMetadataURI(string)`, `setReveal(bool)`
  - événements : seulement épinglée 2, seulement frontend 1

### ResCoellectionManager
- Frontend : `src/components/ABI/ABI_Collections.json` (71 entrées) ; compilée : 64 entrées ; épinglée Base Sepolia `0xc06670dccae878d67a7ed596e8e35298d8b91ade` : 64 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address initialOwner,address _factoryContractAddress)` | frontend: `(address initialOwner,address _factoryContractAddress)` (identique)
  - fonctions : 42 communes ; seulement compilée (0) ; seulement frontend (11) ; mutabilité changée (0)
    - seulement frontend : `POINT_PRICE()`, `addPendingPoints(address,uint256)`, `authorizedCollections(address)`, `buyPendingPoints(uint256)`, `claimPendingToRewards()`, `distributeToAdhesion(address)`, `getPendingPoints(address)`, `pendingRewardPoints(address)`, `registerCollection(address)`, `rewardRelayer()`, `setRewardRelayer(address)`
  - événements : seulement compilée 0, seulement frontend 6
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address initialOwner,address _factoryContractAddress)` | épinglée: `(address initialOwner,address _factoryContractAddress)` (identique)
  - fonctions : 42 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address initialOwner,address _factoryContractAddress)` | frontend: `(address initialOwner,address _factoryContractAddress)` (identique)
  - fonctions : 42 communes ; seulement épinglée (0) ; seulement frontend (11) ; mutabilité changée (0)
    - seulement frontend : `POINT_PRICE()`, `addPendingPoints(address,uint256)`, `authorizedCollections(address)`, `buyPendingPoints(uint256)`, `claimPendingToRewards()`, `distributeToAdhesion(address)`, `getPendingPoints(address)`, `pendingRewardPoints(address)`, `registerCollection(address)`, `rewardRelayer()`, `setRewardRelayer(address)`
  - événements : seulement épinglée 0, seulement frontend 6

### ArtFactory
- Frontend : `src/components/ABI/Factories/ABI_ART_FACTORY.json` (19 entrées) ; compilée : 17 entrées ; épinglée Base Sepolia `0xe9aa1178ef6c14DAc173a11e35d51ACeaF09D9Fc` : 17 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address _adhesion,address _association)` | frontend: `(address _adhesion,address _association)` (identique)
  - fonctions : 9 communes ; seulement compilée (4) ; seulement frontend (4) ; mutabilité changée (0)
    - seulement compilée : `allCollectionNames(uint256)`, `collectionConfigs(string)`, `getAllCollectionNames()`, `getCollectionConfig(string)`
    - seulement frontend : `getUserCollectionConfig(address,string)`, `masterFactoryAuthorized()`, `resCollectionsAuthorized()`, `setAuthorizedCallers(address,address)`
  - événements : seulement compilée 1, seulement frontend 3
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address _adhesion,address _association)` | épinglée: `(address _adhesion,address _association)` (identique)
  - fonctions : 13 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address _adhesion,address _association)` | frontend: `(address _adhesion,address _association)` (identique)
  - fonctions : 9 communes ; seulement épinglée (4) ; seulement frontend (4) ; mutabilité changée (0)
    - seulement épinglée : `allCollectionNames(uint256)`, `collectionConfigs(string)`, `getAllCollectionNames()`, `getCollectionConfig(string)`
    - seulement frontend : `getUserCollectionConfig(address,string)`, `masterFactoryAuthorized()`, `resCollectionsAuthorized()`, `setAuthorizedCallers(address,address)`
  - événements : seulement épinglée 1, seulement frontend 3

### MasterFactory
- Frontend : `src/components/ABI/Factories/ABI_MasterFactory.json` (11 entrées) ; compilée : 10 entrées ; épinglée Base Sepolia `0x449f77c72c359ec52391830babb22eb5823aeeac` : 10 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress)` | frontend: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress,address generativeFactoryAddress)` **(DIFFÉRENT)**
  - fonctions : 7 communes ; seulement compilée (0) ; seulement frontend (1) ; mutabilité changée (0)
    - seulement frontend : `generativeFactory()`
  - événements : seulement compilée 0, seulement frontend 0
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress)` | épinglée: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress)` (identique)
  - fonctions : 7 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress)` | frontend: `(address artFactoryAddress,address poetryFactoryAddress,address messageFactoryAddress,address generativeFactoryAddress)` **(DIFFÉRENT)**
  - fonctions : 7 communes ; seulement épinglée (0) ; seulement frontend (1) ; mutabilité changée (0)
    - seulement frontend : `generativeFactory()`
  - événements : seulement épinglée 0, seulement frontend 0

### MessageFactory
- Frontend : `src/components/ABI/Factories/ABI_SOCIAL_FACTORY.json` (17 entrées) ; compilée : 15 entrées ; épinglée Base Sepolia `0x72b5547985e1d764681b0788879e0a4c7707e4fe` : 15 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address _adhesionContractAddress)` | frontend: `(address initialOwner,address _adhesionContractAddress)` **(DIFFÉRENT)**
  - fonctions : 10 communes ; seulement compilée (0) ; seulement frontend (1) ; mutabilité changée (0)
    - seulement frontend : `renounceOwnership()`
  - événements : seulement compilée 0, seulement frontend 1
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(address _adhesionContractAddress)` | épinglée: `(address _adhesionContractAddress)` (identique)
  - fonctions : 10 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(address _adhesionContractAddress)` | frontend: `(address initialOwner,address _adhesionContractAddress)` **(DIFFÉRENT)**
  - fonctions : 10 communes ; seulement épinglée (0) ; seulement frontend (1) ; mutabilité changée (0)
    - seulement frontend : `renounceOwnership()`
  - événements : seulement épinglée 0, seulement frontend 1

### MessageEditions
- Frontend : `src/components/ABI/MessageEditions.json` (56 entrées) ; compilée : 71 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,string _salonName,bool _requiresMembership,address _defaultRoyaltyAddress)` | frontend: `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,string _salonName,bool _requiresMembership,address _defaultRoyaltyAddress)` (identique)
  - fonctions : 29 communes ; seulement compilée (19) ; seulement frontend (12) ; mutabilité changée (0)
    - seulement compilée : `burnMultiple(uint256[])`, `defaultRules()`, `defineRoyalties(address[],uint256[])`, `getHaikuInfoUnique(uint256)`, `getHaikuRoyalties(uint256)`, `getLastMintedTokenId()`, `getLastUniqueHaikusMinted()`, `getRemainingEditions(uint256)`, `getSalonRoyalties()`, `getTokenFullDetails(uint256)`, `getTransactionHistory(uint256)`, `haikuRoyaltyAddress(uint256)`, `isNFTForSale(uint256)`, `messageMintCount(bytes32)`, `mint(bytes32,string,uint256,address,string,uint256,uint256,uint256,bool,address[],uint256[])`, `removeEditionFromSale(uint256)`, `salonRules(uint256)`, `setDefaultRoyalties(address[],uint256[])`, `updateDefaultRoyaltyAddress(address)`
    - seulement frontend : `addResidentManager(address)`, `associationAddress()`, `associationFeeSharePercent()`, `convertToSoulbound(uint256)`, `createHaikuResident(string,uint256,uint256,uint256,address[],uint256[],string)`, `extraPercents(uint256)`, `extraRecipients(uint256)`, `isListed(uint256)`, `isSoulbound(uint256)`, `mintDiscord(bytes32,string,uint256,string,uint256,uint256,uint256,bool,address[],uint256[])`, `mintEdition(uint256,string)`, `residentManagers(address)`
  - événements : seulement compilée 3, seulement frontend 5

### SepoliaFaucet
- Frontend : `src/components/ABI/Faucet.json` (22 entrées) ; compilée : 22 entrées ; épinglée Base Sepolia `0xe14968f7ce8be32ee79aa37f82599ffadf55ddba` : 22 entrées
- **compilée (A) vs frontend (B)**
  - constructeur compilée: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` | frontend: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` (identique)
  - fonctions : 14 communes ; seulement compilée (0) ; seulement frontend (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement frontend 0
- **compilée (A) vs épinglée Base Sepolia (B)**
  - constructeur compilée: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` | épinglée: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` (identique)
  - fonctions : 14 communes ; seulement compilée (0) ; seulement épinglée (0) ; mutabilité changée (0)
  - événements : seulement compilée 0, seulement épinglée 0
- **épinglée Base Sepolia (A) vs frontend (B)**
  - constructeur épinglée: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` | frontend: `(uint256 _dispenseAmount,uint256 _cooldown,uint256 _maxClaimsPerAddress,address _relayer)` (identique)
  - fonctions : 14 communes ; seulement épinglée (0) ; seulement frontend (0) ; mutabilité changée (0)
  - événements : seulement épinglée 0, seulement frontend 0

## Contrats sans source (ABI frontend uniquement)

- **HaikuEditions** (`HaikuEditions.json`) : 37 fonctions, 11 événements, 11 erreurs ; constructeur `(address initialOwner,string collectionName,string collectionSymbol,uint256 _collectionId,string _collectionType,address _adhesionContractAddress,address _associationAddress,uint8 _associationFeeSharePercent,uint256 _maxSupply,address[] _extraRecipients,uint256[] _extraPercents)`
- **PoetryFactory** (`Factories/ABI_POESIE_FACTORY.json`) : 13 fonctions, 5 événements, 0 erreurs ; constructeur `(address _adhesion,address _association)`
- **InsectImageStorageV3** (`ABIInsectStorage.json`) : 21 fonctions, 7 événements, 0 erreurs ; constructeur `(address initialOwner)`
- **GenerativeArt (inconnu)** (`ABI_GENERATIVE_ART.json`) : 35 fonctions, 11 événements, 10 erreurs ; constructeur `(address _creator,string _name,string _symbol,uint256 _collectionId,string _collectionType,address _adhesionContract)`

## Divergences croisées

- ABI frontend ArtFactory et PoetryFactory identiques : **true**
- HaikuEditions (frontend) vs ArtNFT compilé : fonctions communes 26, seulement Haiku 11, seulement ArtNFT 23
- ArtFactory compilée vs ABI frontend ArtFactory : seulement compilée 4, seulement frontend 4
