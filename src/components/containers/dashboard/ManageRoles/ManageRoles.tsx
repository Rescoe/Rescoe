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

    const handleConfirmRole = async (): Promise<void> => {
        if (adhesionData.length === 0) {
            alert('Aucune adhésion à traiter.');
            return;
        }
        if (pinataError) {
            alert(`Erreur Pinata: ${pinataError}`);
            return;
        }
        setIsUploading(true);

        try {
            const generatedInsects = await Promise.all(adhesionData.map(async (adhesion, index) => {
                const insectData = await genInsect25(0);
                const previewUrl = resolveIPFS(insectData.imageUrl, true);
                return { imageUrl: previewUrl, data: insectData };
            }));

            const metadataUris = await Promise.all(adhesionData.map(async (adhesion, index) => {
                const { imageUrl, data: insectData } = generatedInsects[index];
                const spriteFilename = insectData.spriteName;
                const familyKey = insectData.folder;
                const profiles = colorProfilesJson.families[familyKey];
                const colorProfile = profiles?.find((p: any) => p.filename === spriteFilename) ?? profiles?.[0];

                const insectAttributes = [
                    ...insectData.attributes,
                    { trait_type: "Famille", value: familyKey },
                    { trait_type: "1er Propriétaire", value: adhesion.name || "Membre" },
                    { trait_type: "Insect name", value: insectData.display_name },
                    { trait_type: "Lore", value: insectData.lore },
                    { trait_type: "TotalFamille", value: insectData.total_in_family },
                    { trait_type: "Sprite", value: spriteFilename }
                ];

                const colorAttributes = colorProfile ? [
                    { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
                    { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
                    { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
                    { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
                    { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },
                    { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
                    { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
                    { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },
                    { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
                    { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
                    { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness) },
                    { trait_type: "Entropie", value: Math.round(colorProfile.metrics.entropy * 10) / 10 },
                    { trait_type: "Frames", value: colorProfile.frame_count },
                    { trait_type: "Pixels", value: colorProfile.total_pixels_analyzed.toLocaleString() },
                    { trait_type: "TailleBytes", value: (colorProfile.gif_info.size_bytes / 1000).toFixed(1) + "KB" }
                ] : [];

                const fullAttributes = [
                    ...insectAttributes.filter(attr => !["Niveau", "Level"].includes(attr.trait_type)),
                    { trait_type: "Niveau", value: 0 },
                    ...colorAttributes,
                ];

                const result = await uploadToIPFS({
                    scope: "badges",
                    imageUrl,
                    name: adhesion.name || `Membre ${index + 1}`,
                    bio: adhesion.bio || "",
                    role: adhesion.role,
                    level: 0,
                    attributes: fullAttributes,
                    family: familyKey,
                    sprite_name: spriteFilename,
                    previousImage: null,
                    evolutionHistory: [],
                    color_profile: colorProfile
                });

                return result.metadataUri;
            }));

            setAdhesionData((prev: any[]) => prev.map((adhesion: any, index: number) => ({
                ...adhesion,
                imageIpfsUrl: generatedInsects[index].imageUrl,
                metadataUri: metadataUris[index],
                insectData: generatedInsects[index].data
            })));

            if (generatedInsects[0]?.imageUrl) setGeneratedImageUrl(generatedInsects[0].imageUrl);
            alert(`✅ ${adhesionData.length} NFTs READY !`);
        } catch (error: any) {
            console.error('❌ Admin échoué:', error);
            alert(`❌ Échec: ${error.message || 'Erreur inconnue'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleMintMultiple = async (): Promise<void> => {
        if (window.ethereum) {
            const web3Instance = new Web3(window.ethereum as any);
            const contract = new web3Instance.eth.Contract(ABI, contractAdhesion);

            const details = adhesionData.map(adhesion => ({
                address: adhesion.address.trim(),
                role: roleMapping[adhesion.role],
                name: adhesion.name || "",
                bio: adhesion.bio || "",
            }));

            try {
                const accounts: string[] = await web3Instance.eth.getAccounts();

                const recipientsArray: string[] = details.map(adhesion => adhesion.address);
                const rolesArray: number[] = details.map(adhesion => adhesion.role);
                const nameArray: string[] = details.map(adhesion => adhesion.name);
                const bioArray: string[] = details.map(adhesion => adhesion.bio);
                const urisArray: string[] = adhesionData
                    .map(adhesion => adhesion.metadataUri)
                    .filter((uri): uri is string => typeof uri === "string");

                const length = recipientsArray.length;

                if (length === 0) {
                    alert('Aucune adhésion à mint.');
                    return;
                }

                if (length > 100) {
                    alert('Maximum 100 adhésions par batch.');
                    return;
                }

                if (recipientsArray.length !== rolesArray.length ||
                    recipientsArray.length !== urisArray.length ||
                    recipientsArray.length !== nameArray.length ||
                    recipientsArray.length !== bioArray.length) {
                    alert('Les tableaux ont des longueurs différentes.');
                    return;
                }

                for (let i = 0; i < length; i++) {
                    if (!web3Instance.utils.isAddress(recipientsArray[i])) {
                        alert(`Adresse invalide à l'index ${i}: ${recipientsArray[i]}`);
                        return;
                    }
                    if (rolesArray[i] > 3) {
                        alert(`Rôle invalide à l'index ${i}: ${rolesArray[i]} (max 3)`);
                        return;
                    }
                }

                setLoading(true);

                const gasEstimate = await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray)
                    .estimateGas({ from: accounts[0] });

                const gasPrice = await web3Instance.eth.getGasPrice();

                const tx = await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray)
                    .send({
                        from: accounts[0],
                        gas: Math.floor(Number(gasEstimate) * 1).toString(),
                        gasPrice: gasPrice.toString()
                    });

                alert(`✅ ${length} NFTs mintés avec succès!\nTX: ${tx.transactionHash}`);

            } catch (error: any) {
                console.error("Minting failed:", error);
                const errorMsg = error.message || error.reason || 'Erreur inconnue';
                alert(`❌ Mint échoué: ${errorMsg}`);
            } finally {
                setLoading(false);
            }
        } else {
            alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
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
                            <FormLabel>URI IPFS</FormLabel>
                            <Input
                                value={adhesion.metadataUri || 'À générer...'}
                                isReadOnly
                                title={adhesion.metadataUri || ''}
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
                    colorScheme="blue"
                >
                    📤 Confirmer & IPFS
                </Button>
                <Button
                    onClick={handleMintMultiple}
                    isLoading={loading}
                    colorScheme="green"
                    isDisabled={adhesionData.some(ad => !ad.metadataUri)}
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
                    Prêt pour mint: {adhesionData.filter(ad => ad.metadataUri).length}/{adhesionData.length} URIs générées
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
