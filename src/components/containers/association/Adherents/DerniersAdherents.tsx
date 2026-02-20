import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ABI from "../../../ABI/ABIAdhesion.json";
import ABI_ADHESION_MANAGEMENT from "../../../ABI/ABI_ADHESION_MANAGEMENT.json";
import {
  Box, Heading, Text, Grid, GridItem, Center, Image, Tooltip, useColorModeValue, useColorMode, Badge,  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  SimpleGrid,
  useBreakpointValue,
  Button,
} from "@chakra-ui/react";

import Link from "next/link";
import {gradients, animations, styles, Backgrounds} from "@/styles/theme"

import { resolveIPFS } from "@/utils/resolveIPFS";


interface InsectURI {
  id: string;
  image: string;
  name?: string;
  family?: string;  // ✅ Ajouté pour famille (15ème attribut)
  level?: string;
}

interface UserInfo {
  membershipValid: boolean;
  name: string;
  bio: string;
  address: string;
  tokens: number[];
  insects: InsectURI[];
}


const DerniersAdherents: React.FC = () => {
  const [dernierAdherentsInfo, setDernierAdherentsInfo] = useState<UserInfo[]>([]);
  const [family, setFamily] = useState<string[]>([]);  // ✅ string[] cohérent

  const { colorMode } = useColorMode();
  const bgColor = useColorModeValue(Backgrounds.cardBorderLight, Backgrounds.cardBorderDark);
  const cardBg = useColorModeValue("brand.cream", "brand.navy");
const cardBorder = useColorModeValue("brand.cream", "brand.cream");

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  useEffect(() => {
    const fetchDerniersAdherents = async () => {
      try {
        const contract = new ethers.Contract(contractAddress, ABI, provider);
        const roles = [0, 1, 2, 3];
        const uniqueMembers = new Set<string>();

        for (const role of roles) {
          const members: string[] = await contract.getMembersByRole(role);
          members.forEach((m) => uniqueMembers.add(m));
        }

        const lastFour = Array.from(uniqueMembers).slice(-4);
        const membersInfo = await Promise.all(
          lastFour.map((addr) => getUserInfo(addr))
        );

        setDernierAdherentsInfo(membersInfo);
        //console.log("✅ Derniers adhérents:", membersInfo);
      } catch (err) {
        console.error("Erreur lors de la récupération des adhérents:", err);
      }
    };

    fetchDerniersAdherents();
  }, []);

  // ✅ CORRIGÉ : Récupération famille (index 14 = 15ème élément)
  const getUserInfo = async (address: string): Promise<UserInfo> => {
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const contractManagement = new ethers.Contract(
        contractAddressManagement,
        ABI_ADHESION_MANAGEMENT,
        provider
      );

      const [membershipValid, name, bio] = await contract.getUserInfo(address);
      const tokens: bigint[] = await contract.getTokensByOwner(address);

      // 🔑 Récupère TOUS les insectes + familles avec resolveIPFS
      const insects = await Promise.all(
        tokens.map(async (tokenId) => {
          try {
            const tokenURI: string = await contract.tokenURI(tokenId);

            // Résoudre tokenURI pour fetch metadata
            const metadataUrl = resolveIPFS(tokenURI, true);
            if (!metadataUrl) throw new Error(`Impossible de résoudre tokenURI ${tokenId}`);

            const res = await fetch(metadataUrl);
            if (!res.ok) throw new Error(`Erreur tokenURI ${tokenId}`);

            const metadata = await res.json();

            const insectFamily = metadata.attributes?.[17]?.value || "Inconnue";
            //console.log(metadata);
            const insectlvl = metadata.attributes?.[21]?.value ?? "Inconnue";
           //console.log(metadata);

            return {
              id: tokenId.toString(),
              image: resolveIPFS(metadata.image, true) || "", // URL HTTP pour <Image />
              name: metadata.name,
              family: insectFamily,
              level : insectlvl,
            };
          } catch (err) {
            console.error("Erreur récupération token:", err);
            return null;
          }
        })
      );

      const allFamilies = insects
        .filter(Boolean)
        .map((insect): string => (insect as InsectURI).family || "Inconnue");
      setFamily(allFamilies);

      return {
        membershipValid,
        name,
        bio,
        address,
        tokens: tokens.map((t) => Number(t)),
        insects: insects.filter(Boolean) as InsectURI[],
      };
    } catch (err) {
      console.error(`Erreur récupération infos pour ${address}:`, err);
      return { membershipValid: false, name: "", bio: "", address, tokens: [], insects: [] };
    }
  };

  const InsectCard = ({ insect }: { insect: InsectURI }) => {
    const isMobile = useBreakpointValue({ base: true, md: false });

    const cardBg = useColorModeValue("brand.cream", "brand.navy");
    const borderColor = useColorModeValue("brand.navy", "brand.cream");
    const popBg = useColorModeValue("brand.cream", "brand.navy");

    const CardVisual = (
      <Box
         borderRadius="xl"
         overflow="hidden"
         bg={cardBg}
         border="1px solid"
         borderColor={borderColor}
         transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"  // ✅ bounce fluide
         _hover={{
           transform: "translateY(-6px) rotate(1deg) scale(1.08)",  // ✅ lift + rotation fun
           //boxShadow: "0 15px 40px rgba(180,166,213,0.5)",  // ✅ glow mauve
           boxShadow: "0 25px 600px rgba(238,212,132,0.4)",  // ✅ glow gold

           borderWidth: "1px",
           borderColor: "brand.gold"
         }}
         _active={{
           transform: "scale(0.95)"
         }}
         sx={{
           // ✅ Spin subtil sur hover prolongé
           "&:hover": {
             animation: "spin 0.6s ease-in-out infinite alternate"

           },
           "@keyframes spin": {
             "0%": { transform: "translateY(-6px) rotate(0deg) scale(1.08)" },
             "100%": { transform: "translateY(-6px) rotate(2deg) scale(1.08)" }
           }
         }}
       >
        <Image
          src={insect.image || "/fallback-image.png"}
          boxSize="80px"
          objectFit="cover"
        />
      </Box>
    );

    const InfoContent = (
      <Box>
        <Heading size="sm" mb={1}>
          {insect.name}
        </Heading>

        <Heading fontSize="xs" opacity={0.7} mb={2}>
          {insect.family}
        </Heading>

        <Badge colorScheme="yellow" variant="solid">
          Niveau {insect.level ?? "?"}
        </Badge>
      </Box>
    );

    if (isMobile) {
      return (
        <Popover trigger="click" placement="auto" isLazy>
          <PopoverTrigger>
            {CardVisual}
          </PopoverTrigger>
          <PopoverContent
            bg={popBg}
            border="1px solid"
            borderColor="brand.gold"
            borderRadius="xl"
            _focus={{ boxShadow: "none" }}
          >
            <PopoverBody p={4}>{InfoContent}</PopoverBody>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Tooltip
        label={InfoContent}
        hasArrow
        placement="top"
        bg={popBg}
        borderRadius="lg"
        p={3}
      >
        {CardVisual}
      </Tooltip>
    );
  };
  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 10, md: 14 }}>

      <Heading
        mb={10}
        textAlign="center"
        bgClip="text"
      >
        Derniers adhérents
      </Heading>

      {dernierAdherentsInfo.length === 0 ? (
        <Center py={20}>
          <Text opacity={0.6}>Aucun adhérent trouvé</Text>
        </Center>
      ) : (
        <Grid
          templateColumns={{
            base: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)"
          }}
          gap={8}
        >
          {dernierAdherentsInfo.map((info) => (
            <Box
              key={info.address}
              borderRadius="2xl"
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              p={6}
              transition="all 0.35s cubic-bezier(0.4, 0, 0.2, 1)"  // ✅ easing fluide
              _hover={{
                transform: "translateY(-8px) scale(1.02)",  // ✅ lift + léger zoom
                boxShadow: "0 25px 60px rgba(238,212,132,0.4)",  // ✅ glow gold
                borderColor: "brand.gold",
                background: "linear-gradient(135deg, brand.cream 0%, rgba(238,212,132,0.1) 100%)"  // ✅ shimmer
              }}
              _active={{
                transform: "translateY(-4px) scale(1.01)"
              }}
              sx={{
                // ✅ Pulse subtil au load
                animation: "pulse 2s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
                  "50%": { boxShadow: "0 8px 30px rgba(238,212,132,0.2)" }
                }
              }}
            >
              {/* HEADER */}
              <Box
                flex={1}
                mb={4}
                position="relative"
                height="140px"  // ✅ HAUTEUR TOTALE FIXE
                display="flex"
                flexDirection="column"
              >
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  noOfLines={1}
                  mb={2}
                  height="28px"  // ✅ FIXE nom
                >
                  {info.name || "Utilisateur"}
                </Text>

                <Text
                  fontSize="sm"
                  opacity={0.65}
                  noOfLines={2}
                  height="40px"  // ✅ FIXE bio (2 lignes)
                  display="flex"
                  alignItems="flex-start"
                >
                  {info.bio || "Aucune description"}
                </Text>

                <Box height="28px" mt="auto">
                  {info.membershipValid && (
                    <Badge colorScheme="green" size="sm">
                      Membre actif
                    </Badge>
                  )}
                </Box>
              </Box>



              {/* NFT GRID */}
              {info.insects.length > 0 ? (
                <SimpleGrid columns={2} spacing={3} mb={6}>
                  {info.insects.slice(0, 4).map((insect) => (
                    <InsectCard key={insect.id} insect={insect} />
                  ))}
                </SimpleGrid>
              ) : (
                <Center py={8}>
                  <Text fontSize="sm" opacity={0.5}>
                    Aucun NFT
                  </Text>
                </Center>
              )}

              {/* CTA */}
              <Button
                as={Link}
                href={`/u/${info.address}`}
                size="sm"
                w="full"
                borderRadius="full"
                fontWeight="bold"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.25)"
                }}
                _active={{ transform: "scale(0.97)" }}
                transition="all 0.2s ease"
              >
                Voir le profil
              </Button>
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );


};

export default DerniersAdherents;
