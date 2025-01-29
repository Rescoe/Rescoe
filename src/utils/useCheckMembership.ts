// src/hooks/useCheckMembership.ts
import { useEffect, useState } from 'react';
import { useAccount, useContractRead } from 'wagmi';
import { Contract, utils } from 'ethers';

const ERC721_ABI = [
  // ABI minimum pour le ERC721, inclut la méthode balanceOf
  "function balanceOf(address owner) view returns (uint256)"
];

const useCheckMembership = (contractAddress: string) => {
  const { address } = useAccount();
  const [isMember, setIsMember] = useState(false);

  const { data, isLoading, isError } = useContractRead({
    address: contractAddress,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address, // N'exécute que si l'adresse est disponible
  });

  useEffect(() => {
    if (!isLoading && !isError && data) {
      // Si le solde est supérieur à 0, l'utilisateur est membre
      setIsMember(data.gt(0)); // data est un BigNumber
    }
  }, [data, isLoading, isError]);

  return { isMember };
};

export default useCheckMembership;
