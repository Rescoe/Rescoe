// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./mintArt.sol";
import "./ICollectionFactory.sol";

contract ArtFactory is ICollectionFactory {

    /* ------------------------------------------------------------------------
       EVENTS
    ------------------------------------------------------------------------ */

    event CollectionCreated(
        uint256 indexed collectionId,
        address indexed creator,
        address collection,
        string name,
        string collectionType
    );

    event CollectionConfigured(
        string name,
        uint256 maxSupply,
        address[] collaborators,
        uint256[] percents
    );

    event AdhesionContractUpdated(address oldAddress, address newAddress);

    /* ------------------------------------------------------------------------
       STORAGE
    ------------------------------------------------------------------------ */

    address public owner;
    address public adhesionContractAddress;
    address public associationAddr;

    address[] public collections;

    struct CollectionConfig {
        uint256 maxSupply;
        address[] collaborators;
        uint256[] percents;
        bool exists;
    }

    mapping(string => CollectionConfig) public collectionConfigs;
    string[] public allCollectionNames;

    /* ------------------------------------------------------------------------
       MODIFIERS
    ------------------------------------------------------------------------ */

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /* ------------------------------------------------------------------------
       CONSTRUCTOR
    ------------------------------------------------------------------------ */

    constructor(address _adhesion, address _association) {
        owner = msg.sender;
        adhesionContractAddress = _adhesion;
        associationAddr = _association;
    }

    /* ------------------------------------------------------------------------
       CONFIGURATION DE COLLECTIONS
    ------------------------------------------------------------------------ */

    function configureCollection(
        string calldata name,
        uint256 maxSupply,
        address[] calldata collaborators,
        uint256[] calldata percents
    ) external onlyOwner {
        require(maxSupply > 0, "Invalid maxSupply");
        require(collaborators.length == percents.length, "Length mismatch");

        uint256 sum;
        for (uint i; i < percents.length; i++) sum += percents[i];
        require(sum <= 90, "Allocation too high");

        collectionConfigs[name] = CollectionConfig({
            maxSupply: maxSupply,
            collaborators: collaborators,
            percents: percents,
            exists: true
        });

        allCollectionNames.push(name);

        emit CollectionConfigured(name, maxSupply, collaborators, percents);
    }

    /* ------------------------------------------------------------------------
       CRÉATION D'UNE COLLECTION
    ------------------------------------------------------------------------ */

    function createDynamicCollection(
        string calldata name,
        string calldata collectionType,
        address user,
        uint256 collectionId
    ) external override returns (address) {

        CollectionConfig memory cfg = collectionConfigs[name];


require(cfg.collaborators.length == cfg.percents.length, "Length mismatch before deploy");
uint256 totalPercent = 0;
for(uint i; i < cfg.percents.length; i++) totalPercent += cfg.percents[i];
require(totalPercent <= 100, "Total percent too high before deploy");
require(user != address(0), "User address cannot be zero");


        require(cfg.exists, "Collection not configured");

        string memory symbol = _generateSymbol(name);

        ArtNFT newCollection = new ArtNFT(
            user,
            name,
            symbol,
            collectionId,
            collectionType,
            adhesionContractAddress,
            associationAddr,
            100, // part association
            cfg.maxSupply,
            cfg.collaborators,
            cfg.percents
        );

        collections.push(address(newCollection));

        emit CollectionCreated(collectionId, user, address(newCollection), name, collectionType);

        return address(newCollection);
    }


    function getCollectionConfig(string calldata name) external view returns (
        uint256 maxSupply,
        address[] memory collaborators,
        uint256[] memory percents,
        bool exists
    ) {
        CollectionConfig memory config = collectionConfigs[name];
        require(config.exists, "Collection not configured");
        
        return (config.maxSupply, config.collaborators, config.percents, config.exists);
    }
    
    /* ------------------------------------------------------------------------
       UTILS
    ------------------------------------------------------------------------ */

    // --- 🔤 Génération du symbole ERC721 ---
    function _generateSymbol(string memory name) internal pure returns (string memory) {
        bytes memory b = bytes(name);
        if (b.length < 2) return "XX";
        return string(abi.encodePacked(b[0], b[1]));
    }

    function getCollections() external view returns (address[] memory) {
        return collections;
    }

    function getAllCollectionNames() external view returns (string[] memory) {
        return allCollectionNames;
    }

    /* ------------------------------------------------------------------------
       OWNER FUNCTIONS
    ------------------------------------------------------------------------ */

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function updateAdhesionContract(address newAddr) external onlyOwner {
        require(newAddr != address(0), "Zero address");
        address old = adhesionContractAddress;
        adhesionContractAddress = newAddr;
        emit AdhesionContractUpdated(old, newAddr);
    }
}
