// SPDX-License-Identifier: MIT
//Factory : 0xEa9f4F0A96C501fB7bFC0380dcF0AFcdCC52255c
// Ajouter le prix aussi lors du mint
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./IReward.sol";

contract MessageEditions is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    IReward private rewardContract;

    uint256 public collectionId;
    string public collectionType;
    bool public requiresMembership;
    string public salonName;

    Counters.Counter private _tokenIdCounter;
    Counters.Counter private _HaikusUnique;


struct Transaction {
    address buyer;
    address seller;
    uint256 price;
    uint256 timestamp;
}

    // Struct pour encapsuler toutes les informations d'un haiku
struct OwnerInfo {
    address owner;
    uint256[] tokenIds; // Tableau d'IDs des tokens possédés par cet owner
}

struct Haiku {
    string haiku;
    address creator;
    uint256 totalEditions;
    uint256 pricePerEdition;
    uint256 editionsSold;
    uint256 createdAt; // Ajouté ce champ
    uint256 expirationDate;
    OwnerInfo[] owners; // Tableau d'OwnerInfo pour stocker les propriétaires et leurs tokens
    uint256[] priceHistory;
    Transaction[] transactionHistory;
}

// Règles d’un salon Discord (définies via message épinglé ou par défaut)
struct MintRules {
    bool openEdition;          // true = open edition
    uint256 maxEditions;       // nombre max d’éditions si limité (0 = illimité)
    uint256 durationSeconds;   // durée de la période de mint (0 = pas de limite)
    uint256 mintStartTime;     // timestamp du début de la période (block.timestamp quand le premier mint est lancé)
}

struct RoyaltySplit {
    address[] recipients;
    uint256[] percentages; // total = 10000 (base 10000 = 100%)
}
mapping(uint256 => RoyaltySplit) internal haikuRoyalties;
    RoyaltySplit internal salonRoyalties;


    mapping(uint256 => Haiku) public haikus; // Mapping de l'ID de haiku à la structure Haiku
    //mapping(uint256 => uint256) public haikuEditionsCount;
    mapping(uint256 => uint256) public haikuIdToTokenId;
    mapping(uint256 => uint256) public tokenIdToHaikuId;


    mapping(uint256 => uint256) private _tokenPrices;
    mapping(uint256 => bool) private _IstokenForSale;
    mapping(uint256 => uint256) private _mintDates;
    //mapping(uint256 => uint256) private _tokenCollections;
    mapping(uint256 => uint256[]) private _tokensByCollection;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _rewardPoints;

    mapping(uint256 => address) public haikuRoyaltyAddress; // 🔥 chaque haiku a son adresse de royalties


    mapping(uint256 => Transaction[]) private _transactionHistory;


// Mapping pour gérer le nombre max d'éditions par haiku (0 = Open Edition)
    mapping(uint256 => uint256) public haikuMaxEditions;

// Mapping pour compter combien d'éditions ont été mintées par haiku
    mapping(uint256 => uint256) public haikuEditionsMinted;

    // Associe chaque message Discord à un ID d’œuvre mintée (ou à un haïku)
mapping(bytes32 => uint256) public messageIdToHaikuId;

// Nombre total de mint effectués pour chaque message
mapping(bytes32 => uint256) public messageMintCount;

// Règles de mint par salon Discord (chaque salon peut avoir son propre message épinglé avec ses règles)
mapping(uint256 => MintRules) public salonRules;

// Règles par défaut à utiliser si aucun salon n’a défini ses propres règles
MintRules public defaultRules;

address public defaultRoyaltyAddress;


    event NFTMinted(uint256 indexed tokenId, address indexed owner, string uri);
    event NFTListedForSale(uint256 indexed tokenId, uint256 price);
    event NFTSold(uint256 indexed tokenId, address buyer, uint256 price);
    event NFTRemoved(uint256 indexed tokenId);
    event RewardPointsCalculated(address indexed user, uint256 points);

