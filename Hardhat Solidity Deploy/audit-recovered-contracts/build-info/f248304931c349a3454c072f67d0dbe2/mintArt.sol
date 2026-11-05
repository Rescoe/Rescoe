// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IReward.sol";

/// @title  ArtNFT — ERC721 with automatic rarity & edition-aware logic
/// @author RESCOE (Thibault)
/// @notice ERC721 contract extended to support edition-based rarity, on-chain lightweight metadata and a configurable split.
/// @dev    Keeps original public/private API names when possible. Overrides _exists to use an internal external-owner mapping
contract ArtNFT is ERC721URIStorage, Ownable, ReentrancyGuard  {
    using Counters for Counters.Counter;
    /// @notice Reward contract link (external)
    IReward private rewardContract;

    /// @notice Token id counter
    Counters.Counter private _tokenIdCounter;

    /// @notice Collection id — défini à la création (factory)
    uint256 public collectionId;
    /// @notice Collection type (ex: "photo", "painter", etc.)
    string public collectionType;

    /// @notice Last minted token id (dernier id utilisé)
    uint256 public lastMintedTokenId;

    /// @notice Local total supply maintained (useful si pas d'Enumerable)
    uint256 private _totalSupply;

    /// @notice Reward points mapping (local)
    mapping(address => uint256) private _rewardPoints;

    /// @notice Creator fee bounds (pour usage futur)
    uint256 public minCreatorFee = 5;
    uint256 public maxCreatorFee = 20;

    /// @notice Per-user fee overrides (optionnel)
    mapping(address => uint256) public userFeePercentage;

    /// @notice Fee percentage taken by contract owner (applied on sale price)
    uint256 public constant OWNER_FEE_PERCENTAGE = 10;

    /// @notice Per-token sale price / forSale flags
    mapping(uint256 => uint256) private _tokenPrices;
    mapping(uint256 => bool) private _tokenForSale;

    /// @notice Price history and mint dates
    mapping(uint256 => uint256[]) private _priceHistory;
    mapping(uint256 => uint256) private _mintDates;

    /// @notice Token <> collection mapping and list of tokens per collection
    mapping(uint256 => uint256) private _tokenCollections;
    mapping(uint256 => uint256[]) private _tokensByCollection;

    /// @notice Light on-chain collection type store (rarement utilisé)
    mapping(uint256 => string) private _collectionTypes;

    /// @notice Association address (beneficiary for splits)
    address public associationAddress;

    /// @notice Token creator mapping
    mapping(uint256 => address) public tokenCreator;

    /// @notice Light on-chain metadata: rarity (1..255) and simple traits string
    mapping(uint256 => uint8) public tokenRarity;

    /// @notice External owner mapping used by this contract (keeps in sync with OZ internal owners)
    mapping(uint256 => address) private _extOwners;

    /// @notice Transaction history struct and mapping
    struct Transaction {
        address buyer;
        address seller;
        uint256 price;
        uint256 timestamp;
    }
    mapping(uint256 => Transaction[]) private _transactionHistory;

    /// @notice Configurable share of the OWNER_FEE_PERCENTAGE that goes to the association (rest goes to artist)
    /// @dev value in percent (0..100)
    uint8 public associationFeeSharePercent;

    /// @notice Extra recipients for royalties (dynamic split)
    address[] public extraRecipients;
    uint256[] public extraPercents; // same length as extraRecipients, sum <= 100

mapping(address => uint256) public pendingWithdrawals;


// Mapping du token unique à ses exemplaires
mapping(uint256 => uint256[]) private _tokenUniqueToEditions;

// Mapping de tokenId vers le tokenUnique correspondant
mapping(uint256 => uint256) private _tokenIdToUniqueToken;

// Nombre d'exemplaires pour chaque token unique
mapping(uint256 => uint256) private _tokenUniqueEditionCount;

// Compteur du prochain token unique
uint256 private _nextTokenUnique = 1;


    /* ===========================
       EVENTS
       =========================== */
    event NFTListedForSale(uint256 indexed tokenId, uint256 price);
    event NFTSold(uint256 indexed tokenId, address buyer, uint256 price);
    event NFTMinted(uint256 indexed tokenId, address indexed owner, string uri, uint8 rarity, uint256 editions);
    event NFTRemoved(uint256 indexed tokenId);
    event RewardPointsCalculated(address indexed user, uint256 points);

    /* ===========================
       CONSTRUCTOR
       =========================== */

    /**
     * @notice Construct the ArtNFT contract for a given collection
     * @param initialOwner The owner (factory/master) who will be set as contract owner
     * @param collectionName ERC721 name
     * @param collectionSymbol ERC721 symbol
     * @param _collectionId Id of the collection (factory-provided)
     * @param _collectionType Type string of the collection
     * @param _adhesionContractAddress Reward / adhesion contract address
     * @param _associationAddress Address receiving association fees
     * @param _associationFeeSharePercent Percent of owner-fee that goes to association (0..100)
     */
    constructor(
        address initialOwner,
        string memory collectionName,
        string memory collectionSymbol,
        uint256 _collectionId,
        string memory _collectionType,
        address _adhesionContractAddress,
        address _associationAddress,
        uint8 _associationFeeSharePercent,
        uint256 _maxSupply,
        address[] memory _extraRecipients,
        uint256[] memory _extraPercents
    ) ERC721(collectionName, collectionSymbol) Ownable(initialOwner) {
        collectionId = _collectionId;
        collectionType = _collectionType;
        rewardContract = IReward(_adhesionContractAddress);
        associationAddress = _associationAddress;
        associationFeeSharePercent = _associationFeeSharePercent;

        require(_associationFeeSharePercent <= 100, "association share must be <=100");

        // Extra recipients validation
        require(_extraRecipients.length == _extraPercents.length, "extra arrays mismatch");
        uint256 totalExtra = 0;
        for (uint256 i = 0; i < _extraPercents.length; i++) {
            totalExtra += _extraPercents[i];
        }
        require(totalExtra <= 100, "extra percents too high");
        extraRecipients = _extraRecipients;
        extraPercents = _extraPercents;



        // Store maxSupply internally
        _maxSupplyFallback = _maxSupply;
    }

    /* ===========================
       MINT / RARITY LOGIC
       =========================== */


/// @notice Register editions for a tokenURI
/// @param tokenUnique the unique token ID for this artwork (master)
/// @param mintedTokenIds array of minted token IDs (editions)
function _registerEditions(uint256 tokenUnique, uint256[] memory mintedTokenIds) internal {
    require(mintedTokenIds.length > 0, "No editions to register");

    for (uint256 i = 0; i < mintedTokenIds.length; i++) {
        uint256 tokenId = mintedTokenIds[i];

        // Associer tokenId au tokenUnique
        _tokenIdToUniqueToken[tokenId] = tokenUnique;

        // Ajouter le tokenId à la liste des éditions
        _tokenUniqueToEditions[tokenUnique].push(tokenId);
    }

    // Mettre à jour le compteur d'éditions
    _tokenUniqueEditionCount[tokenUnique] += mintedTokenIds.length;
}


    /**
     * @notice Mint `editions` copies for a tokenURI. Keeps signature `mint(string,uint256)`.
     * @dev editions must be >=1 and < 251 per your rule. Rarity is computed automatically using
     *      a deterministic formula that takes `editions` and `maxSupplyCandidate` into account.
     *      The factory is expected to pass a "maxSupply" as a collection-level parameter in practice;
     *      here we use `collectionMaxSupply()` helper (can be implemented in factory integration).
     * @param tokenURI_ token metadata URI (ipfs JSON)
     * @param editions number of editions to mint for this artwork
     */
function mint(string calldata tokenURI_, uint256 editions) external onlyOwner {
    require(editions > 0, "Vous devez choisir un nombre d'editions superieur a zero");

    uint256 maxSupply = _getCollectionMaxSupplyFallback();
    require(_totalSupply + editions <= maxSupply, "Maximum d'oeuvre dans la collection atteinte");

    require (_totalSupply <= maxSupply, "Maximum d'oeuvre dans la collection atteinte");


    uint256 tokenUnique = _nextTokenUnique;
    _nextTokenUnique += 1;

    uint256[] memory mintedTokenIds = new uint256[](editions);


    for (uint256 i = 0; i < editions; ) {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();

        mintedTokenIds[i] = newTokenId;  // ✅ assignation correcte

        // Mint via OpenZeppelin — met à jour _owners
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        // Keep external owner mapping in sync
        _extOwners[newTokenId] = msg.sender;

        // Collection bookkeeping
        _tokenCollections[newTokenId] = collectionId;
        _tokensByCollection[collectionId].push(newTokenId);
        _mintDates[newTokenId] = block.timestamp;
        tokenCreator[newTokenId] = msg.sender;

        // Rarity calculation (uint8 1..255)
        uint8 computedRarity = _computeRarityEdition(editions); // ✅ Fixed
        tokenRarity[newTokenId] = computedRarity;

        lastMintedTokenId = newTokenId;
        _totalSupply += 1;

        emit NFTMinted(newTokenId, msg.sender, tokenURI_, computedRarity, editions);

        unchecked { ++i; }

    }

        // remplir mintedTokenIds[i] = tokenId à chaque mint
    _registerEditions(tokenUnique, mintedTokenIds);

}


    /// @dev Fallback method to supply a collection max supply.
    ///      Replace by a factory-passed value if your factory sets it on-chain.
    uint256 private _maxSupplyFallback;

    function _getCollectionMaxSupplyFallback() public view returns (uint256) {
        return _maxSupplyFallback;
    }

/// ===========================
/// 🔹 Rareté combinée édition
/// ===========================

/// @dev Internal log2 approximation for edition-based rarity
function _log2(uint256 x) internal pure returns (uint256) {
    require(x > 0, "log2 undefined for 0");
    uint256 r = 0;
    while (x > 1) {
        x >>= 1;
        r += 1;
    }
    return r;
}

/// @dev returns value in [0..254] representing normalized log2(editionSize)/log2(maxSupply)
function _log2Normalized(uint256 editionSize, uint256 maxSupply) internal pure returns (uint256) {
    // editionSize and maxSupply are > 0
    uint256 le = _log2(editionSize);
    uint256 lm = _log2(maxSupply);
    if (lm == 0) return 0;
    // scaled in 0..254
    uint256 scaled = (le * 254) / lm;
    if (scaled > 254) scaled = 254;
    return scaled;
}


/// @notice Compute edition-based rarity (logarithmic)
/// @param editionSize Number of editions for this token
/// @return rarityEdition uint8 in [1..255], smaller editions = lower score = rarer
function _computeRarityEdition(uint256 editionSize) internal view returns (uint8) {
    uint256 maxSupply = _getCollectionMaxSupplyFallback();
    if (editionSize == 0 || maxSupply == 0) {
        return 255; // fallback "least rare"
    }

    if (editionSize > maxSupply) editionSize = maxSupply;

    // Use normalized log2: log2(editionSize) / log2(maxSupply)
    // editionSize = 1 -> le = 0 -> scaled = 0 -> rarity = 1 (rarest)
    uint256 scaled = _log2Normalized(editionSize, maxSupply); // 0..254
    return uint8(scaled + 1); // 1..255
}


    /* ===========================
       SALE / BUY / SPLIT
       =========================== */

    /// @notice List a token for sale
    function listNFTForSale(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price > 0");

        _priceHistory[tokenId].push(price);
        _tokenForSale[tokenId] = true;
        _tokenPrices[tokenId] = price;

        emit NFTListedForSale(tokenId, price);
    }

function buyNFT(uint256 tokenId) external payable nonReentrant {
    require(_exists(tokenId), "Token does not exist");

    address seller = ownerOf(tokenId);
    require(msg.sender != seller, "Cannot buy your own NFT");
    require(_tokenForSale[tokenId], "NFT not for sale");

    uint256 price = _tokenPrices[tokenId];
    require(msg.value >= price, "Insufficient funds");

    address artist = tokenCreator[tokenId];
    require(artist != address(0), "Artist not set");

    bool isFirstSale = (seller == artist);

    // =========================
    // 1️⃣ CALCUL DES MONTANTS
    // =========================

    uint256 associationFee;
    uint256 sellerAmount;
    uint256 creatorBaseAmount;
    uint256[] memory extraAmounts = new uint256[](extraRecipients.length);
    uint256 totalExtraShare = 0;

    if (isFirstSale) {
        // ----------------------------
        // première vente (primary sale)
        // ----------------------------
        associationFee = (price * 10) / 100; // 10%
        uint256 remaining = price - associationFee; // 90%

        // Extra recipients : partent de remaining
        for (uint256 i = 0; i < extraRecipients.length; i++) {
            if (extraPercents[i] > 0) {
                uint256 share = (remaining * extraPercents[i]) / 100;
                if (share > remaining / 2) {
                    share = remaining / 2;
                }
                extraAmounts[i] = share;
                totalExtraShare += share;
            }
        }

        creatorBaseAmount = remaining - totalExtraShare;
        sellerAmount = 0; // artiste est vendeur → déjà compté

    } else {
        // ----------------------------
        // revente (secondary sale)
        // ----------------------------
        sellerAmount = (price * 90) / 100; // seller reçoit 90%

        uint256 royaltyPool = price - sellerAmount; // = 10%

        // 3% association / 7% artiste
        associationFee = (royaltyPool * 30) / 100;
        creatorBaseAmount = (royaltyPool * 70) / 100;

        // Extra recipients dans les 7%
        for (uint256 i = 0; i < extraRecipients.length; i++) {
            if (extraPercents[i] > 0) {
                uint256 share = (creatorBaseAmount * extraPercents[i]) / 100;
                extraAmounts[i] = share;
                totalExtraShare += share;
            }
        }

        creatorBaseAmount -= totalExtraShare;
    }

    // =========================
    // 2️⃣ TRANSFERTS EN ETH (push)
    // =========================

    // Association
    if (associationFee > 0) {
        (bool a, ) = payable(associationAddress).call{value: associationFee}("");
        require(a, "Association payment failed");
    }

    // Extras
    for (uint256 i = 0; i < extraRecipients.length; i++) {
        if (extraAmounts[i] > 0) {
            (bool e, ) = payable(extraRecipients[i]).call{value: extraAmounts[i]}("");
            require(e, "Extra payment failed");
        }
    }

    // Artist
    if (creatorBaseAmount > 0) {
        (bool artPaid, ) = payable(artist).call{value: creatorBaseAmount}("");
        require(artPaid, "Artist payment failed");
    }

    // Seller (seulement en revente)
    if (sellerAmount > 0) {
        (bool s, ) = payable(seller).call{value: sellerAmount}("");
        require(s, "Seller payment failed");
    }

    // =========================
    // 3️⃣ Historique + transfert
    // =========================


    _transactionHistory[tokenId].push(
        Transaction({
            buyer: msg.sender,
            seller: seller,
            price: price,
            timestamp: block.timestamp
        })
    );

    _tokenForSale[tokenId] = false;

    _transfer(seller, msg.sender, tokenId);
    _extOwners[tokenId] = msg.sender;

    emit NFTSold(tokenId, msg.sender, price);

    // =========================
    // 4️⃣ Reward points
    // =========================
    uint256 totalPoints = (price * 1000) / 1e18;

    // Association
    uint256 assocPts = (totalPoints * associationFee) / price;
    rewardContract.mettreAJourPoints(associationAddress, assocPts);

    uint256 remainingPts = totalPoints - assocPts;

    // Extra recipients
    for (uint256 i = 0; i < extraRecipients.length; i++) {
        if (extraAmounts[i] > 0) {
            uint256 pts = (totalPoints * extraAmounts[i]) / price;
            remainingPts -= pts;
            rewardContract.mettreAJourPoints(extraRecipients[i], pts);
        }
    }

    // Artist
    rewardContract.mettreAJourPoints(artist, remainingPts);

    emit RewardPointsCalculated(seller, totalPoints);

    // Refund
    if (msg.value > price) {
        uint256 excess = msg.value - price;
        (bool refund, ) = payable(msg.sender).call{value: excess}("");
        require(refund, "Refund failed");
    }
}





    /* ===========================
       METADATA / HELPERS
       =========================== */

    /// @notice Get price history
    function getPriceHistory(uint256 tokenId) external view returns (uint256[] memory) {
        return _priceHistory[tokenId];
    }

    /// @notice Get token mint date
    function getMintDate(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        return _mintDates[tokenId];
    }

    /// @notice Get transaction history (array)
    function getTransactionHistory(uint256 tokenId) external view returns (Transaction[] memory) {
        return _transactionHistory[tokenId];
    }

    /// @notice External setter to adjust light on-chain metadata (rarity override or traits)
    /// @dev Only contract owner or token creator can call
    function setTokenMetadataOnChain(uint256 tokenId, uint8 rarity) external {
        require(_exists(tokenId), "Token does not exist");
        address creator = tokenCreator[tokenId];
        require(msg.sender == owner() || msg.sender == creator, "Not allowed");

        require(rarity >= 1 && rarity <= 255, "Rarity must be 1..255");
        tokenRarity[tokenId] = rarity;
    }

    /* ===========================
       BURN / PAGINATION / SUPPLY
       =========================== */

    /// @notice Burn a token — only owner of token can burn
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "You do not own this NFT");

        _burn(tokenId); // OZ burn: updates OZ internal mappings, events

        // Remove from our external mapping & collection arrays
        delete _extOwners[tokenId];

        uint256 colId = _tokenCollections[tokenId];
        uint256[] storage arr = _tokensByCollection[colId];
        for (uint256 i = 0; i < arr.length; ++i) {
            if (arr[i] == tokenId) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }

        // Cleanup lightweight metadata
        delete _tokenCollections[tokenId];
        delete _mintDates[tokenId];
        delete tokenCreator[tokenId];
        delete tokenRarity[tokenId];
        delete _tokenPrices[tokenId];
        delete _tokenForSale[tokenId];

        require(_totalSupply > 0, "Internal error: totalSupply zero");
        _totalSupply -= 1;

        uint256 tokenUnique = _tokenIdToUniqueToken[tokenId];

        if(tokenUnique != 0){
            _tokenUniqueEditionCount[tokenUnique] -= 1;
            
            uint256[] storage editions = _tokenUniqueToEditions[tokenUnique];
            for (uint256 i = 0; i < editions.length; i++) {
                if (editions[i] == tokenId) {
                    editions[i] = editions[editions.length - 1];
                    editions.pop();
                    break;
                }
            }
            delete _tokenIdToUniqueToken[tokenId];
}


        emit NFTRemoved(tokenId);
    }

    /**
     * @notice Return paginated token ids for the collection starting from an index (based on stored tokensByCollection)
     * @dev This returns actual stored token IDs (skips burned tokens as they were removed from the array in burn())
     * @param startIndex start index in the collection array (0-based)
     * @param pageSize number of items to return
     * @return paginatedTokens array of token ids
     */
    function getTokenPaginated(uint256 startIndex, uint256 pageSize) external view returns (uint256[] memory) {
        uint256[] storage coll = _tokensByCollection[collectionId];
        require(startIndex < coll.length, "Start index out of bounds");

        uint256 endIndex = startIndex + pageSize;
        if (endIndex > coll.length) endIndex = coll.length;

        uint256 len = endIndex - startIndex;
        uint256[] memory paginatedTokens = new uint256[](len);

        uint256 cur = 0;
        for (uint256 i = startIndex; i < endIndex; ) {
            paginatedTokens[cur] = coll[i];
            unchecked { ++i; ++cur; }
        }
        return paginatedTokens;
    }

    /// @notice Return paginated tokenUnique IDs and their edition counts
