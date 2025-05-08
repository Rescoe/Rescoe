import React, { useState, useEffect } from 'react';
import { Box, Spinner, Text } from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import NFTCard from '../NFTCard';

interface Collection {
    id: string;
    name: string;
    imageUrl: string;
    mintContractAddress: string;
    creator: string; // Ajouté
}



interface FilteredCollectionsCarouselProps {
    creator: string; // Le créateur par lequel vous allez filtrer
    selectedCollectionId: string; // Si vous avez besoin de l'ID de la collection
}

const FilteredCollectionsCarousel: React.FC<FilteredCollectionsCarouselProps> = ({ creator, selectedCollectionId }) => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Connexion à la blockchain
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

    const fetchCollections = async (creator: string) => {
        setIsLoading(true);
        try {
            const total: number = await contract.getTotalCollectionsMinted();
            const collectionsPaginated: any[] = await contract.getCollectionsPaginated(0, total);

            const collectionsData = await Promise.all(
                collectionsPaginated.map(async (tuple: any) => {
                    const [id, name, collectionType, collectionCreator, collectionAddress, isActive, isFeatured] = tuple;

                    // Vérifiez que la collection type est "Art"
                    if (collectionType !== "Art") return null;

                    const uri: string = await contract.getCollectionURI(id);
                    const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
                    const metadata = await response.json();

                    return {
                        id: id.toString(),
                        name,
                        imageUrl: metadata.image,
                        mintContractAddress: collectionAddress,
                        creator: collectionCreator, // Enregistrez le créateur
                    };
                })
            );

            // Filtrer les collections par créateur
            const filteredCollections = collectionsData.filter(collection => collection?.creator.toLowerCase() === creator.toLowerCase());

            setCollections(filteredCollections.filter((collection) => collection !== null)); // Mise à jour des collections
        } catch (error) {
            console.error('Erreur lors de la récupération des collections :', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
      console.log(creator);

        if (creator) { // Utilisez directement le créateur passé en tant que prop
            fetchCollections(creator); // Appelez la fonction avec l'adresse du créateur
        }
    }, [creator]); // Dépendance pour appeler à chaque changement de créateur


/*
  <Box p={6}>
      {isLoading ? (
          <Spinner />
      ) : (
          <Box display="flex" overflowX="auto">
              {collections.length === 0 ? (
                  <Text>Aucune collection trouvée pour ce créateur.</Text>
              ) : (
                  collections.map((collection) => (
                      <NFTCard key={collection.id} /> // Affichez chaque collection  {/*collection={collection}/*}
                  ))
              )}
          </Box>
      )}
  </Box>
  */

    return (
      <Box p={6}>
      <Text>Aucune collection trouvée pour ce créateur.</Text>
      </Box>


    );
};

export default FilteredCollectionsCarousel;