constructor(
    address initialOwner,
    string memory collectionName,
    string memory collectionSymbol,
    uint256 _collectionId,
    string memory _collectionType,
    address _adhesionContractAddress,
    string memory _salonName,
    bool _requiresMembership,
    address _defaultRoyaltyAddress


) ERC721(collectionName, collectionSymbol) Ownable(initialOwner) {
    collectionId = _collectionId;
    collectionType = _collectionType;
    rewardContract = IReward(_adhesionContractAddress);
    salonName = _salonName;
    requiresMembership = _requiresMembership;
    defaultRoyaltyAddress = _defaultRoyaltyAddress;

    // ✅ Config par défaut : 100% des royalties (des 5%) à l’adresse du salon
    salonRoyalties.recipients.push(defaultRoyaltyAddress);
    salonRoyalties.percentages.push(10000);
}

/**
 * @notice Mints one edition of a haiku, creating a new haiku if none exists for the given messageId.
 * @dev 
 * - Each haiku is uniquely identified by a `bytes32` derived from the Discord message (content, author, timestamp).
 * - The mapping `messageIdToHaikuId` uses `0` as a sentinel value: if `0`, the haiku does not exist yet.
 * - When a new message is detected, `_HaikusUnique` is incremented and assigned to this `bytes32`.
 * - No decrementation is required; haiku IDs start at 1 and increment naturally.
 * - The transaction is payable and must match the fixed price per edition (`msg.value == pricePerEdition`).
 * - Funds are immediately distributed among stakeholders (artist, salon, RESCOE, etc.).
 * - If any transfer fails, the entire transaction reverts (no mint without full payment).
 *
 * @param messageIdDiscord Unique bytes32 derived from the original Discord message.
 * @param haiku The poem text to mint.
 * @param pricePerEdition Fixed mint price in wei for one edition.
 * @param salonRoyaltyAddress Royalty address for the salon or collection context.
 * @param imageUrl Optional URL or IPFS CID of the haiku image.
 * @param messageTimestamp Original timestamp of the Discord message.
 * @param mintDurationSeconds Duration of the minting period (0 = default 7 days).
 * @param maxEditionsFromMessage Maximum number of editions allowed for this haiku.
 * @param isOpenEdition Whether the haiku has unlimited editions.
 * @param extraRoyaltyAddresses Additional royalty recipients.
 * @param extraRoyaltyPercentages Corresponding royalty percentages (basis points).
 *
 * @custom:security 
 * NonReentrant. The mint reverts if `msg.value` is incorrect or any payment fails.
 * No funds are stored in the contract after execution.
 * French : 
 ***Mint une edition de haiku. Si le message n existe pas encore, un nouveau haiku est 
 ***cree avec un id unique base sur le message Discord. Le montant doit correspondre 
 ***exactement au prix fixe. L argent est distribue immediatement, sans solde conserve 
 ***dans le contrat. La transaction revert si un transfert echoue.
 */


