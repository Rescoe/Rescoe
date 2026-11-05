// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IReward.sol";


contract AdhesionRescoe is ERC721URIStorage, Ownable, IReward {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    uint256 public constant pointsToAdd = 15; // Nombre de points attribués

    uint256 private _totalMinted;
    uint256 public feePercentage = 10;
    uint256 public mintPrice = 0.005 ether;

    // Prix par point et constante pour le nombre de points par coût
    uint256 public pointPrice = 0.0001 ether; // Coût pour 1 point


    struct Member {
        uint256 role;
        bool exists;
        uint256 mintTimestamp;
        bool isForSale;
    }

    // NOUVELLES STRUCTURES ET VARIABLES
struct MembershipInfo {
    uint8 level;           // 0=oeuf, 1=chenille, 2=cocon, 3=insecte
    bool autoEvolve;       // true = relayer évolue automatiquement
    uint256 startTimestamp;
    uint256 expirationTimestamp;
    uint256 totalYears;    // pour tracking reproduction
}

struct YearlyMints {
    uint8 count;
}

mapping(uint256 => MembershipInfo) public membershipInfo;
mapping(address => mapping(uint256 => uint8)) public mintsPerYear; // addr => year => count
uint8 public constant MAX_LEVEL = 3;
uint256 public constant REPRODUCE_POINTS_COST = 100;
uint256 public constant BURN_POINTS_REWARD = 10;
uint256 public constant DUST_ETH = 0.0001 ether; // pour relayer
uint256[4] public levelDurations = [    7 days,    // lvl 0 oeuf
    56 days,   // lvl 1 chenille  
    112 days,  // lvl 2 cocon
    365 days - 7 days - 56 days - 112 days // lvl 3 reste de l'année
];
address public relayer; // futur contrat evolution

    mapping(address => Member) public members;
    mapping(uint256 => address[]) private membersByRole;
    mapping(uint256 => uint256) private _tokenPrices;
    mapping(uint256 => bool) private _tokenForSale;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => uint8) private _tokenRoles;
    mapping(uint256 => uint256) private _mintTimestamps;
    mapping(address => string) private _names;
    mapping(address => string) private _biographies;
    mapping(address => uint256) public rewardPoints; // Récompenses pour chaque adresse
    mapping(address => uint256[]) private _tokensByOwner;

    event RewardsAdded(address user, uint256 amount);
    event RewardsDeducted(address user, uint256 amount);

    event NFTSold(uint256 tokenId, address buyer, uint256 price);
    event NFTMinted(address recipient, uint256 tokenId);
    event MultipleNFTsMinted(address[] members, uint256[] tokenIds);
    event MintPriceChanged(uint256 newPrice);
    event MembershipRenewed(uint256 tokenId, address owner, uint256 membershipYears);
    event MembershipUpdated(uint256 tokenId, address owner, string newName, string newBio);
    event NFTTransfer(address from, address to, uint256 tokenId);
    event TokenBurned(uint256 indexed tokenId, address indexed owner);
    event NFTListedForSale(uint256 tokenId, uint256 price);
    event PointsPurchased(address indexed user, uint256 points, uint256 price);

