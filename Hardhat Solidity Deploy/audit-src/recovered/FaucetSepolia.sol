// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ============================================================
 *                       FAUCET NOTICE
 * ============================================================
 *
 * PARAMÈTRES DU CONSTRUCTEUR :
 *
 * constructor(
 *     uint256 _dispenseAmount,       // Montant envoyé à chaque claim
 *     uint256 _cooldown,             // Cooldown entre deux claims (en secondes)
 *     uint256 _maxClaimsPerAddress,  // Nombre max de claims par adresse (0 = illimité)
 *     address _relayer               // Adresse autorisée à faire claimTo() (ou address(0))
 * )
 *
 * ============================================================
 *                    VALEURS QUE J'UTILISE
 * ============================================================
 *
 * 🔹 Montant distribué
 * ------------------------------------------------------------
 * 0.05 ETH = 50000000000000000
 *
 * Exemple :
 *     _dispenseAmount = 50000000000000000;
 *
 *
 * 🔹 Cooldown = temps d’attente
 * ------------------------------------------------------------
 * ↓ EN SECONDES ↓
 * 1 minute    = 60
 * 5 minutes   = 300
 * 1 heure     = 3600
 *
 * Exemple :
 *     _cooldown = 60; // 1 minute
 *
 *
 * 🔹 Max claims par adresse
 * ------------------------------------------------------------
 * 0 = illimité
 * N = nombre maximum de claims autorisés
 *
 * Exemple :
 *     _maxClaimsPerAddress = 0; // illimité
 *
 *
 * 🔹 Relayer
 * ------------------------------------------------------------
 * Adresse autorisée à faire claimTo() pour d’autres adresses.
 *
 * - Mettre une vraie adresse → active un relayer
 * - Mettre address(0) → aucun relayer
 *
 * Exemple :
 *     _relayer = 0x7711A95ba42b1B7e32A644c9be8fc70AD510C107 celui que j'ai crée 
 *
 *
 * ============================================================
 *                  RAPPEL DE FONCTIONNEMENT
 * ============================================================
 *
 * - Le cooldown est vérifié avec :
 *       block.timestamp >= lastClaimAt[user] + cooldown
 *
 * - Le montant est envoyé avec :
 *       user.call{value: dispenseAmount}("");
 *
 * - lastClaimAt et claimsCount sont mis à jour avant l’envoi.
 *
 * - Le contrat doit toujours être suffisamment alimenté.
 *
 * ============================================================
 *                           FIN NOTICE
 * ============================================================
 */

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Sepolia Faucet (ETH natif) avec relayer autorisé
contract SepoliaFaucet is ReentrancyGuard {
    /* ========== STATE ========== */
    address public owner;
    address public relayer; // ✅ adresse du relayer autorisé

    uint256 public dispenseAmount;
    uint256 public cooldown;
    uint256 public maxClaimsPerAddress; // 0 = illimité

    mapping(address => uint256) public lastClaimAt;
    mapping(address => uint256) public claimsCount;

    /* ========== EVENTS ========== */
    event Received(address indexed from, uint256 amount);
    event Claimed(address indexed user, uint256 amount, address indexed by);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event RelayerChanged(address indexed oldRelayer, address indexed newRelayer);

    /* ========== MODIFIERS ========== */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyRelayerOrOwner() {
        require(msg.sender == owner || msg.sender == relayer, "Not authorized");
        _;
    }

    /* ========== CONSTRUCTOR ========== */
    constructor(
        uint256 _dispenseAmount,
        uint256 _cooldown,
        uint256 _maxClaimsPerAddress,
        address _relayer
    ) {
        owner = msg.sender;
        relayer = _relayer;
        dispenseAmount = _dispenseAmount;
        cooldown = _cooldown;
        maxClaimsPerAddress = _maxClaimsPerAddress;
    }

    /* ========== RECEIVE / FALLBACK ========== */
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Received(msg.sender, msg.value);
    }

    /* ========== USER FUNCTIONS ========== */

    /// @notice Claim pour soi-même (classique)
    function claim() external nonReentrant {
        _processClaim(msg.sender, msg.sender);
    }

    /// @notice Claim au nom d'un autre utilisateur (pour relayer)
    function claimTo(address user) external onlyRelayerOrOwner nonReentrant {
        _processClaim(user, msg.sender);
    }

    function _processClaim(address user, address caller) internal {
        require(address(this).balance >= dispenseAmount, "Faucet: insufficient funds");

        uint256 last = lastClaimAt[user];
        require(block.timestamp >= last + cooldown, "Faucet: cooldown not finished");

        if (maxClaimsPerAddress != 0) {
            require(claimsCount[user] < maxClaimsPerAddress, "Faucet: max claims reached");
        }

        lastClaimAt[user] = block.timestamp;
        claimsCount[user] += 1;

        (bool sent, ) = user.call{value: dispenseAmount}("");
        require(sent, "Faucet: transfer failed");

        emit Claimed(user, dispenseAmount, caller);
    }

    /* ========== OWNER FUNCTIONS ========== */

    function setRelayer(address _newRelayer) external onlyOwner {
        emit RelayerChanged(relayer, _newRelayer);
        relayer = _newRelayer;
    }

    function withdraw(uint256 _amount) external onlyOwner nonReentrant {
        require(address(this).balance >= _amount, "Faucet: insufficient funds");
        (bool sent, ) = owner.call{value: _amount}("");
        require(sent, "Withdraw failed");
        emit Withdrawn(owner, _amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "Faucet: no funds");
        (bool sent, ) = owner.call{value: bal}("");
        require(sent, "Withdraw failed");
        emit Withdrawn(owner, bal);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    /* ========== VIEW HELPERS ========== */
    function cooldownRemaining(address _addr) external view returns (uint256) {
        uint256 last = lastClaimAt[_addr];
        if (block.timestamp >= last + cooldown) return 0;
        return (last + cooldown) - block.timestamp;
    }
}
