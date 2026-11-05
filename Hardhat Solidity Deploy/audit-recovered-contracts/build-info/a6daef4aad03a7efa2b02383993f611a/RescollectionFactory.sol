// SPDX-License-Identifier: MIT
//0xcA3f2147ec2A1BC422b2a3c2C54DA26EcB651776
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IAdhesionContract {
    function getUserInfo(address user) external view returns (
        bool membershipValid,
        string memory name,
        string memory bio
    );
    function rewardPoints(address user) external view returns (uint256);
}

interface ICollectionFactory {
    function createDynamicCollection(
        string memory name,
        string memory collectionType,
        address creator,
        uint256 collectionId
    ) external returns (address);
}



contract ResCoellectionManager is ERC721URIStorage, Ownable {
struct Collection {
    uint256 id;
    string name;
    string collectionType;
    address creator;
    address collectionAddress; // Adresse du contrat de collection déployé
    bool isActive;
    bool isFeatured; // Indique si la collection est mise en avant
}


    mapping(uint256 => Collection) public collections;
    mapping(string => bool) public allowedCollectionTypes;

    address public admin;


    // Variables

    using Counters for Counters.Counter;

    uint256 private _totalMinted;
    uint256 private _totalCollectionMinted;  // Compteur global pour les collections créées (toutes collections confondues)



    mapping(address => address[]) public _userCollectionsAddress;



    mapping(address => uint256) private _userCollections;
    mapping(address => uint256[]) private _userCollectionIds;

    mapping(uint256 => string) private _collections;


    // Mapping des URI pour chaque collection
mapping(uint256 => string) private _collectionURIs;

    address public factoryContractAddress;
    address[] public adhesionContracts;
    uint256 public adhesionContractCount;
    IAdhesionContract public adhesionContract;

event CollectionCreated(
    address indexed user,
    uint256 indexed collectionId,
    string name,
    string collectionType,
    address collectionAddress // Adresse du contrat de collection
);


        // Événements

    event CollectionUpdated(uint256 indexed collectionId, string newName, string newUri);
    event CollectionFeatured(uint256 indexed collectionId, bool isFeatured);


    event CollectionTypeAdded(string collectionType);
    event CollectionTypeRemoved(string collectionType);

/*
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
*/
    constructor(address initialOwner, address  _factoryContractAddress) ERC721("Collections & Recueils", "Resco-llections") Ownable(initialOwner) {
        admin = msg.sender;
        allowedCollectionTypes["Art"] = true;
        allowedCollectionTypes["Poesie"] = true;
        _totalCollectionMinted = 0;
        factoryContractAddress = _factoryContractAddress; // Initialise l'adresse de la factory

    }

        function addAdhesionContract(address _adhesionContract) public onlyOwner {
        adhesionContracts.push(_adhesionContract);
        adhesionContractCount++;
    }

        // Fonction pour mettre à jour l'adresse de la factory
    function updateFactoryAddress(address newFactoryAddress) external {
        require(msg.sender == admin, "Seul l'admin peut changer l'adresse de la factory");
        factoryContractAddress = newFactoryAddress;
    }

    // Modifier les fonctions pour inclure les événements
function addCollectionType(string memory collectionType) public onlyOwner { //OnlyAdmin public onlyAdmin {
    require(!allowedCollectionTypes[collectionType], "Collection type already exists");
    allowedCollectionTypes[collectionType] = true;
    emit CollectionTypeAdded(collectionType);
}

function removeCollectionType(string memory collectionType) public onlyOwner { //OnlyAdmin public onlyAdmin {
    require(allowedCollectionTypes[collectionType], "Collection type does not exist");
    allowedCollectionTypes[collectionType] = false;
    emit CollectionTypeRemoved(collectionType);
}

    function checkAdhesionToCreate(address user) internal view returns (bool) {
        for (uint256 i = 0; i < adhesionContractCount; i++) {
            IAdhesionContract contractAddress = IAdhesionContract(adhesionContracts[i]);
            (bool membershipValid, , ) = contractAddress.getUserInfo(user);
            if (membershipValid) {
                return true; // L'utilisateur est adhérent
            }
        }
        return false; // Pas d'adhésion valide
    }

    function checkUserAdhesionNumber(address user) public view returns (uint256) {
        uint256 totalRewardPoints = 0;
        for (uint256 i = 0; i < adhesionContractCount; i++) {
            IAdhesionContract contractAddress = IAdhesionContract(adhesionContracts[i]);
            totalRewardPoints += contractAddress.rewardPoints(user);
        }
        return totalRewardPoints/5;
    }

  function createCollection(
    string memory name,
    string memory uri,
    string memory collectionType
) public {

    address user = msg.sender;  // L'adresse de l'utilisateur qui veut créer la collection

    bool AdhesionValide = checkAdhesionToCreate(msg.sender);

    require(AdhesionValide, "User is no more adherent");

    // Vérifie combien de jetons d'adhésion l'utilisateur possède
    uint256 userAdhesionBalance = checkUserAdhesionNumber(msg.sender);

    require(allowedCollectionTypes[collectionType], "Invalid collection type");

    // Vérifie combien de collections l'utilisateur possède déjà
    uint256 userCollectionCount = _userCollections[msg.sender];

    // Si l'utilisateur possède plus de jetons d'adhésion que de collections créées, il peut créer une collection
    require(userAdhesionBalance > userCollectionCount, "User must have more adhesion tokens than collections");

    // Création de l'ID de la collection
    uint256 collectionId = _totalCollectionMinted;

    // Appel à la factory dynamique pour déployer le contrat de collection
    address factoryAddress = factoryContractAddress; // Adresse de la factory globale
    address newCollectionAddress = ICollectionFactory(factoryAddress).createDynamicCollection(
        name,
        collectionType,
        user,
        collectionId
     );


    // Mise à jour des données de la collection
    collections[collectionId] = Collection({
        id: collectionId,
        name: name,
        collectionType: collectionType,
        creator: msg.sender,
        collectionAddress: newCollectionAddress, // Adresse du contrat de collection déployé
        isActive: true,
        isFeatured: false
    });

    // Mise à jour des mappings
    _userCollections[msg.sender]++;  // Incrémente le compteur de collections de l'utilisateur
    _userCollectionIds[msg.sender].push(collectionId); // Associe cet ID global à l'utilisateur
    _userCollectionsAddress[msg.sender].push(newCollectionAddress);

    _collections[collectionId] = name;  // Associe le nom de la collection à l'ID
    _collectionURIs[collectionId] = uri; // Associe l'URI à la collection

    // Incrémentation du compteur global des collections
    _totalCollectionMinted++;

    // Émet l'événement pour signaler la création de la collection
    emit CollectionCreated(msg.sender, collectionId, name, collectionType, newCollectionAddress);
}



// Fonction de création de collection pour l'administrateur avec un URI
function createAdminCollection(
    address user,
    string memory collectionName,
    string memory uri,
    string memory collectionType
) public onlyOwner {
    require(allowedCollectionTypes[collectionType], "Invalid collection type");

    // Création de l'ID de la collection
    uint256 collectionId = _totalCollectionMinted;

    // Appel à la factory dynamique pour déployer le contrat de collection
    address newCollectionAddress = ICollectionFactory(factoryContractAddress).createDynamicCollection(
        collectionName,    // Nom de la collection
        collectionType,    // Type de collection (ERC721, ERC1155, etc.)
        user,
        collectionId               // L'utilisateur propriétaire du contrat
    );

    // Mise à jour des données de la collection dans le mapping
    collections[collectionId] = Collection({
        id: collectionId,
        name: collectionName,
        collectionType: collectionType,
        creator: user,
        collectionAddress: newCollectionAddress, // Adresse du contrat de collection déployé
        isActive: true,
        isFeatured: false
    });

    // Mise à jour des mappings pour l'utilisateur
    _userCollections[user]++;  // Incrémente le compteur de collections pour l'utilisateur
    _userCollectionIds[user].push(collectionId); // Associe l'ID de la collection à l'utilisateur

    // Ajout du nom et de l'URI dans les mappings
    _collections[collectionId] = collectionName; // Associe le nom de la collection à l'ID
    _collectionURIs[collectionId] = uri; // Associe l'URI à la collection

    // Incrémentation du compteur global des collections
    _totalCollectionMinted++;

    // Émet l'événement pour signaler la création de la collection
    emit CollectionCreated(user, collectionId, collectionName, collectionType, newCollectionAddress);
}


    // Fonction pour mettre à jour une collection
    function updateCollection(uint256 collectionId, string memory newName, string memory newUri) public {
        require(msg.sender == collections[collectionId].creator || msg.sender == admin, "Only the creator or admin can update the collection");
        collections[collectionId].name = newName;
        // Si l'URI doit être mis à jour, il faut mettre à jour une structure distincte ici
        _collectionURIs[collectionId] = newUri;

        emit CollectionUpdated(collectionId, newName, newUri);
    }

    // Fonction pour récupérer l'URI d'une collection
function getCollectionURI(uint256 collectionId) public view returns (string memory) {
    return _collectionURIs[collectionId];
}


    // Mettre une collection en avant
    function featureCollection(uint256 collectionId, bool isFeatured) public onlyOwner { //OnlyAdmin public onlyAdmin {
        collections[collectionId].isFeatured = isFeatured;
        emit CollectionFeatured(collectionId, isFeatured);
    }

    // Fonction pour obtenir les collections par utilisateur
    function getCollectionsByUser(address user) public view returns (Collection[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _totalCollectionMinted; i++) {
            if (collections[i].creator == user) {
                count++;
            }
        }

        Collection[] memory userCollections = new Collection[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _totalCollectionMinted; i++) {
            if (collections[i].creator == user) {
                userCollections[index] = collections[i];
                index++;
            }
        }

        return userCollections;
    }

    // Fonction pour récupérer des collections d'un type spécifique entre deux IDs
    function getCollectionsByType(string memory collectionType, uint256 startId, uint256 endId) public view returns (Collection[] memory) {
        require(allowedCollectionTypes[collectionType], "Invalid collection type");
        require(startId < endId && endId < _totalCollectionMinted, "ID range is invalid");

        uint256 count = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (keccak256(abi.encodePacked(collections[i].collectionType)) == keccak256(abi.encodePacked(collectionType))) {
                count++;
            }
        }

        Collection[] memory filteredCollections = new Collection[](count);
        uint256 index = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (keccak256(abi.encodePacked(collections[i].collectionType)) == keccak256(abi.encodePacked(collectionType))) {
                filteredCollections[index] = collections[i];
                index++;
            }
        }

        return filteredCollections;
    }

    // Fonction de pagination pour récupérer les collections
    function getCollectionsPaginated(uint256 startId, uint256 limit) public view returns (Collection[] memory) {
        uint256 total = _totalCollectionMinted;
        require(startId < total, "Start ID out of range");

        uint256 endId = startId + limit > total ? total : startId + limit;
        Collection[] memory paginatedCollections = new Collection[](endId - startId);

        for (uint256 i = startId; i < endId; i++) {
            paginatedCollections[i - startId] = collections[i];
        }

        return paginatedCollections;
    }