event LevelEvolved(uint256 indexed tokenId, uint8 newLevel);
event Reproduced(uint256 indexed parentA, uint256 indexed parentB, uint256 newEgg);


    constructor(address initialOwner) ERC721("Adhesion Rescoe", "RESCOE") Ownable(initialOwner) {
        transferOwnership(initialOwner);
    }


    function getUserInfo(address user) public view returns (
        bool membershipValid,
        string memory name,
        string memory bio
    ) {
        // Vérifiez si l'utilisateur est un membre
        require(members[user].exists, "User is not a member");

        // Vérifiez la validité de l'adhésion
        uint256[] memory tokens = getTokensByOwner(user);
        membershipValid = false; // Valeur par défaut

        for (uint256 i = 0; i < tokens.length; i++) {
            if (getRemainingMembershipTime(tokens[i]) > 0) {
                membershipValid = true; // L'utilisateur a une adhésion valable
                break; // Aucune autre vérification nécessaire
            }
        }

        // Récupérer le nom et la biographie
        name = _names[user];
        bio = _biographies[user];

        // Retourner les valeurs
        return (membershipValid, name, bio);
    }

    // Modifier le prix des points
    function setPointPrice(uint256 newPrice) public onlyOwner {
        pointPrice = newPrice;
    }

    function buyRewardPoints(address user, uint256 pointsToBuy) public payable {
        uint256 totalPrice = pointsToBuy * pointPrice;

        require(msg.value >= totalPrice, "Pas assez de fonds pour acheter les points");

        (bool membershipValid, , ) = getUserInfo(user);
        require(membershipValid, "L'utilisateur doit etre membre pour acheter des points");

        // Mettre à jour les points dans le contrat d'adhésion
        mettreAJourPoints(user, pointsToBuy);

        // Gestion de l'excédent
        uint256 excess = msg.value - totalPrice;
        if (excess > 0) {
            payable(msg.sender).transfer(excess); // Remboursement de l'excédent à l'utilisateur
        }

        // Événement pour la traçabilité
        emit PointsPurchased(user, pointsToBuy, totalPrice);
    }


    
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
        emit MintPriceChanged(newPrice);
    }

// MODIFIÉ: getRemainingMembershipTime (utilise membershipInfo)
function getRemainingMembershipTime(uint256 tokenId) public view returns (uint256) {
    require(_exists(tokenId), "Token does not exist");
    uint256 exp = membershipInfo[tokenId].expirationTimestamp;
    if (block.timestamp >= exp) return 0;
    return exp - block.timestamp;
}

// MODIFIÉ: getTokenDetails (ajoute level, autoEvolve)
function getTokenDetails(uint256 tokenId) public view returns (
    address owner,
    uint8 role,
    uint256 mintTimestamp,
    uint256 price,
    string memory name,
    string memory bio,
    uint256 remainingTime,
    bool forSale,
    uint8 level,           // NOUVEAU
    bool autoEvolve,       // NOUVEAU
    uint256 expTimestamp   // NOUVEAU
) {
    require(_exists(tokenId), "Token does not exist");

    owner = ownerOf(tokenId);
    role = _tokenRoles[tokenId];
    mintTimestamp = _mintTimestamps[tokenId];
    price = _tokenPrices[tokenId];
    name = _names[owner];
    bio = _biographies[owner];
    remainingTime = getRemainingMembershipTime(tokenId);
    forSale = _tokenForSale[tokenId];
    
    MembershipInfo memory info = membershipInfo[tokenId];
    level = info.level;
    autoEvolve = info.autoEvolve;
    expTimestamp = info.expirationTimestamp;
}



// NOUVEAU: burnAndUpgrade (brûle lvl N pour lvl N+1 + 10 pts)
function burnAndUpgrade(uint256 tokenIdToBurn, string memory newURI) public payable {
    require(ownerOf(tokenIdToBurn) == msg.sender, "Not owner");
    require(msg.value >= DUST_ETH, "Dust required");
    
    MembershipInfo memory info = membershipInfo[tokenIdToBurn];
    require(info.level < MAX_LEVEL, "Already max level");
    
    // DONNE 10 POINTS
    rewardPoints[msg.sender] += BURN_POINTS_REWARD;
    emit RewardsAdded(msg.sender, BURN_POINTS_REWARD);
    
    // BURN OLD TOKEN
    uint256 oldTokenId = tokenIdToBurn;
    emit TokenBurned(oldTokenId, msg.sender);
    _burn(oldTokenId);
    //totalSupply--;
    
    // MINT NEW LEVEL
    uint256 newTokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _safeMint(msg.sender, newTokenId);
    _setTokenURI(newTokenId, newURI);
    
    membershipInfo[newTokenId] = MembershipInfo({
        level: info.level + 1,
        autoEvolve: info.autoEvolve,
        startTimestamp: block.timestamp,
        expirationTimestamp: block.timestamp + levelDurations[info.level + 1],
        totalYears: info.totalYears
    });
    
    _tokenRoles[newTokenId] = _tokenRoles[oldTokenId];
    _mintTimestamps[newTokenId] = block.timestamp;
    _tokensByOwner[msg.sender].push(newTokenId);
    
    //totalSupply++; // net 0 change
    payable(relayer).transfer(DUST_ETH);
    
    emit NFTMinted(msg.sender, newTokenId);
}

