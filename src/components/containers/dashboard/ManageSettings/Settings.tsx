// components/ManageSettings/Settings.tsx
import React from 'react';
import Web3 from 'web3';
import ABI from '@/components/ABI/ABIAdhesion.json';
import ABIManagementAdhesion from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import {
    Box, Button, Heading, Text, Input, VStack, HStack, Divider, FormControl, FormLabel
} from '@chakra-ui/react';

interface SettingsProps {
    web3: Web3 | null;
    account: string;
    contractAdhesion: string;
    contratAdhesionManagement: string;
    mintPrice: number;
    setMintPrice: (price: number) => void;
    prixPoints: string;
    setprixPoints: (price: string) => void;
    newPointPrice: number;
    setNewPointPrice: (price: number) => void;
    activeSettingsTab: string;
    setActiveSettingsTab: (tab: string) => void;
    fetchPointPrice: () => Promise<void>;
}

const Settings: React.FC<SettingsProps> = ({
    web3,
    account,
    contractAdhesion,
    contratAdhesionManagement,
    mintPrice,
    setMintPrice,
    prixPoints,
    setprixPoints,
    newPointPrice,
    setNewPointPrice,
    activeSettingsTab,
    setActiveSettingsTab,
    fetchPointPrice,
}) => {

    const handleSetMintPrice = async (): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABI, contractAdhesion);
            try {
                const priceInWei = web3.utils.toWei(mintPrice.toString(), 'ether');
                await contract.methods.setMintPrice(priceInWei).send({ from: account });
                alert('Prix de mint mis à jour avec succès!');
            } catch (error) {
                console.error("Erreur lors de la mise à jour du prix:", error);
                alert("La mise à jour a échoué!");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    const setPointPrice = async (newPrice: number) => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);
            try {
                const priceInWei = web3.utils.toWei(newPrice.toString(), 'ether');
                await contract.methods.setPointPrice(priceInWei).send({ from: account });
                alert('Prix des points mis à jour avec succès !');
                await fetchPointPrice();
            } catch (error) {
                console.error("Erreur lors de la mise à jour du prix des points:", error);
                alert("La mise à jour a échoué !");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    const handleWithdrawAdhesion = async (): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABI, contractAdhesion);

            try {
                await contract.methods.withdraw().send({ from: account });
                alert('Retrait réussi!');
            } catch (error) {
                console.error("Erreur lors du retrait:", error);
                alert("Retrait échoué!");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    const handleWithdrawPoints = async (): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);

            try {
                await contract.methods.withdraw().send({ from: account });
                alert('Retrait réussi!');
            } catch (error) {
                console.error("Erreur lors du retrait:", error);
                alert("Retrait échoué!");
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    return (
        <VStack spacing={6} align="stretch">
            <HStack spacing={4} flexWrap="wrap">
                <Button
                    onClick={() => setActiveSettingsTab('MintPrice')}
                    variant={activeSettingsTab === 'MintPrice' ? 'solid' : 'outline'}
                >
                    Changer le prix de l'adhésion
                </Button>
                <Button
                    onClick={() => setActiveSettingsTab('PointPrice')}
                    variant={activeSettingsTab === 'PointPrice' ? 'solid' : 'outline'}
                >
                    Changer le prix des points de récompense
                </Button>

                <Button
                    onClick={() => setActiveSettingsTab('Withdraw')}
                    variant={activeSettingsTab === 'Withdraw' ? 'solid' : 'outline'}
                >
                    Retirer des fonds
                </Button>
            </HStack>

            <Divider />

            {activeSettingsTab === 'MintPrice' && (
                <VStack spacing={4} align="stretch">
                    <Heading size="md">Changer le prix de mint</Heading>
                    <Text>Saisissez le nouveau prix de mint (ETH):</Text>
                    <FormControl>
                        <FormLabel>Prix de mint</FormLabel>
                        <Input
                            placeholder="Nouveau prix de mint (ETH)"
                            value={mintPrice}
                            onChange={(e) => setMintPrice(Number(e.target.value))}
                            type="number"
                        />
                    </FormControl>
                    <Button onClick={handleSetMintPrice} colorScheme="blue">
                        Changer le prix de mint
                    </Button>
                </VStack>
            )}

            {activeSettingsTab === 'PointPrice' && (
                <VStack spacing={4} align="stretch">
                    <Heading size="md">Changer le prix des points</Heading>
                    <Text mt={4}>Prix actuel d'un point: {prixPoints} ETH</Text>

                    <FormControl>
                        <FormLabel>Nouveau prix des points</FormLabel>
                        <Input
                            placeholder="Nouveau prix des points"
                            value={newPointPrice}
                            onChange={(e) => setNewPointPrice(Number(e.target.value))}
                            type="number"
                        />
                    </FormControl>
                    <Button onClick={() => setPointPrice(newPointPrice)} colorScheme="blue">
                        Changer le prix des points
                    </Button>
                </VStack>
            )}

            {activeSettingsTab === 'Withdraw' && (
                <VStack spacing={4} align="stretch">
                    <Heading size="md">Retirer des fonds</Heading>
                    <Text>Appuyez sur le bouton ci-dessous pour retirer les fonds disponibles.</Text>
                    <HStack spacing={4}>
                        <Button onClick={handleWithdrawAdhesion} colorScheme="red" flex="1">
                            Retirer les fonds d'adhésion
                        </Button>
                        <Button onClick={handleWithdrawPoints} colorScheme="red" flex="1">
                            Retirer les fonds d'achat de points
                        </Button>
                    </HStack>
                </VStack>
            )}
        </VStack>
    );
};

export default Settings;