function getCollection(uint256 collectionId) external view returns (
    uint256 id,
    string memory name,
    string memory collectionType,
    address creator,
    address collectionAddress,  // Remplace artworks par collectionAddress
    bool isActive,
    bool isFeatured
) {
    Collection storage collection = collections[collectionId];
    return (
        collection.id,
        collection.name,
        collection.collectionType,
        collection.creator,
        collection.collectionAddress,  // Récupère l'adresse du contrat de collection
        collection.isActive,
        collection.isFeatured
    );
}

// Fonction pour obtenir le nombre total de nft minté et de collections créées (compteur global)
    function getTotalCollectionsMinted() public view returns (uint256) {
        return (_totalCollectionMinted);
    }

    // Fonction pour savoir combien de collections l'utilisateur peut encore créer
function getRemainingCollections(address user) public view returns (uint256) {
    uint256 userAdhesionBalance = checkUserAdhesionNumber(user);
    uint256 userCollectionCount = _userCollections[user];

    // Calcul du nombre de collections restantes que l'utilisateur peut créer
    if (userAdhesionBalance > userCollectionCount) {
        return userAdhesionBalance - userCollectionCount;
    } else {
        return 0;  // L'utilisateur ne peut pas créer plus de collections
    }
}



    // Fonction pour obtenir le nombre de collections créées par une adresse
function getNumberOfCollectionsByUser(address user) public view returns (uint256) {
    return _userCollections[user];
}


function setCollectionActiveStatus(uint256 collectionId, bool status) public {
    require(msg.sender == owner() || msg.sender == admin, "Not authorized");
    require(collections[collectionId].collectionAddress != address(0), "Collection does not exist");

    collections[collectionId].isActive = status;
}





}