function mint(
    bytes32 messageIdDiscord,
    string memory haiku,
    uint256 pricePerEdition,
    address salonRoyaltyAddress,
    string memory imageUrl,
    uint256 messageTimestamp,
    uint256 mintDurationSeconds,
    uint256 maxEditionsFromMessage,
    bool isOpenEdition,
    address[] memory extraRoyaltyAddresses,
    uint256[] memory extraRoyaltyPercentages
) external payable {
    require(bytes(haiku).length > 0, "Haiku cannot be empty");
    require(pricePerEdition > 0, "Price must be > 0");
    require(msg.value == pricePerEdition, "Incorrect msg.value");

    if (requiresMembership) {
        (bool membershipValid, , ) = rewardContract.getUserInfo(msg.sender);
        require(membershipValid, "Adhesion required to mint in this salon");
    }

    uint256 haikuId;
    bool isNewHaiku = false;

    // 1. Gestion de l'ID du haiku (nouveau ou existant)
    /**
 * @notice Maps a unique Discord message identifier to its internal haiku ID.
 * @dev 
 * - Value `0` means no haiku is yet associated with this message.
 * - A new haiku ID is created when a new messageId is seen, messageIdToHaikuId == 0.
 * - This ensures perfect uniqueness and prevents multiple haikus for the same message.
 * - No off-by-one adjustment is needed (`-1` is unnecessary).
 * - The bytes32 uniqueness is guaranteed by generation method (content + creator + timestamp).
 *
 * @param messageIdDiscord Unique hash representing a Discord message or poem.
 * @return haikuId Internal identifier for the haiku, or 0 if not yet initialized.
 */

    if (messageIdToHaikuId[messageIdDiscord] != 0) {
        haikuId = messageIdToHaikuId[messageIdDiscord];
    } else {
        haikuId = _HaikusUnique.current();
        messageIdToHaikuId[messageIdDiscord] = haikuId;
        isNewHaiku = true;
        
        // Configuration par défaut si non spécifiée
        if (mintDurationSeconds == 0 && maxEditionsFromMessage == 0) {
            mintDurationSeconds = 7 days;
            maxEditionsFromMessage = 100;
            isOpenEdition = false;
        }
        
        // Initialisation du nouveau haiku
        Haiku storage h = haikus[haikuId];
        h.haiku = haiku;
        h.creator = msg.sender;
        h.pricePerEdition = pricePerEdition;
        h.createdAt = messageTimestamp;
        h.expirationDate = messageTimestamp + mintDurationSeconds;
        haikuMaxEditions[haikuId] = isOpenEdition ? 0 : maxEditionsFromMessage;
        
        _HaikusUnique.increment();
    }

    // 2. Vérifications avant mint
    if (haikuMaxEditions[haikuId] > 0)
        require(haikuEditionsMinted[haikuId] < haikuMaxEditions[haikuId], "Max editions reached");
    
    if (haikus[haikuId].expirationDate > 0)
        require(block.timestamp <= haikus[haikuId].expirationDate, "Mint period expired");

    // 3. Déterminer l'adresse de royalties à utiliser
    address royaltyAddressToUse;
    if (defaultRoyaltyAddress != address(0)) {
        royaltyAddressToUse = defaultRoyaltyAddress;
    } else {
        require(salonRoyaltyAddress != address(0), "Royalty address must be provided");
        royaltyAddressToUse = salonRoyaltyAddress;
    }

//stocker les royalties pour le haiku
        haikuRoyalties[haikuId].recipients = salonRoyalties.recipients;
        haikuRoyalties[haikuId].percentages = salonRoyalties.percentages;
    
    // Stocker l'adresse de royalties pour les nouveaux haikus
    if (isNewHaiku) {
        haikuRoyaltyAddress[haikuId] = royaltyAddressToUse;
    } else {
        // Utiliser l'adresse stockée pour les haikus existants
        royaltyAddressToUse = haikuRoyaltyAddress[haikuId];
    }

    // 4. Procéder au mint
    uint256 newTokenId = _tokenIdCounter.current();
    _mint(msg.sender, newTokenId);
    _owners[newTokenId] = msg.sender;

    // Générer et définir le tokenURI
    string memory tokenURI = _generateTokenURI(
        newTokenId,
        haiku,
        pricePerEdition,
        haikus[haikuId].creator,
        imageUrl,
        haikuId,
        haikus[haikuId].editionsSold + 1
    );
    _setTokenURI(newTokenId, tokenURI);

    // 5. Mettre à jour les états
    haikuEditionsMinted[haikuId]++;
    haikus[haikuId].totalEditions = haikuMaxEditions[haikuId];
    haikus[haikuId].editionsSold++;
    haikuIdToTokenId[haikuId] = newTokenId;
    _tokensByCollection[collectionId].push(newTokenId);
    _mintDates[newTokenId] = block.timestamp;

    // Mettre à jour les informations du propriétaire
    bool ownerExists = false;
    for (uint256 i = 0; i < haikus[haikuId].owners.length; i++) {
        if (haikus[haikuId].owners[i].owner == msg.sender) {
            haikus[haikuId].owners[i].tokenIds.push(newTokenId);
            ownerExists = true;
            break;
        }
    }

if (!ownerExists) {
    uint256[] memory newTokenArray = new uint256[](1);
    newTokenArray[0] = newTokenId; // Fixed: Assign to index 0
    haikus[haikuId].owners.push(OwnerInfo({
        owner: msg.sender,
        tokenIds: newTokenArray
    }));
}

    // 6. SEULEMENT MAINTENANT : distribuer les royalties (après succès du mint)
    _distributeRoyalties(msg.value, royaltyAddressToUse, extraRoyaltyAddresses, extraRoyaltyPercentages);
    
    _tokenIdCounter.increment();
}

