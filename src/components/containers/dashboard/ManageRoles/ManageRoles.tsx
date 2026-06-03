// components/ManageRole/ManageRoles.tsx
import React, { useCallback } from 'react';
import Web3 from 'web3';
import ABI from '@/components/ABI/ABIAdhesion.json';
import {
    Box, Button, Heading, Text, Image, Center, Input, VStack, HStack,
    Select, Divider, FormControl, FormLabel, Textarea, NumberInput,
    NumberInputField, SimpleGrid
} from '@chakra-ui/react';

interface ManageRolesProps {
    web3: Web3 | null;
    account: string;
    contractAdhesion: string;
    roleMapping: Record<string, number>;
    uploadToIPFS: any;
    genInsect25: any;
    colorProfilesJson: any;
    resolveIPFS: any;
    numberOfAdhesions: number;
    setNumberOfAdhesions: (n: number) => void;
    adhesionData: any[];
    setAdhesionData: React.Dispatch<React.SetStateAction<any[]>>;
    generatedImageUrl: string | null;
    setGeneratedImageUrl: (url: string | null) => void;
    isUploading: boolean;
    setIsUploading: (b: boolean) => void;
    loading: boolean;
    setLoading: (b: boolean) => void;
    pinataError: string | null;
    levelDurations: any[];
    setLevelDurations: React.Dispatch<React.SetStateAction<any[]>>;
    durationSeconds: bigint[];
    setDurationSeconds: (s: bigint[]) => void;
    isUpdatingDurations: boolean;
    setIsUpdatingDurations: (b: boolean) => void;
}