// NOUVEAU: reproduce (2 insectes lvl3 +1an + 100pts + 0.0025 ETH)
function reproduce(uint256 parentA, uint256 parentB) public payable {
    require(parentA != parentB, "Parents must be different");
    require(ownerOf(parentA) == ownerOf(parentB), "Same owner required");
    require(ownerOf(parentA) == msg.sender, "Not owner");
    
    require(msg.value >= mintPrice / 2 + DUST_ETH, "Half price + dust");
    
    MembershipInfo memory infoA = membershipInfo[parentA];
    MembershipInfo memory infoB = membershipInfo[parentB];
    
    require(infoA.level == MAX_LEVEL && infoB.level == MAX_LEVEL, "Both must be lvl 3");
    require(infoA.totalYears >= 1 && infoB.totalYears >= 1, "1+ year membership");
    
    // RETIRE 100 POINTS
    require(rewardPoints[msg.sender] >= REPRODUCE_POINTS_COST, "Not enough points");
    rewardPoints[msg.sender] -= REPRODUCE_POINTS_COST;
    
    // MINT NOUVEL ŒUF GRATUIT (lvl0)
    uint256 newTokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _safeMint(msg.sender, newTokenId);
    _setTokenURI(newTokenId, "ipfs://oeuf_uri"); // URI oeuf par défaut
    
    membershipInfo[newTokenId] = MembershipInfo({
        level: 0,
        autoEvolve: true, // auto par défaut pour enfant
        startTimestamp: block.timestamp,
        expirationTimestamp: block.timestamp + levelDurations[0],
        totalYears: 0
    });
    
    _tokenRoles[newTokenId] = _tokenRoles[parentA];
    _mintTimestamps[newTokenId] = block.timestamp;
    _tokensByOwner[msg.sender].push(newTokenId);
    //totalSupply++;
    
    // PAYMENTS
    payable(relayer).transfer(DUST_ETH);
    payable(owner()).transfer(mintPrice / 2);
    uint256 excess = msg.value - mintPrice / 2 - DUST_ETH;
    if (excess > 0) payable(msg.sender).transfer(excess);
    
    emit NFTMinted(msg.sender, newTokenId);
    emit RewardsDeducted(msg.sender, REPRODUCE_POINTS_COST);}

// MODIFIÉ: burnNFT (dust ETH)
function burnNFT(uint256 tokenId) public {
    require(ownerOf(tokenId) == msg.sender, "You do not own this token");
    
    rewardPoints[msg.sender] += BURN_POINTS_REWARD; // +10 pts
    emit RewardsAdded(msg.sender, BURN_POINTS_REWARD);
    
    emit TokenBurned(tokenId, msg.sender);
    delete _tokenPrices[tokenId];
    delete _tokenForSale[tokenId];
    delete membershipInfo[tokenId]; // nettoie membership
    
    _burn(tokenId);
    //totalSupply--;
    if (relayer != address(0)) payable(relayer).transfer(DUST_ETH);
}

// AJOUT: setters owner (à appeler après deploy)
function setRelayer(address _relayer) public onlyOwner {
    relayer = _relayer;
}

function setLevelDurations(uint256[4] memory durations) public onlyOwner {
    levelDurations = durations;
}

function totalSupply() public view returns (uint256) {
    return totalSupply(); // Call the inherited function
}