/// @param startIndex index de départ dans la liste des tokenUnique
/// @param pageSize nombre maximum de tokenUnique à renvoyer
function getTokenUniquesPaginated(uint256 startIndex, uint256 pageSize)
    external
    view
    returns (uint256[] memory tokenUniques, uint256[] memory editionCounts)
{
    uint256 totalUniques = _nextTokenUnique - 1;
    if (totalUniques == 0) return (new uint256[](0), new uint256[](0));
    require(startIndex < totalUniques, "Start index out of bounds");


    uint256 endIndex = startIndex + pageSize;
    if (endIndex > totalUniques) endIndex = totalUniques;

    uint256 len = endIndex - startIndex;
    tokenUniques = new uint256[](len);
    editionCounts = new uint256[](len);

    for (uint256 i = 0; i < len; i++) {
        uint256 tokenUniqueId = startIndex + 1 + i; // tokenUnique starts at 1
        tokenUniques[i] = tokenUniqueId;
        editionCounts[i] = _tokenUniqueEditionCount[tokenUniqueId];
    }

    if(totalUniques == 0) return (new uint256[](0), new uint256[](0));
}


    /// @notice Check if a token is for sale
    function isNFTForSale(uint256 tokenId) external view returns (bool) {
        return _tokenForSale[tokenId];
    }

    /// @notice Get token price
    function getTokenPrice(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenPrices[tokenId];
    }

    /* ===========================
       OWNERSHIP / EXISTENCE SHIFT-SYNC
       =========================== */

    /// @notice Custom existence check — overrides OZ internal function to use the external mapping.
    /// @dev We override `_exists` to read from our `_extOwners` mapping. Keep this function name so external code depending on it still works.
