// components/ManageNFT/ManageNFT.tsx
import React, { useState } from 'react';
import Web3 from 'web3';
import ABI from '@/components/ABI/ABIAdhesion.json';
import ABICollection from '@/components/ABI/ABI_Collections.json';
import {
    Box, Button, Heading, Text, Input, VStack, HStack, Select, Divider, FormControl, FormLabel
} from '@chakra-ui/react';
import ManageFeaturedCollections from './ManageFeaturedCollections';


const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contratRescollection = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;



interface ManageNFTProps {
    web3: Web3 | null;
    account: string;
    contractAdhesion: string;
    contratRescollection: string;
    nftId: number;
    setNftId: (id: number) => void;
    salePrice: number;
    setSalePrice: (price: number) => void;
    activeNFTTab: string;
    setActiveNFTTab: (tab: string) => void;
    searchId: string;
    setSearchId: (id: string) => void;
    searchedCollection: any | null;
    setSearchedCollection: (collection: any | null) => void;
    featuredCollections: number[];
    setFeaturedCollections: (collections: number[]) => void;
    fetchCollectionById: (id: string) => Promise<any>;
    fetchFeaturedCollections: () => Promise<void>;
}

const ManageNFT: React.FC<ManageNFTProps> = ({
    web3,
    account,
    contractAdhesion,
    nftId,
    setNftId,
    salePrice,
    setSalePrice,
    activeNFTTab,
    setActiveNFTTab,
    searchId,
    setSearchId,
    searchedCollection,
    setSearchedCollection,
    featuredCollections,
    setFeaturedCollections,
    fetchCollectionById,
    fetchFeaturedCollections,
}) => {

    const handlePutNFTForSale = async (): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABI, contractAdhesion);
            try {
                const salePriceInWei = web3.utils.toWei(salePrice.toString(), 'ether');
                await contract.methods.putNFTForSale(nftId, salePriceInWei).send({ from: account });
                alert('NFT mis en vente avec succès!');
            } catch (error) {
                console.error("Erreur lors de la mise en vente du NFT:", error);
                alert("Echec de la mise en vente!");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    const handleBurnNFT = async (): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABI, contractAdhesion);
            try {
                await contract.methods.burnNFT(nftId).send({ from: account });
                alert('NFT brûlé avec succès!');
            } catch (error) {
                console.error("Erreur lors de la combustion du NFT:", error);
                alert("Echec de la combustion du NFT!");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    return (
        <VStack spacing={6} align="stretch">
            <HStack spacing={4}>
                <Button
                    onClick={() => setActiveNFTTab('ManageFeatured')}
                    variant={activeNFTTab === 'ManageFeatured' ? 'solid' : 'outline'}
                >
                    Collections mises en avant
                </Button>

                <Button
                    onClick={() => setActiveNFTTab('ManageNFT')}
                    variant={activeNFTTab === 'ManageNFT' ? 'solid' : 'outline'}
                >
                    Gérer les NFTs
                </Button>
            </HStack>

            {activeNFTTab === 'ManageNFT' && (
                <VStack spacing={4} align="stretch">
                    <Heading size="md">Gérer les NFTs</Heading>

                    <FormControl>
                        <FormLabel>Id du NFT à gérer :</FormLabel>
                        <Input
                            placeholder="ID du NFT"
                            value={nftId}
                            onChange={(e) => setNftId(Number(e.target.value))}
                            type="number"
                        />
                    </FormControl>

                    <FormControl>
                        <FormLabel>Prix de vente :</FormLabel>
                        <Input
                            placeholder="Prix de vente (ETH)"
                            value={salePrice}
                            onChange={(e) => setSalePrice(Number(e.target.value))}
                            type="number"
                        />
                    </FormControl>

                    <HStack spacing={4}>
                        <Button onClick={handlePutNFTForSale} colorScheme="green">
                            Mettre NFT en vente
                        </Button>
                        <Button onClick={handleBurnNFT} colorScheme="red">
                            Brûler un NFT
                        </Button>
                    </HStack>
                </VStack>
            )}

            {activeNFTTab === 'ManageFeatured' && (
                <ManageFeaturedCollections
                    web3={web3}
                    account={account}
                    contratRescollection={contratRescollection }
                    searchId={searchId}
                    setSearchId={setSearchId}
                    searchedCollection={searchedCollection}
                    setSearchedCollection={setSearchedCollection}
                    featuredCollections={featuredCollections}
                    setFeaturedCollections={setFeaturedCollections}
                    fetchCollectionById={fetchCollectionById}
                    fetchFeaturedCollections={fetchFeaturedCollections}
                />
            )}
        </VStack>
    );
};

export default ManageNFT;