function mintMultiple(
    address[] memory recipients,
    string[] memory uris,
    uint256[] memory roles,
    string[] memory names,
    string[] memory bios
) external onlyOwner {
    require(recipients.length == uris.length &&
            uris.length == roles.length &&
            roles.length == names.length &&
            names.length == bios.length, "Array lengths must match");
    require(recipients.length <= 100, "Max 100 per batch"); // gas limit

    uint256[] memory tokenIds = new uint256[](recipients.length);

    for (uint256 i = 0; i < recipients.length; i++) {
        require(roles[i] >= 0 && roles[i] <= 3, "Role must be between 0 and 3");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(recipients[i], tokenId);
        _setTokenURI(tokenId, uris[i]);

        // **ADHÉSION 1 AN AUTOMATIQUE** (événementiel)
        membershipInfo[tokenId] = MembershipInfo({
            level: 0,                    // commence oeuf
            autoEvolve: true,            // **RELAYER AUTO-ÉVOLUE**
            startTimestamp: block.timestamp,
            expirationTimestamp: block.timestamp + 365 days,  // 1 an complet
            totalYears: 1
        });

        // Infos membres
        _names[recipients[i]] = names[i];
        _biographies[recipients[i]] = bios[i];
        members[recipients[i]] = Member(roles[i], true, block.timestamp, false);
        membersByRole[roles[i]].push(recipients[i]);

        // Metadata token
        //totalSupply++;
        _tokenRoles[tokenId] = uint8(roles[i]);
        _mintTimestamps[tokenId] = block.timestamp;
        _tokensByOwner[recipients[i]].push(tokenId);

        // Points récompense
        rewardPoints[recipients[i]] += pointsToAdd;

        tokenIds[i] = tokenId;
        emit NFTMinted(recipients[i], tokenId);
    }

    emit MultipleNFTsMinted(recipients, tokenIds);
}


    function setNameAndBio(uint256 tokenId, string memory name, string memory bio) public {
        // Vérifiez que l'expéditeur est le propriétaire de ce token
        require(msg.sender == ownerOf(tokenId), "Only owner can update name and bio");

        // Mettez à jour le nom et la biographie basés sur le token ID
        _names[msg.sender] = name;
        _biographies[msg.sender] = bio;

        emit MembershipUpdated(tokenId, msg.sender, name, bio); // Ajoutez cet événement
    }


// MODIFIÉ: renewMembership - 2 MODES: evolve OU extend (max 1 an)
function renewMembership(uint256 tokenId, bool isEvolveRenewal) public payable {
    require(_exists(tokenId), "Token does not exist");
    require(ownerOf(tokenId) == msg.sender, "You do not own this token");
    require(msg.value >= mintPrice + DUST_ETH, "Insufficient funds");
    
    MembershipInfo storage info = membershipInfo[tokenId];
    require(block.timestamp <= info.expirationTimestamp, "Membership already expired - remint required");
    
    if (isEvolveRenewal) {
        // MODE 1: ÉVOLUER + prolonger durée niveau
        require(info.level < MAX_LEVEL, "Max level reached");
        require(block.timestamp >= info.startTimestamp + levelDurations[info.level], "Level not ready");
        
        info.level += 1;
        info.startTimestamp = block.timestamp;
        info.expirationTimestamp = block.timestamp + levelDurations[info.level];
        
    } else {
        // MODE 2: PROLONGER sans évoluer (MAX 1 AN TOTAL)
        uint256 maxYearEnd = info.startTimestamp + 365 days;
        require(info.expirationTimestamp < maxYearEnd, "Max 1 year reached - remint required");
        
        uint256 remainingToYear = maxYearEnd - info.expirationTimestamp;
        uint256 extendDuration = levelDurations[info.level] > remainingToYear ? remainingToYear : levelDurations[info.level];
        
        info.expirationTimestamp += extendDuration;
    }
    
    payable(relayer).transfer(DUST_ETH);
    payable(owner()).transfer(mintPrice);
    
    rewardPoints[msg.sender] += pointsToAdd;
    emit MembershipRenewed(tokenId, msg.sender, isEvolveRenewal ? 1 : 0);
    emit RewardsAdded(msg.sender, pointsToAdd);
}

// MODIFIÉ: listTokenForSale - BLOQUE si durée active
function listTokenForSale(uint256 tokenId, uint256 price) public {
    require(ownerOf(tokenId) == msg.sender, "You do not own this token");
    require(price > 0, "Price must be greater than zero");
    require(getRemainingMembershipTime(tokenId) == 0, "Membership active - cannot sell");
    
    _tokenPrices[tokenId] = price;
    _tokenForSale[tokenId] = true;
    
    emit NFTListedForSale(tokenId, price);
}

