import React, { useState, useEffect } from 'react';
import { Box, Spinner, Text, Heading} from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import CollectionCard from '../CollectionCard'; // Importez votre CollectionCard

interface Collection {
    id: string;
    name: string;
    imageUrl: string;
    mintContractAddress: string;
    creator: string; // Adresse du créateur
}

interface FilteredCollectionsCarouselProps {
    creator: string; // L'adresse du créateur
    selectedCollectionId: string;
    type: string; // Nouveau paramètre pour spécifier le type de collection
}

const FilteredCollectionsCarousel: React.FC<FilteredCollectionsCarouselProps> = ({ creator, selectedCollectionId, type }) => {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

    const fetchCollections = async () => {
        setIsLoading(true);
        try {
            const total: bigint = await contract.getTotalCollectionsMinted();
            const collectionsData = await Promise.all(
                Array.from({ length: Number(total) }, async (_, index) => {
                    try {
                        const collectionDetails = await contract.getCollection(index);
                        const [id, name, collectionType, collectionCreator, collectionAddress, isActive, isFeatured] = collectionDetails;

                        // Vérifiez si le type de collection correspond à celui demandé
                        if (type && collectionType !== type) return null;

                        const uri: string = await contract.getCollectionURI(id);
                        const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
                        const metadata = await response.json();

                        return {
                            id: id.toString(),
                            name,
                            imageUrl: metadata.image,
                            mintContractAddress: collectionAddress,
                            creator: collectionCreator,
                        };
                    } catch (innerError) {
                        console.error(`Erreur lors de la récupération de la collection ${index}:`, innerError);
                        return null;
                    }
                })
            );

            // Filtrer uniquement celles qui ne sont pas nulles
            const filteredCollections = collectionsData.filter((collection) => collection !== null);
            const userCollections = filteredCollections.filter(collection =>
                collection.creator.toLowerCase() === creator.toLowerCase()
            );

            setCollections(userCollections);
        } catch (error) {
            console.error('Erreur lors de la récupération des collections :', error);
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        if (creator) {
            fetchCollections();
        }
    }, [creator]);



    return (
        <Box p={6}>

            {isLoading ? (
                <Spinner />
            ) : (
                <Box display="flex" overflowX="auto">
                    {collections.length === 0 ? (
                        <Text>Aucune collection trouvée pour cet artiste.</Text>
                    ) : (

                        collections.map((collection) => (
                          <CollectionCard key={collection.id} collection={collection} type={type} />
                        ))
                    )}
                </Box>
            )}
        </Box>
    );
};

export default FilteredCollectionsCarousel;
