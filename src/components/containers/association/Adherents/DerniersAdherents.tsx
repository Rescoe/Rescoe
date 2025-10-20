import { useState, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from '@metamask/detect-provider';
import ABI from '../../../ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.
import ABI_ADHESION_MANAGEMENT from '../../../ABI/ABI_ADHESION_MANAGEMENT.json'; // Votre ABI de contrat ici.
import { Box, Heading, Text, Grid, GridItem, Center, Image, Tooltip } from "@chakra-ui/react";
import { keyframes } from "@emotion/react"; // <-- important

import Link from 'next/link'; // Assurez-vous d'importer Link en haut du fichier

interface InsectURI {
    id: string;
    image: string;
    name?: string;
}

interface UserInfo {
    membershipValid: boolean;
    name: string;
    bio: string;
    address: string; // Ajout de l'adresse Ethereum
    tokens: number[];
    insects: InsectURI[];
}

// Animation d'une lueur qui tourne autour du contour
const borderAnimation = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 400% 50%;
  }
`;

const DerniersAdherents: React.FC = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [dernierAdherentsInfo, setDernierAdherentsInfo] = useState<UserInfo[]>([]);
    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;
    const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER;

    useEffect(() => {
        const initWeb3 = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
            } else {
                alert('Veuillez installer MetaMask !');
            }
        };

        initWeb3();
    }, []);

    useEffect(() => {
        if (web3) {
            fetchDerniersAdherents();
        }
    }, [web3]);

    const fetchDerniersAdherents = async () => {
        try {
            const contract = new web3!.eth.Contract(ABI, contractAddress);
            const uniqueMembers = new Set<string>();
            const roles = { 0: 'Artist', 1: 'Poet', 2: 'Contributor', 3: 'Trainee' };

            for (let role in roles) {
                const members: string[] = await contract.methods.getMembersByRole(role).call();
                members.forEach(member => uniqueMembers.add(member));
            }

            const lastFourAdherents = Array.from(uniqueMembers).slice(-4); // Récupérer les 4 derniers adhérents
            const membersInfoPromises = lastFourAdherents.map(address => getUserInfo(address, contract)); // Passer l'adresse ici
            const membersInfo = await Promise.all(membersInfoPromises);

            setDernierAdherentsInfo(membersInfo);
        } catch (error) {
            console.error("Erreur lors de la récupération des derniers adhérents:", error);
        }
    };

    const getUserInfo = async (address: string, contract: any): Promise<UserInfo> => {
        try {
            const contractManagement = new web3!.eth.Contract(ABI_ADHESION_MANAGEMENT, contractAddressManagement);

            // <-- Typage minimal pour ne pas casser la logique runtime (on garde userInfo[0], [1], [2] tels quels)
            const userInfo = await contractManagement.methods.getUserInfo(address).call() as any;

            const membershipValid = userInfo[0]; // Booléen pour la validité
            const name = userInfo[1]; // Nom
            const bio = userInfo[2]; // Bio

            // Récupérer les tokens
            const tokens = await contract.methods.getTokensByOwner(address).call();

            // Récupérer les images des insectes associés aux tokens
            const insects = await Promise.all(tokens.map(async (tokenId: number) => {
                try {
                    const tokenURI: string = await contract.methods.tokenURI(tokenId).call();
                    const response = await fetch(tokenURI);

                    if (!response.ok) {
                        throw new Error(`Erreur lors de la récupération de l'URI : ${response.statusText}`);
                    }

                    const metadata = await response.json();
                    return { id: tokenId.toString(), image: metadata.image, name: metadata.name }; // Récupérer l'image
                } catch (error) {
                    console.error("Erreur lors de la récupération de l'insecte:", error);
                    return null;
                }
            }));

            // Filtrer les null et renvoyer un tableau vide si pas d'insectes
            return {
                membershipValid,
                name,
                bio,
                address,  // Ajoutez l'adresse Ethereum ici
                tokens,
                insects: (insects.filter(Boolean) as InsectURI[])
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération des informations de l'utilisateur ${address}:`, error);
            return { membershipValid: false, name: "", bio: "", address, tokens: [], insects: [] }; // Initialiser insects comme tableau vide
        }
    };

      return (
    <Box p={5}>
      <Box mt={5}>
        {dernierAdherentsInfo.length > 0 ? (
          <Grid
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
            gap={6}
            justifyContent="center"
          >
            {dernierAdherentsInfo.map((info, idx) => (
              <GridItem
                key={idx}
                w={{ base: "100%", md: "200px" }}  // Pleine largeur mobile, fixe desktop
                height="250px"
                borderRadius="xl"
                position="relative"
                p="2px"
                bgGradient="linear-gradient(90deg, pink.400, purple.700, pink.400)"
                backgroundSize="300% 300%"
                animation={`${borderAnimation} 6s linear infinite`}
                transition="all 0.3s ease"
                _hover={{
                  animation: `${borderAnimation} 2s linear infinite`,
                  transform: "scale(1.05)",
                  boxShadow: "0 0 25px rgba(216, 112, 255, 0.6)",
                }}
              >
                <Box
                  bg="gray.900"
                  borderRadius="xl"
                  height="100%"
                  p={4}
                  textAlign="center"
                >
                  <Link href={`/u/${info.address}`} passHref>
                    <Tooltip label="Cliquez pour voir le profil" hasArrow>
                      <Box as="a" display="block" height="100%">
                        <Text fontWeight="bold" color="pink.200">{info.name}</Text>
                        <Text fontSize="sm" color="gray.300">{info.bio}</Text>
                        <Box display="flex" justifyContent="center" mt={3}>
                          {info.insects && info.insects.length > 0 ? (
                            info.insects.map((insect) => (
                              <Box key={insect.id} mr={2} textAlign="center">
                                <Image
                                  src={insect.image}
                                  alt={insect.name}
                                  boxSize="45px"
                                  borderRadius="md"
                                  objectFit="cover"
                                />
                                <Text fontSize="xs" color="gray.400" mt={1}>{insect.name}</Text>
                              </Box>
                            ))
                          ) : (
                            <Text fontSize="xs" color="gray.500">Aucun jeton d'adhésion</Text>
                          )}
                        </Box>
                      </Box>
                    </Tooltip>
                  </Link>
                </Box>
              </GridItem>
            ))}
          </Grid>
        ) : (
          <Text>Aucun adhérent trouvé.</Text>
        )}
      </Box>
    </Box>
  );

};

export default DerniersAdherents;