// MODIFIÉ: safeMint - corrige duration bug (était levelDurations pas array)
function safeMint(
    string memory uri,
    uint256 role,
    string memory name,
    string memory bio,
    bool isAnnual,
    bool autoEvolveChoice
) public payable {
    require(role >= 0 && role <= 3, "Role must be between 0 and 3");
    require(msg.value >= mintPrice + DUST_ETH, "Insufficient funds");

    // LIMITE 2 MINTS/AN
    uint256 currentYear = block.timestamp / 365 days;
    require(mintsPerYear[msg.sender][currentYear] < 2, "Max 2 mints per year per wallet");
    mintsPerYear[msg.sender][currentYear] += 1;

    uint256 tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();

    _safeMint(msg.sender, tokenId);
    _setTokenURI(tokenId, uri);

    _names[msg.sender] = name;
    _biographies[msg.sender] = bio;

    // CORRECTION: duration correcte
    uint256 duration = isAnnual ? 365 days : levelDurations[0]; // lvl 0 par défaut
    bool autoEvolve = isAnnual ? true : autoEvolveChoice;
    
    membershipInfo[tokenId] = MembershipInfo({
        level: 0,
        autoEvolve: autoEvolve,
        startTimestamp: block.timestamp,
        expirationTimestamp: block.timestamp + duration,
        totalYears: isAnnual ? 1 : 0
    });

    members[msg.sender] = Member(role, true, block.timestamp, false);
    membersByRole[role].push(msg.sender);

    //totalSupply++;
    _tokenRoles[tokenId] = uint8(role);
    _mintTimestamps[tokenId] = block.timestamp;
    _tokensByOwner[msg.sender].push(tokenId);

    rewardPoints[msg.sender] += pointsToAdd;

    payable(relayer).transfer(DUST_ETH);
    uint256 excess = msg.value - mintPrice - DUST_ETH;
    if (excess > 0) payable(msg.sender).transfer(excess);

    emit NFTMinted(msg.sender, tokenId);
}

// CORRECTION: burnAndUpgrade (renomme en evolveManual pour clarté)
function evolveManual(uint256 tokenIdToBurn, string memory newURI) public payable {
    require(ownerOf(tokenIdToBurn) == msg.sender, "Not owner");
    require(msg.value >= DUST_ETH, "Dust required");
    
    MembershipInfo storage info = membershipInfo[tokenIdToBurn];
    require(info.level < MAX_LEVEL, "Already max level");
    require(block.timestamp >= info.startTimestamp + levelDurations[info.level], "Level not ready");
    
    // +10 POINTS pour burn
    rewardPoints[msg.sender] += BURN_POINTS_REWARD;
    emit RewardsAdded(msg.sender, BURN_POINTS_REWARD);
    
    // BURN
    uint256 oldTokenId = tokenIdToBurn;
    emit TokenBurned(oldTokenId, msg.sender);
    _burn(oldTokenId);
    //totalSupply--;
    delete membershipInfo[oldTokenId]; // nettoie
    
    // MINT NOUVEAU NIVEAU
    uint256 newTokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _safeMint(msg.sender, newTokenId);
    _setTokenURI(newTokenId, newURI);
    
    membershipInfo[newTokenId] = MembershipInfo({
        level: uint8(info.level + 1),
        autoEvolve: info.autoEvolve,
        startTimestamp: block.timestamp,
        expirationTimestamp: block.timestamp + levelDurations[info.level + 1],
        totalYears: info.totalYears
    });
    
    _tokenRoles[newTokenId] = _tokenRoles[oldTokenId];
    _mintTimestamps[newTokenId] = block.timestamp;
    _tokensByOwner[msg.sender].push(newTokenId);
    
    //totalSupply++; // net 0
    payable(relayer).transfer(DUST_ETH);
    
    emit NFTMinted(msg.sender, newTokenId);
    emit LevelEvolved(newTokenId, info.level + 1);
}





