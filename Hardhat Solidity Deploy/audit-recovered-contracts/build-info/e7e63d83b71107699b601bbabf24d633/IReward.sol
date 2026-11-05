// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IReward {
    function mettreAJourPoints(address user, uint256 points) external;
    
    function getUserInfo(address user) external returns (
        bool membershipValid,
        string memory name,
        string memory bio
    );
}
