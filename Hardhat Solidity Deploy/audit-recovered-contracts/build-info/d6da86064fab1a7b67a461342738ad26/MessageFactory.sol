// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./MessageEditions.sol";
import "./ICollectionFactory.sol";

contract MessageFactory is ICollectionFactory {
    event CollectionCreated(
        uint256 indexed collectionId,
        address indexed creator,
        address collection,
        string name,
        string collectionType
    );

    event SalonConfigured(string salonName, bool requiresMembership);
    event AdhesionContractUpdated(address oldAddress, address newAddress);
    event SalonConfigured(string salonName, bool requiresMembership, address royaltyAddress);

    address public owner;
    address public adhesionContractAddress;

    struct SalonConfig {
        string salonName;
        bool requiresMembership;
        address royaltyAddress; // Ajout de l'adresse de royalties

        bool exists;
    }

    mapping(string => SalonConfig) public salonConfigs;
    string[] public allSalonNames;

    address[] public collections;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not admin");
        _;
    }

    constructor(address _adhesionContractAddress) {
        owner = msg.sender;
        adhesionContractAddress = _adhesionContractAddress;
    }

    // --- 🧩 Configuration d’un salon avant déploiement ---
    function configureSalon(string calldata salonName, bool requiresMembership, address royaltyAddress) external onlyOwner {
        salonConfigs[salonName] = SalonConfig({
            salonName: salonName,
            requiresMembership: requiresMembership,
            royaltyAddress: royaltyAddress, // Initialiser l'adresse de royalties
            exists: true
        });
        allSalonNames.push(salonName);
        emit SalonConfigured(salonName, requiresMembership, royaltyAddress);
    }

    // --- 🏗️ Création d'une collection (signature inchangée) ---
    function createDynamicCollection(
        string calldata name,
        string calldata collectionType,
        address user,
        uint256 collectionId
    ) external override returns (address) {
        require(salonConfigs[name].exists, "Salon not configured");
        SalonConfig memory cfg = salonConfigs[name];

        string memory symbol = _generateSymbol(name);

        MessageEditions newCollection = new MessageEditions(
            user,
            name,
            symbol,
            collectionId,
            collectionType,
            adhesionContractAddress,
            cfg.salonName,
            cfg.requiresMembership,
            cfg.royaltyAddress // Passer l'adresse de royalties

        );

        collections.push(address(newCollection));

        emit CollectionCreated(collectionId, user, address(newCollection), name, collectionType);

        return address(newCollection);
    }

    // --- 🛠️ Changer l’adresse du contrat d’adhésion ---
    function updateAdhesionContract(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Invalid address");
        address old = adhesionContractAddress;
        adhesionContractAddress = newAddress;
        emit AdhesionContractUpdated(old, newAddress);
    }

    // --- 🔤 Génération du symbole ERC721 ---
    function _generateSymbol(string memory name) internal pure returns (string memory) {
        bytes memory b = bytes(name);
        if (b.length < 2) return "XX";
        return string(abi.encodePacked(b[0], b[1]));
    }

    // --- 📜 Lecture des salons disponibles ---
    function getAllSalons() external view returns (string[] memory) {
        return allSalonNames;
    }

    // --- 👑 Transfert d’ownership ---
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