const ManageRoles: React.FC<ManageRolesProps> = ({
    web3,
    account,
    contractAdhesion,
    roleMapping,
    uploadToIPFS,
    genInsect25,
    colorProfilesJson,
    resolveIPFS,
    numberOfAdhesions,
    setNumberOfAdhesions,
    adhesionData,
    setAdhesionData,
    generatedImageUrl,
    setGeneratedImageUrl,
    isUploading,
    setIsUploading,
    loading,
    setLoading,
    pinataError,
    levelDurations,
    setLevelDurations,
    durationSeconds,
    setDurationSeconds,
    isUpdatingDurations,
    setIsUpdatingDurations,
}) => {

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const count = parseInt(e.target.value);
        if (!isNaN(count) && count >= 1 && count <= 100) {
            setNumberOfAdhesions(count);
            setAdhesionData(Array.from({ length: count }, (_, index) => ({
                address: '',
                role: '',
                name: `Membre ${index + 1}`,
                bio: index === 0 ? 'Biographie (modifiable)' : '',
                imageIpfsUrl: '',
                metadataUri: ''
            })));
        } else {
            setNumberOfAdhesions(1);
            setAdhesionData([{
                address: '',
                role: '',
                name: '',
                bio: 'Biographie (modifiable)',
                imageIpfsUrl: '',
                metadataUri: ''
            }]);
        }
    };

    const handleAdhesionChange = (index: number, field: string, value: string) => {
        const updatedData = [...adhesionData];
        updatedData[index] = { ...updatedData[index], [field]: value };
        setAdhesionData(updatedData);
    };

    // ── Génération on-chain des insectes (remplace l'ancien IPFS/Pinata) ────────
    // Appelle /api/token/generate-onchain-uri pour chaque destinataire.
    // Le wallet du destinataire est utilisé comme seed → insecte déterministe.
    const handleConfirmRole = async (): Promise<void> => {
        if (adhesionData.length === 0) {
            alert('Aucune adhésion à traiter.');
            return;
        }
        const invalid = adhesionData.find(
            (ad, i) => !ad.address || !ad.role || !ad.name
        );
        if (invalid) {
            alert('⚠️ Remplissez adresse, rôle et nom pour chaque adhésion.');
            return;
        }
        setIsUploading(true);

        try {
            const results = await Promise.all(
                adhesionData.map(async (adhesion: any) => {
                    const params = new URLSearchParams({
                        wallet: adhesion.address.trim(),
                        role: adhesion.role,
                        name: adhesion.name || 'Membre',
                        bio: adhesion.bio || '',
                        isAnnual: 'true',
                        autoEvolve: 'true',
                    });
                    const res = await fetch(`/api/token/generate-onchain-uri?${params}`);
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error ?? `HTTP ${res.status} pour ${adhesion.address}`);
                    }
                    return res.json();
                })
            );

            setAdhesionData((prev: any[]) =>
                prev.map((adhesion: any, i: number) => ({
                    ...adhesion,
                    insectKey: results[i].insectName,
                    displayName: results[i].displayName,
                    insectFamily: results[i].family,
                    imageUrl: results[i].imageUrl,
                    // Conservé pour compatibilité affichage — non utilisé dans mint
                    metadataUri: `on-chain:${results[i].insectName}`,
                }))
            );

            if (results[0]?.imageUrl) setGeneratedImageUrl(results[0].imageUrl);
            alert(`✅ ${adhesionData.length} insectes générés on-chain — prêts à minter !`);
        } catch (error: any) {
            console.error('❌ Génération insectes échouée:', error);
            alert(`❌ Échec: ${error.message || 'Erreur inconnue'}`);
        } finally {
            setIsUploading(false);
        }
    };

    // ── Mint multiple on-chain (nouvelle signature contrat) ──────────────────
    // mintMultiple(recipients, insectKeys, displayNames, insectFamilies, roles, names, bios)
    const handleMintMultiple = async (): Promise<void> => {
        if (!window.ethereum) {
            alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
            return;
        }

        const missing = adhesionData.find((ad: any) => !ad.insectKey);
        if (missing) {
            alert('⚠️ Générez d\'abord les insectes on-chain pour chaque adhésion.');
            return;
        }

        const web3Instance = new Web3(window.ethereum as any);
        const contract = new web3Instance.eth.Contract(ABI, contractAdhesion);

        const length = adhesionData.length;
        if (length === 0)  { alert('Aucune adhésion à mint.'); return; }
        if (length > 100)  { alert('Maximum 100 adhésions par batch.'); return; }

        // Validation adresses et rôles
        for (let i = 0; i < length; i++) {
            if (!web3Instance.utils.isAddress(adhesionData[i].address?.trim())) {
                alert(`Adresse invalide #${i + 1}: ${adhesionData[i].address}`);
                return;
            }
            if (!(adhesionData[i].role in roleMapping)) {
                alert(`Rôle invalide #${i + 1}: ${adhesionData[i].role}`);
                return;
            }
        }

        const recipientsArray:    string[] = adhesionData.map((ad: any) => ad.address.trim());
        const insectKeysArray:    string[] = adhesionData.map((ad: any) => ad.insectKey);
        const displayNamesArray:  string[] = adhesionData.map((ad: any) => ad.displayName || ad.insectKey);
        const insectFamiliesArr:  string[] = adhesionData.map((ad: any) => ad.insectFamily || '');
        const rolesArray:         number[] = adhesionData.map((ad: any) => roleMapping[ad.role]);
        const nameArray:          string[] = adhesionData.map((ad: any) => ad.name || '');
        const bioArray:           string[] = adhesionData.map((ad: any) => ad.bio || '');

        try {
            setLoading(true);

            const accounts: string[] = await web3Instance.eth.getAccounts();
            const gasPrice = await web3Instance.eth.getGasPrice();

            const gasEstimate = await contract.methods
                .mintMultiple(
                    recipientsArray, insectKeysArray, displayNamesArray,
                    insectFamiliesArr, rolesArray, nameArray, bioArray
                )
                .estimateGas({ from: accounts[0] });

            const tx = await contract.methods
                .mintMultiple(
                    recipientsArray, insectKeysArray, displayNamesArray,
                    insectFamiliesArr, rolesArray, nameArray, bioArray
                )
                .send({
                    from: accounts[0],
                    gas: Math.floor(Number(gasEstimate) * 1.2).toString(), // +20% marge
                    gasPrice: gasPrice.toString(),
                });

            alert(`✅ ${length} NFTs mintés avec succès !\nTX: ${tx.transactionHash}`);

        } catch (error: any) {
            console.error('Minting failed:', error);
            alert(`❌ Mint échoué: ${error.message || error.reason || 'Erreur inconnue'}`);
        } finally {
            setLoading(false);
        }
    };

    const updateDuration = useCallback((index: number, newDuration: any) => {
        setLevelDurations((prev: any[]) => {  // ✅ Typé
            const newLevels = [...prev];
            newLevels[index] = newDuration;
            return newLevels;
        });
    }, [setLevelDurations]);


    const hasValidDurations = (): boolean => {
        return durationSeconds.some(sec => sec > 0n);
    };

    const formatDuration = (seconds: bigint): string => {
        const days = Number(seconds / 86400n);
        const hours = Number((seconds % 86400n) / 3600n);
        const minutes = Number((seconds % 3600n) / 60n);
        return `${days}d ${hours}h ${minutes}m`;
    };

    const handleSetLevelDurations = async (durations: bigint[]): Promise<void> => {
        if (window.ethereum && web3 && account) {
            const contract = new web3.eth.Contract(ABI, contractAdhesion);

            try {
                const durationsStr = durations.map(bn => bn.toString());
                const gasEstimate = await contract.methods.setLevelDurations(durationsStr)
                    .estimateGas({ from: account });

                const gasPrice = await web3.eth.getGasPrice();

                const tx = await contract.methods.setLevelDurations(durationsStr)
                    .send({
                        from: account,
                        gas: Math.floor(Number(gasEstimate) * 1).toString(),
                        gasPrice: gasPrice.toString()
                    });

                alert('✅ Durées des niveaux mises à jour !');
            } catch (error: any) {
                console.error('Erreur setLevelDurations:', error);

                if (error.message.includes('onlyOwner')) {
                    alert('❌ Seulement le owner peut modifier !');
                } else if (error.message.includes('Must provide 4 durations')) {
                    alert('❌ Exactement 4 durées requises !');
                } else {
                    alert(`❌ Échec : ${error.message}`);
                }
            }
        } else {
            alert('⚠️ Connectez-vous d\'abord avec MetaMask');
        }
    };

    const handleUpdateDurations = async () => {
        setIsUpdatingDurations(true);

        const validDurations = durationSeconds.filter(sec => sec > 0n);
        if (validDurations.length !== 4) {
            alert('❌ Remplissez exactement 4 durées (laissez 0 si pas utilisé)');
            setIsUpdatingDurations(false);
            return;
        }

        await handleSetLevelDurations(durationSeconds);
        setIsUpdatingDurations(false);
    };

    return (
        <VStack spacing={6} align="stretch">
            <Heading size="md">Générer des adhésions</Heading>

            <FormControl>
                <FormLabel>Nombre d'adhésions (max 100):</FormLabel>
                <Input
                    type="number"
                    value={numberOfAdhesions}
                    onChange={handleNumberChange}
                    min={1}
                    max={100}
                />
            </FormControl>

            {adhesionData.map((adhesion, index) => (
                <VStack key={index} spacing={2} p={4} borderWidth={1} borderRadius="md" w="full">
                    <Text fontWeight="bold">Adhésion #{index + 1}</Text>

                    <FormControl isInvalid={!web3?.utils.isAddress(adhesion.address)}>
                        <FormLabel>Adresse</FormLabel>
                        <Input
                            value={adhesion.address}
                            onChange={(e) => handleAdhesionChange(index, 'address', e.target.value)}
                            placeholder="0x..."
                        />
                    </FormControl>

                    <HStack spacing={4} w="full">
                        <FormControl flex="1">
                            <FormLabel htmlFor={`role-${index}`}>Rôle</FormLabel>
                            <Select
                                id={`role-${index}`}
                                value={adhesion.role}
                                onChange={(e) => handleAdhesionChange(index, 'role', e.target.value)}
                                placeholder="Choisir un rôle"
                            >
                                {Object.keys(roleMapping).map(role => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl flex="1">
                            <FormLabel>Insecte on-chain</FormLabel>
                            <Input
                                value={
                                    adhesion.insectKey
                                        ? `${adhesion.insectFamily} — ${adhesion.displayName}`
                                        : '🎲 À générer…'
                                }
                                isReadOnly
                                color={adhesion.insectKey ? 'green.300' : 'gray.400'}
                                title={adhesion.insectKey || ''}
                            />
                        </FormControl>
                    </HStack>

                    <FormControl w="full">
                        <FormLabel>Nom</FormLabel>
                        <Input
                            value={adhesion.name}
                            onChange={(e) => handleAdhesionChange(index, 'name', e.target.value)}
                        />
                    </FormControl>

                    <FormControl w="full">
                        <FormLabel>Bio</FormLabel>
                        <Textarea
                            value={adhesion.bio}
                            onChange={(e) => handleAdhesionChange(index, 'bio', e.target.value)}
                            placeholder="Biographie..."
                            rows={3}
                        />
                    </FormControl>
                </VStack>
            ))}

            {generatedImageUrl && (
                <Center mt={4}>
                    <Image src={generatedImageUrl} alt="Insecte" boxSize="150px" borderRadius="md" />
                </Center>
            )}

            <HStack spacing={4} mt={6}>
                <Button
                    onClick={handleConfirmRole}
                    isLoading={isUploading}
                    loadingText="Génération…"
                    colorScheme="blue"
                    isDisabled={adhesionData.some((ad: any) => !ad.address || !ad.role || !ad.name)}
                >
                    🎲 Générer insectes on-chain
                </Button>
                <Button
                    onClick={handleMintMultiple}
                    isLoading={loading}
                    loadingText="Mint en cours…"
                    colorScheme="green"
                    isDisabled={adhesionData.some((ad: any) => !ad.insectKey)}
                >
                    🪲 Mint Multiple ({adhesionData.length}/100)
                </Button>
                <Button
                    onClick={() => {
                        setAdhesionData([]);
                        setNumberOfAdhesions(0);
                    }}
                    colorScheme="gray"
                    variant="outline"
                >
                    🔄 Reset
                </Button>
            </HStack>

            {adhesionData.length > 0 && (
                <Text fontSize="sm" color="gray.500" mt={2}>
                    Insectes prêts : {adhesionData.filter((ad: any) => ad.insectKey).length}/{adhesionData.length}
                    {adhesionData.every((ad: any) => ad.insectKey) && ' ✅ — prêts à minter !'}
                </Text>
            )}

            <Divider />

            <Box mt={6} p={6} borderWidth={1} borderRadius="lg" boxShadow="md">
                <Heading size="md" mb={4}>Durées des niveaux</Heading>

                <VStack spacing={6} align="stretch">
                    <Text fontSize="sm" color="gray.600">
                        Remplissez jours/heure/minutes. Laissez 0 si pas utilisé.
                    </Text>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        {[
                            { label: 'Niveau 0', key: 0 },
                            { label: 'Niveau 1', key: 1 },
                            { label: 'Niveau 2', key: 2 },
                            { label: 'Niveau 3', key: 3 }
                        ].map(({ label, key }) => {
                            const level = levelDurations[key];

                            return (
                                <FormControl key={`level-${key}`} id={`level-${key}`}>
                                    <FormLabel fontSize="sm">{label}</FormLabel>
                                    <HStack spacing={3}>
                                        <NumberInput
                                            min={0} max={365}
                                            value={level.days}
                                            onChange={(v) => updateDuration(key, { ...level, days: Number(v) })}
                                            w="90px"
                                            keepWithinRange
                                            clampValueOnBlur
                                        >
                                            <NumberInputField id={`days-${key}`} />
                                        </NumberInput>
                                        <Text fontSize="sm" color="gray.500">j</Text>

                                        <NumberInput
                                            min={0} max={23}
                                            value={level.hours}
                                            onChange={(v) => updateDuration(key, { ...level, hours: Number(v) })}
                                            w="90px"
                                            keepWithinRange
                                            clampValueOnBlur
                                        >
                                            <NumberInputField id={`hours-${key}`} />
                                        </NumberInput>
                                        <Text fontSize="sm" color="gray.500">h</Text>

                                        <NumberInput
                                            min={0} max={59}
                                            value={level.minutes}
                                            onChange={(v) => updateDuration(key, { ...level, minutes: Number(v) })}
                                            w="90px"
                                            keepWithinRange
                                            clampValueOnBlur
                                        >
                                            <NumberInputField id={`min-${key}`} />
                                        </NumberInput>
                                        <Text fontSize="sm" color="gray.500">min</Text>
                                    </HStack>

                                    {durationSeconds[key] > 0n && (
                                        <Text fontSize="xs" color="green.600" mt={1}>
                                            {formatDuration(durationSeconds[key])} ({durationSeconds[key]}s)
                                        </Text>
                                    )}
                                </FormControl>
                            );
                        })}
                    </SimpleGrid>

                    <Button
                        colorScheme="green"
                        size="lg"
                        onClick={handleUpdateDurations}
                        isLoading={isUpdatingDurations}
                        isDisabled={!hasValidDurations()}
                    >
                        {isUpdatingDurations ? 'Application...' : 'Appliquer'}
                    </Button>
                </VStack>
            </Box>
        </VStack>
    );
};

export default ManageRoles;
