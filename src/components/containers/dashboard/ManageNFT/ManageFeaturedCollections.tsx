// components/ManageNFT/ManageFeaturedCollections.tsx
import React, { useState } from 'react';
import Web3 from 'web3';
import ABICollection from '@/components/ABI/ABI_Collections.json';
import {
    Box, Button, Heading, Text, Input, VStack, HStack, Divider, FormControl, FormLabel
} from '@chakra-ui/react';

interface ManageFeaturedCollectionsProps {
    web3: Web3 | null;
    account: string;
    contratRescollection: string;
    searchId: string;
    setSearchId: (id: string) => void;
    searchedCollection: any | null;
    setSearchedCollection: (collection: any | null) => void;
    featuredCollections: number[];
    setFeaturedCollections: (collections: number[]) => void;
    fetchCollectionById: (id: string) => Promise<any>;
    fetchFeaturedCollections: () => Promise<void>;
}

const ManageFeaturedCollections: React.FC<ManageFeaturedCollectionsProps> = ({
    web3,
    account,
    contratRescollection,
    searchId,
    setSearchId,
    searchedCollection,
    setSearchedCollection,
    featuredCollections,
    setFeaturedCollections,
    fetchCollectionById,
    fetchFeaturedCollections,
}) => {

    const [collectionId, setCollectionId] = useState<string>('');

    const handleSearch = async () => {
        const id = parseInt(searchId);
        if (isNaN(id)) return alert("ID invalide");

        const result = await fetchCollectionById(id.toString());
        if (result) {
            setSearchedCollection(result);
        } else {
            alert("Collection non trouvée.");
            setSearchedCollection(null);
        }
    };

    const handleFeature = async (isFeatured: boolean) => {
        if (!collectionId) return alert('Veuillez renseigner un ID de collection.');
        if (web3 && account) {
            try {
                const contract = new web3.eth.Contract(ABICollection as any, contratRescollection);

                const gasEstimate = await contract.methods.featureCollection(
                    parseInt(collectionId),
                    isFeatured
                ).estimateGas({ from: account });

                const gasPrice = await web3.eth.getGasPrice();

                await contract.methods.featureCollection(
                    parseInt(collectionId),
                    isFeatured
                ).send({
                    from: account,
                    gas: Math.floor(Number(gasEstimate) * 1).toString(),
                    gasPrice: gasPrice.toString()
                });

                alert(`La collection ${collectionId} a été ${isFeatured ? 'mise en avant' : 'retirée des mises en avant'}.`);
                setCollectionId('');
                await fetchFeaturedCollections();
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la mise en avant :', error);
                alert('Erreur lors de la mise à jour de la collection.');
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    return (
        <VStack spacing={8} align="stretch" maxW="800px" mx="auto" py={6}>
            <Box>
                <Heading size="md" mb={4}>
                    Rechercher une collection par ID
                </Heading>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSearch();
                    }}
                >
                    <HStack>
                        <Input
                            autoFocus
                            placeholder="ID de la collection"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                        <Button type="submit" colorScheme="blue">
                            Rechercher
                        </Button>
                    </HStack>
                </form>
            </Box>

            {searchedCollection && (
                <Box
                    borderWidth="1px"
                    borderRadius="lg"
                    p={4}
                    boxShadow="sm"
                    bg="gray.800"
                >
                    <HStack align="start" spacing={6}>
                        <Box flex="1">
                            <Text><strong>Type :</strong> {searchedCollection.type}</Text>
                            {searchedCollection.name && (
                                <Text><strong>Nom :</strong> {searchedCollection.name}</Text>
                            )}
                            <Text>
                                <strong>Featured :</strong>{' '}
                                {searchedCollection.isFeatured ? '✅ Oui' : '❌ Non'}
                            </Text>
                            <Button
                                mt={3}
                                size="sm"
                                colorScheme="teal"
                                onClick={() => setCollectionId(searchedCollection.id.toString())}
                            >
                                Utiliser cet ID
                            </Button>
                        </Box>

                        {searchedCollection.image && (
                            <Box>
                                <img
                                    src={searchedCollection.image}
                                    alt="Collection"
                                    style={{
                                        width: '160px',
                                        borderRadius: '8px',
                                        objectFit: 'cover',
                                    }}
                                />
                            </Box>
                        )}
                    </HStack>
                </Box>
            )}

            <Divider />

            <Box>
                <Heading size="md" mb={2}>Collections mises en avant</Heading>
                {featuredCollections.length === 0 ? (
                    <Text>Aucune collection n'est mise en avant pour le moment.</Text>
                ) : (
                    <Box as="ul" pl={4}>
                        {featuredCollections.map((id) => (
                            <Text key={id}>Collection {id}</Text>
                        ))}
                    </Box>
                )}
            </Box>

            <Divider />

            <Box>
                <Heading size="md" mb={2}>Mettre une collection en avant</Heading>
                <VStack align="stretch" spacing={3}>
                    <FormControl>
                        <FormLabel>ID de la collection</FormLabel>
                        <Input
                            placeholder="ID de la collection"
                            value={collectionId}
                            onChange={(e) => setCollectionId(e.target.value)}
                        />
                    </FormControl>
                    <HStack>
                        <Button colorScheme="green" onClick={() => handleFeature(true)}>
                            Mettre en avant
                        </Button>
                        <Button colorScheme="red" onClick={() => handleFeature(false)}>
                            Retirer
                        </Button>
                    </HStack>
                </VStack>
            </Box>
        </VStack>
    );
};

export default ManageFeaturedCollections;