function _exists(uint256 tokenId) internal view virtual returns (bool) {
    return _extOwners[tokenId] != address(0);
}

    /// @notice External wrapper to check existence (keeps your original signature doesTokenExist)
    function doesTokenExist(uint256 tokenId) public view returns (bool) {
        return _exists(tokenId);
    }

/**
 * @dev Internal override pour tracker l'existence on-chain via _extOwners.
 * Utilise le hook moderne OZ `_update` (compatible ERC721URIStorage).
 */
function _update(
    address to,
    uint256 tokenId,
    address auth
) internal virtual override returns (address from) {
    from = super._update(to, tokenId, auth);

    if (to == address(0)) {
        // Burn
        delete _extOwners[tokenId];
    } else {
        // Mint or Transfer
        _extOwners[tokenId] = to;
    }

    return from;
}


    /* ===========================
       GETTERS / DETAILS
       =========================== */

    /// @notice Return full details for a token (compact)
    function getTokenFullDetails(uint256 tokenId)
        external
        view
        returns (
            address owner,
            uint256 mintDate,
            uint256 currentPrice,
            bool forSale,
            uint256[] memory priceHistory,
            Transaction[] memory transactions,
            uint256 collectionId_,
            string memory tokenURI_,
            uint8 rarity
        )
    {
        require(_exists(tokenId), "Token does not exist");

        owner = ownerOf(tokenId);
        mintDate = _mintDates[tokenId];
        currentPrice = _tokenPrices[tokenId];
        forSale = _tokenForSale[tokenId];
        priceHistory = _priceHistory[tokenId];
        transactions = _transactionHistory[tokenId];
        collectionId_ = _tokenCollections[tokenId];
        tokenURI_ = tokenURI(tokenId);
        rarity = tokenRarity[tokenId];
    }

    /// @notice Return last minted token id
    function getLastMintedTokenId() external view returns (uint256) {
        require(_tokenIdCounter.current() > 0, "No token has been minted yet");
        return _tokenIdCounter.current();
    }

    /// @notice Return total supply
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    /* ===========================
       ADMIN / UTIL
       =========================== */

    /// @notice Helper: return token IDs for a collection (full)
    function getTokensByCollection(uint256 colId) external view returns (uint256[] memory) {
        return _tokensByCollection[colId];
    }

    /// @notice Return token rarity and traits in one call
    function getTokenLightMetadata(uint256 tokenId) external view returns (uint8 rarity) {
        rarity = tokenRarity[tokenId];
    }
}
