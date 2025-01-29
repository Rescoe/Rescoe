import { useEffect } from "react";
import { JsonRpcProvider, ethers } from 'ethers';
import { Contract } from 'ethers';

import ABI from '../ABI/ABIAdhesion.json';

const contractAddressAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;

const useNFTEventListener = (contractAddress, ABI, userAddress, fetchRolesAndImages) => {
  useEffect(() => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractAddress, ABI, provider);


    const handleTransfer = async (from, to, tokenId) => {
      if (to.toLowerCase() === userAddress.toLowerCase()) {
        // L'utilisateur a reçu un NFT
        await fetchRolesAndImages(userAddress); // Mettez à jour les rôles et images
      } else if (from.toLowerCase() === userAddress.toLowerCase()) {
        // L'utilisateur a vendu un NFT
        await fetchRolesAndImages(userAddress); // Mettez à jour également les données
      }
    };

    contract.on("Transfer", handleTransfer);

    return () => {
      contract.off("Transfer", handleTransfer);
    };
  }, [contractAddress, ABI, userAddress, fetchRolesAndImages]);
};
export default useNFTEventListener;