function setDefaultRoyalties(address[] calldata recipients, uint256[] calldata percentages) external onlyOwner {
    require(recipients.length == percentages.length, "Length mismatch");
    require(recipients.length > 0, "No recipients");
    
    delete salonRoyalties.recipients;
    delete salonRoyalties.percentages;

    uint256 total = 0;
    for (uint256 i = 0; i < recipients.length; i++) {
        require(recipients[i] != address(0), "Invalid recipient");
        total += percentages[i];
        salonRoyalties.recipients.push(recipients[i]);
        salonRoyalties.percentages.push(percentages[i]);
    }

    require(total <= 10000, "Total > 100%");
}


/**
 * @notice Distributes all received funds immediately among recipients.
 * @dev 
 * - Called at the end of the mint process, after successful token creation.
 * - Splits the `msg.value` between owner (artist or association) and royalty recipients.
 * - The distribution is one-shot: the contract never holds leftover ETH.
 * - If any transfer fails, the function reverts entirely.
 * - Uses `.call{value: amount}("")` for safe and gas-compatible transfers.
 *
 * @param amount Total amount received for minting (`msg.value`).
 * @param royaltyAddressToUse Main royalty receiver address (salon or collection).
 * @param extraRoyaltyAddresses Additional recipients.
 * @param extraRoyaltyPercentages Percentages in basis points (max total 10000).
 *
 * @custom:example
 * Example: For `msg.value = 0.01 ETH`
 * - 50% → contract owner (artist or association)
 * - Remaining split among royalty addresses by configured percentages
 * - If rounding leaves a small remainder, it is sent back to owner
 *
 * @custom:security 
 * - No ETH is retained in the contract.
 * - All transfers are atomic.
 * - Function reverts if any payment fails.
 */


function _distributeRoyalties(
    uint256 amount,
    address royaltyAddressToUse,
    address[] memory extraRoyaltyAddresses,
    uint256[] memory extraRoyaltyPercentages
) internal {
    // 🔹 50% direct au owner
    uint256 ownerShare = (amount * 50) / 100;
    (bool sentOwner, ) = payable(owner()).call{value: ownerShare}("");
    require(sentOwner, "Failed to send owner share");

    uint256 remaining = amount - ownerShare;

    // 🔹 Liste de destinataires et pourcentages combinés
    uint256 totalPerc = 0;
    uint256 n = extraRoyaltyAddresses.length;

    address[] memory recipients = new address[](n + 1);
    uint256[] memory percentages = new uint256[](n + 1);

    // 1️⃣ Premier destinataire : adresse salon / royalties par défaut = 10000
    recipients[0] = royaltyAddressToUse;
    percentages[0] = 10000;

    // 2️⃣ Ajouter les extras
    for (uint256 i = 0; i < n; i++) {
        recipients[i + 1] = extraRoyaltyAddresses[i];
        percentages[i + 1] = extraRoyaltyPercentages[i];
        totalPerc += extraRoyaltyPercentages[i];
    }

    // 🔹 Calcul des parts
    uint256 distributed = 0;
    for (uint256 i = 0; i < recipients.length; i++) {
        if (recipients[i] == address(0)) continue;

        uint256 share;
        if (i == 0) {
            // salon / default : prend le reste après extras
            share = remaining * (10000 - totalPerc) / 10000;
        } else {
            share = remaining * percentages[i] / 10000;
        }

        distributed += share;
        (bool ok, ) = payable(recipients[i]).call{value: share}("");
        require(ok, "Royalty payment failed");
    }

    // 🔹 Si reliquat dû à arrondi, envoie au owner
    uint256 residual = remaining - distributed;
    if (residual > 0) {
        (bool ok2, ) = payable(owner()).call{value: residual}("");
        require(ok2, "Failed to send residual to owner");
    }
}


