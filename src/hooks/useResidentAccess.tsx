"use client";
import { useAccount } from "wagmi";
import { useMemo } from "react";

export const RESIDENT_ADDRESSES = [
  "0x552C63E3B89ADf749A5C1bB66fE574dF9203FfB4", // Roubzi + ajoute les autres
  // ...
] as const;

export const useResidentAccess = (ownerAddress: string) => {
  const { address: connectedAddress } = useAccount();

  return useMemo(() => {
    const isResident = !!connectedAddress && RESIDENT_ADDRESSES.includes(connectedAddress.toLowerCase() as any);
    const isOwner = connectedAddress?.toLowerCase() === ownerAddress.toLowerCase();
    return { isResident, isOwner, canEdit: isResident && isOwner };
  }, [connectedAddress, ownerAddress]);
};
