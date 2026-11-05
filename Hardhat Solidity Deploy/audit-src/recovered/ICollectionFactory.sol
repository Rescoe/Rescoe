// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface ICollectionFactory {
    function createDynamicCollection(
        string calldata name,
        string calldata collectionType,
        address user,
        uint256 collectionId
    ) external returns (address);
}
