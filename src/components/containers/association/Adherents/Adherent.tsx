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

const Adherent = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [membersByRole, setMembersByRole] = useState<{ [key: string]: string[] }>({});
    const [insectURIs, setInsectURIs] = useState<{ id: string, image: string }[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [account, setAccount] = useState<string>('');
    const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
    const [totalInsectsMinted, setTotalInsectsMinted] = useState<number>(0);

    const roles = {
        0: 'Artist',
        1: 'Poet',
        2: 'Contributor',
        3: 'Trainee'
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS; // Mettez à jour avec votre adresse de contrat

    // Charger le nombre total d'adhérents pour tous les utilisateurs
    useEffect(() => {
        const fetchTotalMembersCount = async () => {
            try {
                const provider = await detectEthereumProvider();
                if (provider) {
                    const web3Instance = new Web3(provider);
                    const contract = new web3Instance.eth.Contract(ABI, contractAddress);
                    const roleData = {};
                    const uniqueMembers = new Set();

                    for (let role in roles) {
                        const members = await contract.methods.getMembersByRole(role).call();
                        members.forEach(member => uniqueMembers.add(member)); // Compter les membres uniques
                    }

                    setTotalMembersCount(uniqueMembers.size);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération du nombre total d'adhérents:" );
            }
        };

        fetchTotalMembersCount();
    }, []);


//Amélioration potentielle du chargement ? :
    useEffect(() => {
        let provider;

        const initWeb3 = async () => {
            provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);

                // Écouter les changements de compte (facultatif)
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0]);

                provider.on('accountsChanged', (accounts) => {
                    setAccount(accounts[0] || null);
                });

                provider.on('chainChanged', (_chainId) => {
                    // Vous pouvez gérer les changements de chaîne ici si nécessaire
                    window.location.reload(); // Exemple
                });
            } else {
                alert('Veuillez installer MetaMask !');
            }
        };

        initWeb3();

        return () => {
            // Nettoyage des listeners lorsque le composant est démonté
            if (provider?.removeListener) {
                provider.removeListener('accountsChanged', setAccount);
                provider.removeListener('chainChanged', () => window.location.reload());
            }
        };
    }, []);

    // Charger les détails pour les utilisateurs connectés
    useEffect(() => {
        if (web3) {
            fetchMembersByRole();
            fetchInsectURIs();
        }
    }, [web3]);

    const fetchMembersByRole = async () => {
        try {
            const contract = new web3.eth.Contract(ABI, contractAddress);
            const roleData: { [key: string]: string[] } = {};

            for (let role in roles) {
                const members = await contract.methods.getMembersByRole(role).call();
                roleData[roles[role]] = members; // Stocker les membres par rôle
            }

            setMembersByRole(roleData);
        } catch (error) {
            console.error("Erreur lors de la récupération des membres par rôle:" );
        }
    };

    const fetchInsectURIs = async () => {
        try {
            const contract = new web3.eth.Contract(ABI, contractAddress);
            const insectsCount = await contract.methods.getTotalMinted().call();
            setTotalInsectsMinted(Number(insectsCount));

            const fetchedInsects = await Promise.all([...Array(parseInt(insectsCount)).keys()].map(async (i) => {
                try {
                    const tokenURI = await contract.methods.tokenURI(i).call(); // Remplacez par la méthode correcte
                    const response = await  fetch(tokenURI);

                    if (!response.ok) {
                        throw new Error(`Erreur lors de la récupération de l'URI : ${response.statusText}`);
                    }

                    const metadata = await response.json();
                    return { id: i, image: metadata.image, name:metadata.name }; // Récupérer l'image
                } catch (error) {
                    console.error("Erreur lors de la récupération de l'insecte :" );
                    return null; // Retournez null pour les insectes qui échouent
                }
            }));

            const validInsects = fetchedInsects.filter(insect => insect !== null);
            setInsectURIs(validInsects);
        } catch (error) {
            console.error("Erreur lors de la récupération des URIs des insectes:" );
        }
    };

    const handleRoleChange = (role: string) => {
        setSelectedRoles(prevSelected => {
            if (prevSelected.includes(role)) {
                return prevSelected.filter(r => r !== role); // Retirer le rôle s'il était déjà sélectionné
            } else {
                return [...prevSelected, role]; // Ajouter le rôle
            }
        });
    };

    const getFilteredMembers = () => {
        if (selectedRoles.length === 0) return [];

        const filteredMembersSet = new Set(membersByRole[selectedRoles[0]]);

        selectedRoles.forEach(role => {
            const membersForRole = new Set(membersByRole[role] || []);
            if (membersForRole.size > 0) {
                const newFilteredSet = new Set(
                    [...filteredMembersSet].filter(member => membersForRole.has(member))
                );
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
                            {Object.keys(roles).map((key, index) => (
                                <Checkbox key={index} value={roles[key]} isChecked={selectedRoles.includes(roles[key])} onChange={() => handleRoleChange(roles[key])}>
                                    {roles[key]}
                                </Checkbox>
                            ))}
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