function getSalonRoyalties()
    external
    view
    returns (address[] memory, uint256[] memory)
{
    return (salonRoyalties.recipients, salonRoyalties.percentages);
}

function _generateTokenURI(
    uint256 tokenId,
    string memory haiku,
    uint256 pricePerEdition,
    address creator,
    string memory imageUrl,
    uint256 haikuId,
    uint256 editionNumber
) internal view returns (string memory){
     // Step 1: Generate image (simplified)
    string memory image;
    if (bytes(imageUrl).length > 0) {
        image = imageUrl;
    } else {
        image = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(generateSVG(haiku)))
        ));
    }

    // Step 2: Escape haiku text
    string memory safeHaiku = escapeJSONString(haiku);

    // Step 3: Build attributes separately
    string memory attributes = string(abi.encodePacked(
        '[',
            '{"trait_type":"ID","value":"', Strings.toString(tokenId), '"},',
            '{"trait_type":"Edition","value":"', Strings.toString(editionNumber), '"},',
            '{"trait_type":"Price (wei)","value":"', Strings.toString(pricePerEdition), '"}',
        "]"
    ));

    // Step 4: Construct JSON in parts
    string memory jsonPart1 = string(abi.encodePacked(
    '{"name":"', salonName, ' #', Strings.toString(haikuId), '",'
        '"description":"', safeHaiku, '",',
        '"creator":"', Strings.toHexString(uint256(uint160(creator)), 20), '",',
        '"image":"', image, '",'
    ));

    string memory jsonPart2 = string(abi.encodePacked(
        '"attributes":', attributes, "}"
    ));

    // Step 5: Combine and encode
    string memory json = string(abi.encodePacked(jsonPart1, jsonPart2));
    return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
}



function generateSVG(string memory haiku) internal pure returns (string memory) {
    // Convertir en bytes pour parcourir le texte
    bytes memory strBytes = bytes(haiku);

    string memory svgStart = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">'
                             '<rect width="100%" height="100%" fill="white"/>';

    string memory svgTextStart = '<text x="50%" font-size="18" text-anchor="middle" '
                                 'dominant-baseline="hanging" fill="black">';
    string memory svgContent = "";
    uint256 lineNumber = 0;

    bytes memory currentLine = new bytes(strBytes.length);
    uint256 currentLength = 0;

    for (uint256 i = 0; i < strBytes.length; i++) {
        if (strBytes[i] == "\n") {
            // Fin de ligne → flush dans <tspan>
            bytes memory line = new bytes(currentLength);
            for (uint256 j = 0; j < currentLength; j++) {
                line[j] = currentLine[j];
            }
            svgContent = string(
                abi.encodePacked(
                    svgContent,
                    '<tspan x="50%" dy="1.2em">',
                    string(line),
                    "</tspan>"
                )
            );
            currentLength = 0;
            lineNumber++;
        } else {
            currentLine[currentLength++] = strBytes[i];
        }
    }

    // Ajouter la dernière ligne
    if (currentLength > 0) {
        bytes memory line = new bytes(currentLength);
        for (uint256 j = 0; j < currentLength; j++) {
            line[j] = currentLine[j];
        }
        svgContent = string(
            abi.encodePacked(
                svgContent,
                '<tspan x="50%" dy="1.2em">',
                string(line),
                "</tspan>"
            )
        );
    }

    string memory svgEnd = "</text></svg>";

    return string(abi.encodePacked(svgStart, svgTextStart, svgContent, svgEnd));
}


function escapeJSONString(string memory input) internal pure returns (string memory) {
    bytes memory strBytes = bytes(input);
    bytes memory result = new bytes(strBytes.length * 2); // max si tout est \n
    uint256 j = 0;

    for (uint256 i = 0; i < strBytes.length; i++) {
        bytes1 char = strBytes[i];
        if (char == "\n") {
            // ajoute deux caractères: '\' et 'n'
            result[j++] = "\\";
            result[j++] = "n";
        } else if (char == "\"") {
            // si jamais ton haiku contient des guillemets
            result[j++] = "\\";
            result[j++] = "\"";
        } else {
            result[j++] = char;
        }
    }

    bytes memory trimmedResult = new bytes(j);
    for (uint256 k = 0; k < j; k++) {
        trimmedResult[k] = result[k];
    }

    return string(trimmedResult);
}