function mettreAJourPoints(address user, uint256 points) public {
    require(rewardPoints[user] + points >= 0, "Points cannot be negative"); // Eviter une mise à jour des points à un nombre négatif

    rewardPoints[user] += points; // Ajouter ou retirer les points pour l'adresse spécifiée
    emit RewardsAdded(user, points); // Ajouter l'événement de mise à jour des points
}



    function buyNFT(uint256 tokenId) public payable {
        require(_exists(tokenId), "Token does not exist");
        require(_tokenForSale[tokenId], "Token is not for sale");
        require(msg.value >= _tokenPrices[tokenId], "Not enough Ether sent");

        address currentOwner = ownerOf(tokenId);
        require(currentOwner != msg.sender, "You cannot buy your own token");

        uint256 ownerFee = (msg.value * 10) / 100; // 10% de frais pour l'association
        uint256 sellerAmount = msg.value - ownerFee;

        // Transfert du NFT à l'acheteur
        _transfer(currentOwner, msg.sender, tokenId);
        _tokensByOwner[msg.sender].push(tokenId); // Ajouter à la liste de l'utilisateur
        removeTokenFromOwner(currentOwner, tokenId);

        // Réinitialisation de l'adhésion
        _mintTimestamps[tokenId] = block.timestamp; // Reset ownership

        // Mise à jour de l'état du membre
        members[msg.sender] = Member({
            role: _tokenRoles[tokenId],
            exists: true,
            mintTimestamp: _mintTimestamps[tokenId],
            isForSale: false
        });

        rewardPoints[msg.sender] += pointsToAdd;

        // Transfert des fonds au vendeur et gestion des frais
        if (sellerAmount > 0) {
            payable(currentOwner).transfer(sellerAmount);
        }
        if (ownerFee > 0) {
            payable(owner()).transfer(ownerFee); // Transfert des frais à l'association
        }

        // Réinitialisation des données liées à la vente
        _tokenPrices[tokenId] = 0;
        _tokenForSale[tokenId] = false;

        // Émission de l'événement de vente
        emit NFTSold(tokenId, msg.sender, msg.value);
        emit NFTTransfer(currentOwner, msg.sender, tokenId); // Émettre ce nouvel événement
    }

    // Fonction auxiliaire pour retirer un jeton de la liste d'un propriétaire
    function removeTokenFromOwner(address owner, uint256 tokenId) private {
        uint256[] storage tokens = _tokensByOwner[owner];
        uint256 length = tokens.length;

        for (uint256 i = 0; i < length; i++) {
            if (tokens[i] == tokenId) {
                // Déplacer le dernier élément à la position de l'élément supprimé
                tokens[i] = tokens[length - 1];
                tokens.pop(); // Supprimer le dernier élément
                break; // Sortir de la boucle une fois que le jeton est trouvé et supprimé
            }
        }
    }

    // Fonction pour l'administrateur de retirer les fonds du contrat
    function withdraw() public onlyOwner {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No funds available for withdrawal");

        (bool success, ) = payable(owner()).call{value: contractBalance}("");
        require(success, "Withdrawal failed");

        // emit FundsWithdrawn(owner(), contractBalance); // Ne sert qu'aux admins, pas besoin d'un emit
    }

    // Fonction pour obtenir le nombre total de NFTs mintés
    function getTotalMinted() public view returns (uint256) {
        return _totalMinted;
    }

    // Fonction pour récupérer le nombre total de membres par rôle
    function getTotalMembersByRole(uint256 role) public view returns (uint256) {
        return membersByRole[role].length;
    }

    // Fonction pour récupérer les adresses des membres par rôle
    function getMembersByRole(uint256 role) public view returns (address[] memory) {
        return membersByRole[role];
    }

    // Fonction pour retirer un NFT de la vente
    function removeNFTFromSale(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "You do not own this token");
        _tokenForSale[tokenId] = false;
    }


    function getTokensByOwner(address owner) public view returns (uint256[] memory) {
        return _tokensByOwner[owner]; // Retourner les IDs directement
    }



    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }


}
