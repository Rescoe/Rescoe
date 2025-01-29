// SelectInsect.tsx
import React, { useEffect, useState } from 'react';
import { Box, Button, Image, VStack } from '@chakra-ui/react';
import { useAuth } from '../../utils/authContext';
import { JsonRpcProvider } from 'ethers';
import { Contract } from 'ethers';
import ABI from '../ABI/ABIAdhesion.json';

const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;

const SelectInsect = ({ onSelect }) => {
  const { address } = useAuth();
  const [insects, setInsects] = useState([]);
  const [selectedInsect, setSelectedInsect] = useState(null);

  const fetchInsects = async () => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractAddress, ABI, provider);
    const tokenIds = await contract.getTokensByOwner(address);

    const fetchedInsects = await Promise.all(tokenIds.map(async (tokenId) => {
      try {
        const tokenURI = await contract.tokenURI(tokenId);
        const response = await  fetch(tokenURI);

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération de URI :');
        }

        const metadata = await response.json();
        return { id: tokenId, image: metadata.image };
      } catch (error) {
        console.error("Erreur lors de la récupération de l'insecte :" );
        return null; // Retournez null pour les insectes qui échouent
      }
    }));

    // Filtrer les insectes nulls
    const validInsects = fetchedInsects.filter(insect => insect !== null);
    setInsects(validInsects);
  };


  useEffect(() => {
    if (address) {
      fetchInsects();
    }
  }, [address]);

  const handleInsectSelect = (insect) => {
      setSelectedInsect(insect);
      onSelect(insect); // Envoie l'objet complet
      localStorage.setItem('savedInsect', JSON.stringify(insect)); // Optionnel: Si vous voulez aussi le stocker ici
  };

  return (
    <VStack spacing={4}>
      {insects.map((insect) => (
        <Box key={insect.id} display="flex" alignItems="center">
          <Image src={insect.image} alt={`Insecte ${insect.id}`} boxSize="45px" />
          <Button onClick={() => handleInsectSelect(insect.image)} variant="outline" ml={2}>
            Sélectionner
          </Button>
        </Box>
      ))}
    </VStack>
  );
};

export default SelectInsect;
