//Code Insect Selector
import React, { useEffect, useState } from 'react';
import { Box, Button, Image, VStack } from '@chakra-ui/react';
import { useAuth } from '../../utils/authContext';
import { JsonRpcProvider, Contract } from 'ethers';
import ABI from '../ABI/ABIAdhesion.json';

import { BigNumberish } from 'ethers';


const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;


//Ce code fonctionne sur mobile chrome

const SelectInsect = ({ onSelect }: { onSelect: (insect: Insect) => void }) => {
  const { address } = useAuth();
  const [insects, setInsects] = useState<Insect[]>([]);
  const [selectedInsect, setSelectedInsect] = useState<Insect | null>(null);


  const fetchInsects = async () => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

    if (!contractAddress) {
      console.error("L'adresse du contrat n'est pas définie.");
      return;
    }

    const contract = new Contract(contractAddress, ABI, provider);

    const tokenIds: BigNumberish[] = await contract.getTokensByOwner(address);

    const fetchedInsects = await Promise.all(
      tokenIds.map(async (tokenId: BigNumberish) => {
        try {
          const tokenURI = await contract.tokenURI(tokenId);
          const response = await fetch(tokenURI);
          console.log("Token URI:", tokenURI);

          if (!response.ok) {
            throw new Error('Erreur lors de la récupération de URI');
          }

          const metadata = await response.json();
          return { id: Number(tokenId), image: metadata.image }; // Utilisation de BigNumber.from()
        } catch (error) {
          console.error("Erreur lors de la récupération de l'insecte :", error);
          return null;
        }
      })
    );

    setInsects(fetchedInsects.filter((insect): insect is Insect => insect !== null));
  };


  useEffect(() => {
    if (address) {
      fetchInsects();
    }
  }, [address]);

  const handleInsectSelect = (insect: Insect) => {
    setSelectedInsect(insect);
    onSelect(insect);
    localStorage.setItem('savedInsect', JSON.stringify(insect));
  };

  return (
    <VStack spacing={4}>
      {insects.map((insect) => (
        <Box key={insect.id} display="flex" alignItems="center">
          <Image src={insect.image} alt={`Insecte ${insect.id}`} boxSize="45px" />
          <Button onClick={() => handleInsectSelect(insect)} variant="outline" ml={2}>
            Sélectionner
          </Button>
        </Box>
      ))}
    </VStack>
  );
};

export type Insect = {
  id: number;
  name: string;
  image: string;
};


export default SelectInsect;
