import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Text } from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import { useRouter } from 'next/router';
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';
import ABI from '../../../ABI/HaikuEditions.json';

import TextCard from '../TextCard';



const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

const PoetryGallery = () => {
  const [collections, setCollections] = useState([]);
  const [poems, setPoems] = useState([]);  // Pour stocker les poèmes
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  // Récupérer les collections de poésie (comme avant)
  const fetchPoetryCollections = async () => {
    setIsLoading(true);
    try {
      const total = await contract.getTotalCollectionsMinted();
      const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

      const collectionsData = await Promise.all(
        collectionsPaginated.map(async (tuple) => {
          const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;

          // Filtrer uniquement les collections de type "poésie"
          if (collectionType !== 'Poesie') {
            return null;
          }

          const uri = await contract.getCollectionURI(id);
          const mintContractAddress = associatedAddresses;

          const cachedMetadata = localStorage.getItem(uri);
          if (cachedMetadata) {
            const metadata = JSON.parse(cachedMetadata);
            return {
              id: id.toString(),
              name: name,
              imageUrl: metadata.image,
              mintContractAddress, // Ajoute l'adresse du contrat de mint
              isFeatured, // Ajoute isFeatured
            };
          }

          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          const metadata = await response.json();
          localStorage.setItem(uri, JSON.stringify(metadata));
          return {
            id: id.toString(),
            name: name,
            imageUrl: metadata.image,
            mintContractAddress, // Ajoute l'adresse du contrat de mint
            isFeatured, // Ajoute isFeatured
          };
        })
      );

      const sortedCollections = collectionsData.filter(c => c !== null).sort((a, b) => b.isFeatured - a.isFeatured);
      setCollections(sortedCollections);
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :' );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPoems = async (collectionId, associatedAddress) => {
    setIsLoading(true);
    try {
      // Créer une instance du contrat à partir de l'adresse associée
      const collectionContract = new Contract(associatedAddress, ABI, provider);

      // Récupérer le nombre total de haikus (NFTs uniques)
      const uniqueTokenCount = await collectionContract.getUniqueNFTCount();
      const numberuniqueTokenCount = Number(uniqueTokenCount);

      // Créer un tableau d'ID de tokens de 1 à uniqueTokenCount
      const tokenIds = Array.from({ length: numberuniqueTokenCount }, (_, i) => i + 1);

      // Récupérer les informations de chaque haiku
      const poemsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          // Récupérer le texte du haiku depuis le contrat
          const haikuText = await collectionContract.getHaiku(tokenId);

          // Récupérer l'adresse du créateur et le nombre d'éditions
          const creatorAddress = await collectionContract.getCreator(tokenId);
          const totalEditions = await collectionContract.getTotalSupply(tokenId);

          // Récupérer le prix du haiku depuis le contrat
          const price = await collectionContract.getSalePrice(tokenId); // Remplacez par la fonction correcte
          return {
            tokenId: tokenId.toString(),
            poemText: haikuText, // Texte du haiku
            creatorAddress: creatorAddress, // Adresse du créateur
            totalEditions: totalEditions.toString(), // Nombre total d'éditions
            mintContractAddress: associatedAddress, // Adresse du contrat
            price: price.toString(), // Ajout du prix
          };
        })
      );

      // Mettre à jour l'état avec les données des poèmes
      setPoems(poemsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des poèmes :' );
      alert('Une erreur est survenue lors de la récupération des poèmes.');
    } finally {
      setIsLoading(false);
    }
  };



  // Gestion de clic sur une collection
  const handleCollectionClick = (collectionId, associatedAddress) => {
    fetchPoems(collectionId, associatedAddress);
  };

  useEffect(() => {
    fetchPoetryCollections();
  }, []);

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie de Poésie</Heading>
      {isLoading ? (
        <Spinner />
      ) : (
        <Grid templateColumns="repeat(3, 1fr)" gap={6}>
          {collections.length === 0 ? (
            <Text>Aucune collection de poésie trouvée.</Text>
          ) : (
            collections.map((collection) => (
              <Box
                key={collection.id}
                borderWidth="1px"
                borderRadius="lg"
                p={4}
                cursor="pointer"
                onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
              >
                {collection.imageUrl && (
                  <Box width="100%" height="150px" overflow="hidden" borderRadius="md">
                    <img
                      src={collection.imageUrl}
                      alt={collection.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </Box>
                )}
                <Text>{collection.name}</Text>
              </Box>
            ))
          )}
        </Grid>
      )}

      {poems.length > 0 && (
        <Box mt={8}>
          <Heading size="md" mb={4}>Poèmes</Heading>
          <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6} justifyItems="center">
  {poems.map((poem) => (
    <Box key={poem.tokenId} width="100%">
      <TextCard nft={poem} /> {/* Passer le poème comme prop 'nft' */}
    </Box>
  ))}
</Grid>

        </Box>
      )}
    </Box>
  );
};

export default PoetryGallery;