function buyEdition(uint256 tokenId) external payable {
    require(_exists(tokenId), "Token does not exist");
    require(_IstokenForSale[tokenId], "Token is not for sale");

    uint256 price = _tokenPrices[tokenId];
    require(msg.value >= price, "Insufficient payment");

    address seller = ownerOf(tokenId);
    require(seller != msg.sender, "You already own this token");

    // 🔹 Transfert du token à l’acheteur
    _transfer(seller, msg.sender, tokenId);

    uint256 haikuId = _haikuIdFromToken(tokenId);

    // 🔹 Suppression de la mise en vente et MAJ compteur
    _IstokenForSale[tokenId] = false;
    haikus[haikuId].editionsSold += 1;

    // --- 💰 Répartition des paiements ---
    uint256 sellerShare = (price * 90) / 100;   // 90% au vendeur
    uint256 ownerShare = (price * 5) / 100;     // 5% au owner
    uint256 royaltyShare = price - sellerShare - ownerShare; // 5% restants

    // 🔸 Paiement du vendeur
    (bool sentSeller, ) = payable(seller).call{value: sellerShare}("");
    require(sentSeller, "Failed to send funds to seller");

    // 🔸 Paiement du owner() du contrat
    (bool sentOwner, ) = payable(owner()).call{value: ownerShare}("");
    require(sentOwner, "Failed to send funds to owner");

    // 🔸 Répartition des 5% restants selon les royalties
    RoyaltySplit storage rs = haikuRoyalties[haikuId];

    // Si aucune adresse de royalties définie, tout va au owner
    if (rs.recipients.length == 0) {
        (bool ok, ) = payable(owner()).call{value: royaltyShare}("");
        require(ok, "Failed to send royalty to owner");
    } else {
        uint256 distributed = 0;
        for (uint256 i = 0; i < rs.recipients.length; i++) {
            address recipient = rs.recipients[i];
            uint256 share = (royaltyShare * rs.percentages[i]) / 10000;
            distributed += share;
            if (recipient != address(0)) {
                (bool ok, ) = payable(recipient).call{value: share}("");
                require(ok, "Royalty split failed");
            }
        }
        // 🔹 Reliquat éventuel dû aux arrondis → owner
        uint256 residual = royaltyShare - distributed;
        if (residual > 0) {
            (bool ok2, ) = payable(owner()).call{value: residual}("");
            require(ok2, "Failed to send residual to owner");
        }
    }

    emit NFTSold(tokenId, msg.sender, price);

    // 🔹 Système de points de récompense (facultatif)
    uint256 rewardPoints = (price * 1000) / 1e18;
    _rewardPoints[seller] += rewardPoints;
    rewardContract.mettreAJourPoints(seller, rewardPoints);

    emit RewardPointsCalculated(seller, rewardPoints);
}


    function defineRoyalties(
        address[] calldata recipients,
        uint256[] calldata percentages
    ) external onlyOwner {
        require(recipients.length == percentages.length, "Royalties mismatch");

        uint256 total;
        for (uint256 i = 0; i < percentages.length; i++) {
            total += percentages[i];
        }
        require(total <= 10000, "Total > 100%");

        delete salonRoyalties.recipients;
        delete salonRoyalties.percentages;

        for (uint256 i = 0; i < recipients.length; i++) {
            salonRoyalties.recipients.push(recipients[i]);
            salonRoyalties.percentages.push(percentages[i]);
        }
    }

    function burnMultiple(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(ownerOf(tokenId) == msg.sender, "You do not own this NFT");
            require(!_IstokenForSale[tokenId], "Token is for sale and cannot be burned");

            // Appelle la fonction _burn pour brûler le token
            _burn(tokenId);

            // Mettre à jour l'état des haikus
            uint256 haikuId = _haikuIdFromToken(tokenId);
            haikuMaxEditions[haikuId] -= 1;
            

            // Supprime le jeton de la collection
            uint256 index = findTokenIndex(tokenId);
            _tokensByCollection[collectionId][index] = _tokensByCollection[collectionId][_tokensByCollection[collectionId].length - 1];
            _tokensByCollection[collectionId].pop();

            emit NFTRemoved(tokenId);
        }
    }

    function listEditionForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not your token");
        require(!_IstokenForSale[tokenId], "Already listed");
        require(price > 0, "Price must be > 0");

        _tokenPrices[tokenId] = price;
        _IstokenForSale[tokenId] = true;
        haikus[_haikuIdFromToken(tokenId)].priceHistory.push(price);

        emit NFTListedForSale(tokenId, price);
    }

    function removeEditionFromSale(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not your token");
        require(_IstokenForSale[tokenId], "Token not listed for sale");

        _IstokenForSale[tokenId] = false;
        _tokenPrices[tokenId] = 0; // optionnel, pour remettre le prix à zéro

        emit NFTRemoved(tokenId);
    }


    function getHaikuInfoUnique(uint256 haikuId) external view returns (uint256 firstTokenId, uint256 editionsCount) {
        firstTokenId = haikuIdToTokenId[haikuId];
        editionsCount = haikus[haikuId].totalEditions;
    }

    function getRemainingEditions(uint256 haikuId) external view returns (uint256) {
        uint256 total = haikus[haikuId].totalEditions;
        uint256 sold = haikus[haikuId].editionsSold;
        return total - sold;
    }

    function getTransactionHistory(uint256 tokenId) external view returns (Transaction[] memory) {
        return haikus[_haikuIdFromToken(tokenId)].transactionHistory;
    }

    function getTokenFullDetails(uint256 tokenId) external view returns (
        address owner,
        uint256 mintDate,
        uint256 currentPrice,
        bool forSale,
        uint256[] memory priceHistory,
        Transaction[] memory transactions,
        string memory haiku_,
        address creator_
    ) {
        require(_exists(tokenId), "Token does not exist");

        uint256 haikuId = _haikuIdFromToken(tokenId);
        Haiku storage haikuData = haikus[haikuId];

        owner = ownerOf(tokenId);
        mintDate = _mintDates[tokenId];
        currentPrice = _tokenPrices[tokenId];
        forSale = _IstokenForSale[tokenId];
        priceHistory = haikuData.priceHistory;
        transactions = haikuData.transactionHistory;
        haiku_ = haikuData.haiku;
        creator_ = haikuData.creator;
    }

    function getLastMintedTokenId() external view returns (uint256) {
        require(_tokenIdCounter.current() > 0, "No token minted yet");
        return _tokenIdCounter.current() - 1;
    }

    function getLastUniqueHaikusMinted() external view returns (uint256) {
        return _HaikusUnique.current();
    }

    function isNFTForSale(uint256 tokenId) external view returns (bool) {
        return _IstokenForSale[tokenId];
    }

    function _haikuIdFromToken(uint256 tokenId) internal view returns (uint256) {
        for (uint256 i = 0; i < _HaikusUnique.current(); i++) {
            if (tokenId >= haikuIdToTokenId[i] && tokenId < haikuIdToTokenId[i] + haikus[i].totalEditions) {
                return i;
            }
        }
        revert("Haiku ID not found for token");
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function findTokenIndex(uint256 tokenId) internal view returns (uint256) {
        uint256[] storage tokens = _tokensByCollection[collectionId];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) return i;
        }
        revert("Token not found in collection");
    }

    function updateDefaultRoyaltyAddress(address newRoyaltyAddress) external onlyOwner {
        require(newRoyaltyAddress != address(0), "Invalid address");
        defaultRoyaltyAddress = newRoyaltyAddress; // Met à jour l'adresse par défaut
    }

    function getHaikuRoyalties(uint256 haikuId) external view returns (address[] memory recipients, uint256[] memory percentages) {
        RoyaltySplit storage split = haikuRoyalties[haikuId];
        return (split.recipients, split.percentages);
}

}
