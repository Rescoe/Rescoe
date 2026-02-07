"use client";
import { useAuth } from '@/utils/authContext';
import { useMemo } from "react";

export const RESIDENT_ADDRESSES = [
  "0x552C63E3B89ADf749A5C1bB66fE574dF9203FfB4",
  // ...
].map(a => a.toLowerCase());

export const useResidentAccess = (ownerAddress?: string) => {
  const { address: connectedAddress } = useAuth();

  return useMemo(() => {
    if (!connectedAddress) {
      return {
        isResident: false,
        isOwner: false,
        canEdit: false,
      };
    }

    const addr = connectedAddress.toLowerCase();
    const owner = ownerAddress?.toLowerCase();

    const isResident = RESIDENT_ADDRESSES.includes(addr);
    const isOwner = !!owner && addr === owner;

    return {
      isResident,
      isOwner,
      canEdit: isResident && isOwner,
    };
  }, [connectedAddress, ownerAddress]);
};
