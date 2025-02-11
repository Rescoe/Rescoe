import { useState, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from '@metamask/detect-provider';
import ABI from '../../../ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.
import {
    Box,
    Button,
    Heading,
    Text,
    List,
    ListItem,
    VStack,
    Center,
    CheckboxGroup,
    Checkbox,
    SimpleGrid,
} from "@chakra-ui/react";
import NextLink from "next/link"; // Importer NextLink

interface InsectURI {
    id: string;
    image: string;
    name?: string; // Optional, si 'name' n'est pas toujours présent
}

interface MembersByRole {
    [key: string]: string[];
}

interface Roles {
    [key: number]: string;
}

const roles: Roles = {
    0: 'Artist',
    1: 'Poet',
    2: 'Contributor',
    3: 'Trainee'
};


const Adherent: React.FC = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [membersByRole, setMembersByRole] = useState<MembersByRole>({});
    const [insectURIs, setInsectURIs] = useState<InsectURI[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [account, setAccount] = useState<string | null>(null); // Modification ici
    const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
    const [totalInsectsMinted, setTotalInsectsMinted] = useState<number>(0);

    const roles: { [key: number]: string } = {
        0: 'Artist',
        1: 'Poet',
        2: 'Contributor',
        3: 'Trainee'
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS; // Mettez à jour avec votre adresse de contrat

    useEffect(() => {
        const fetchTotalMembersCount = async () => {
            try {
                const provider = await detectEthereumProvider();
                if (provider) {
                    const web3Instance = new Web3(provider);
                    const contract = new web3Instance.eth.Contract(ABI, contractAddress);
                    const uniqueMembers = new Set<string>();

                    for (let role in roles) {
                        const members: string[] = await contract.methods.getMembersByRole(role).call();
                        members.forEach(member => uniqueMembers.add(member)); // Compter les membres uniques
                    }

                    setTotalMembersCount(uniqueMembers.size);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération du nombre total d'adhérents:", error);
            }
        };

        fetchTotalMembersCount();
    }, []);

    useEffect(() => {
        let provider: any; // Typage générique pour le provider

        const initWeb3 = async () => {
            provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);

                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0] || null); // Pas de problème ici en raison du type modifié.

                provider.on('accountsChanged', (accounts: string[]) => {
                    setAccount(accounts[0] || null);
                });

                provider.on('chainChanged', (_chainId: string) => {
                    window.location.reload(); // Exemple
                });
            } else {
                alert('Veuillez installer MetaMask !');
            }
        };

        initWeb3();

        return () => {
            if (provider?.removeListener) {
                provider.removeListener('accountsChanged', setAccount);
                provider.removeListener('chainChanged', () => window.location.reload());
            }
        };
    }, []);

    useEffect(() => {
        if (web3) {
            fetchMembersByRole();
            fetchInsectURIs();
        }
    }, [web3]);

    const fetchMembersByRole = async () => {
        try {
            const contract = new web3!.eth.Contract(ABI, contractAddress);
            const roleData: MembersByRole = {};

            for (let role in roles) {
                const members: string[] = await contract.methods.getMembersByRole(role).call();
                roleData[roles[role]] = members; // Stocker les membres par rôle
            }

            setMembersByRole(roleData);
        } catch (error) {
            console.error("Erreur lors de la récupération des membres par rôle:", error);
        }
    };

    const fetchInsectURIs = async () => {
        try {
            const contract = new web3!.eth.Contract(ABI, contractAddress);
            const insectsCount: string = await contract.methods.getTotalMinted().call();
            setTotalInsectsMinted(Number(insectsCount));

            const fetchedInsects: (InsectURI | null)[] = await Promise.all(
                Array.from({ length: parseInt(insectsCount) }, async (_, i) => {
                    try {
                        const tokenURI: string = await contract.methods.tokenURI(i).call();
                        const response = await fetch(tokenURI);

                        if (!response.ok) {
                            throw new Error(`Erreur lors de la récupération de l'URI : ${response.statusText}`);
                        }

                        const metadata = await response.json();
                        return { id: i.toString(), image: metadata.image, name: metadata.name }; // Récupérer l'image
                    } catch (error) {
                        console.error("Erreur lors de la récupération de l'insecte:", error);
                        return null;
                    }
                })
            );


            const validInsects = fetchedInsects.filter((insect): insect is InsectURI => insect !== null);
            setInsectURIs(validInsects);
        } catch (error) {
            console.error("Erreur lors de la récupération des URIs des insectes:", error);
        }
    };

    const handleRoleChange = (role: string) => {
        setSelectedRoles(prevSelected => {
            if (prevSelected.includes(role)) {
                return prevSelected.filter(r => r !== role);
            } else {
                return [...prevSelected, role];
            }
        });
    };

    const getFilteredMembers = () => {
        if (selectedRoles.length === 0) return [];

        const filteredMembersSet = new Set<string>(membersByRole[selectedRoles[0]]);

        selectedRoles.forEach(role => {
            const membersForRole = new Set<string>(membersByRole[role] || []);
            if (membersForRole.size > 0) {
                const newFilteredSet = new Set<string>();

                // Utiliser une boucle pour filtrer les membres
                filteredMembersSet.forEach(member => {
                    if (membersForRole.has(member)) {
                        newFilteredSet.add(member);
                    }
                });

                // Remplacer l'ancien ensemble par le nouveau
                filteredMembersSet.clear();
                newFilteredSet.forEach(member => filteredMembersSet.add(member));
            }
        });

        return Array.from(filteredMembersSet);
    };


    return (
        <Box p={5}>
            <Center>
                <Heading mb={5}>Fonctionnement de l'Adhésion</Heading>
            </Center>
            <Text fontSize="xl" mb={5}>
                Devenir membre de notre association vous permet de participer activement à la communauté artistique et de bénéficier de plusieurs avantages.
                Chaque membre peut choisir un rôle spécifique lors de son adhésion, tel que Artiste, Poète, Contributeur, ou Formateur.
                Ces rôles déterminent les fonctionnalités et les opportunités qui vous seront accessibles.
            </Text>
            <Center>
                <Heading mb={5}>Statistiques des Adhérents</Heading>
            </Center>

            <Box mt={5}>
                <Heading size="md" mb={3}>Statistiques Globales</Heading>
                <Text fontSize="md" mb={3}>Nombre total d'adhérents : {totalMembersCount}</Text>
                <Text fontSize="md" mb={3}>Nombre total d'insectes mintés : {totalInsectsMinted}</Text>
            </Box>

            {account && (
                <>
                    <CheckboxGroup colorScheme="green">
                    <VStack spacing={4} align="start">
                    {Object.keys(roles).map((key) => {
                        const roleKey = Number(key); // Conversion de la clé en nombre
                        return (
                            <Checkbox
                                key={roleKey}
                                value={roles[roleKey]}
                                isChecked={selectedRoles.includes(roles[roleKey])}
                                onChange={() => handleRoleChange(roles[roleKey])}
                            >
                                {roles[roleKey]}
                            </Checkbox>
                        );
                    })}
                    </VStack>

                    </CheckboxGroup>

                    {getFilteredMembers().length > 0 && (
                        <Box mt={5}>
                            <Heading size="md" mb={3}>Liste des adhérents sélectionnés</Heading>
                            <Text fontSize="md" mb={3}>Nombre d'adresses : {getFilteredMembers().length}</Text>
                            <List spacing={3}>
                                {getFilteredMembers().map((address, idx) => (
                                    <ListItem key={idx}>
                                        {address}
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </>
            )}

            {insectURIs.length > 0 && (
                <Box mt={5}>
                    <Heading size="md" mb={3}>Images des Insectes Mintés</Heading>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                        {insectURIs.map((insect) => (
                            <Box key={insect.id} display="flex" alignItems="center" flexDirection="column">
                                <img src={insect.image} alt={`Insecte ${insect.id}`} style={{ width: '150px', marginBottom: '5px' }} />
                                <Text>{`${insect.name}`}</Text>
                                <NextLink href={`/AdhesionId/${contractAddress}/${insect.id}`} passHref>
                                    <Button mt={2}>Voir Détails</Button>
                                </NextLink>
                            </Box>
                        ))}
                    </SimpleGrid>
                </Box>
            )}
        </Box>
    );
};

export default Adherent;
