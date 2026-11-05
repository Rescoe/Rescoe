// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../recovered/IReward.sol";

/**
 * Contrats d'attaque et mocks UTILISÉS UNIQUEMENT PAR LES TESTS D'AUDIT.
 * Ne jamais déployer en production. Écrits à la main (ne sont pas des sources récupérées).
 */

/// @dev Acteur "contrat" : peut appeler n'importe quelle cible comme un utilisateur et recevoir des NFT.
abstract contract Actor {
    function execute(address target, bytes calldata data, uint256 value)
        external
        payable
        returns (bool ok, bytes memory ret)
    {
        (ok, ret) = target.call{value: value}(data);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external virtual returns (bytes4) {
        return 0x150b7a02;
    }
}

/// @dev Refuse tout ETH reçu (DoS par destinataire de paiement).
contract RejectingReceiver is Actor {
    receive() external payable {
        revert("RejectingReceiver: no ETH");
    }
}

/// @dev Simule un wallet intelligent (ex. Safe) : receive() écrit en storage (> 2300 gas),
///      donc incompatible avec Address.transfer / send (stipend 2300).
contract StorageWritingReceiver is Actor {
    uint256 public received;

    receive() external payable {
        received += msg.value; // SSTORE : 5k-22k gas
    }
}

/// @dev Récepteur réentrant générique. Quand il reçoit de l'ETH (ou un NFT), il rappelle `target`
///      avec `payload` (jusqu'à `maxHits` fois) et enregistre le résultat SANS faire échouer l'appel externe.
contract ReentrantReceiver is Actor {
    address public target;
    bytes public payload;
    uint256 public callValue;
    bool public armed;
    uint256 public maxHits = 1;
    uint256 public hits;
    bool public lastOk;
    bytes public lastRet;
    uint256 public ethReceived;

    function arm(address t, bytes calldata p, uint256 v, uint256 _maxHits) external {
        target = t;
        payload = p;
        callValue = v;
        maxHits = _maxHits;
        hits = 0;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function _fire() internal {
        if (armed && hits < maxHits) {
            hits++;
            (lastOk, lastRet) = target.call{value: callValue}(payload);
        }
    }

    receive() external payable {
        ethReceived += msg.value;
        _fire();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external override returns (bytes4) {
        _fire();
        return 0x150b7a02;
    }
}

/// @dev Envoie de l'ETH de force via selfdestruct (pour tester la conservation des fonds).
contract ForceSend {
    constructor(address payable to) payable {
        selfdestruct(to);
    }
}

/// @dev Mock minimal de IReward : enregistre les points et permet de forcer la validité d'adhésion.
contract RewardMock is IReward {
    mapping(address => uint256) public points;
    mapping(address => bool) public valid;
    uint256 public calls;
    bool public revertOnUpdate;

    /// @dev Permet au mock de servir aussi d'IAdhesionContract (ResCoellectionManager lit rewardPoints()).
    function rewardPoints(address u) external view returns (uint256) {
        return points[u];
    }

    function setValid(address u, bool v) external {
        valid[u] = v;
    }

    function setRevertOnUpdate(bool r) external {
        revertOnUpdate = r;
    }

    function mettreAJourPoints(address user, uint256 p) external override {
        require(!revertOnUpdate, "RewardMock: reverted");
        calls++;
        points[user] += p;
    }

    function getUserInfo(address user) external view override returns (bool, string memory, string memory) {
        return (valid[user], "", "");
    }
}
