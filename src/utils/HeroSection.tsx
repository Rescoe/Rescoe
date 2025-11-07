import React, { useEffect, useState } from "react";
import { Box, Image, Text, VStack, HStack, Button, Divider, Stack, Heading } from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import Link from 'next/link';

import { useRouter } from "next/router";
import { JsonRpcProvider } from 'ethers';
import ColorOverlayBox from '@/utils/ColorOverlayBox';


// ---------------------- Types ----------------------
interface Nft {
  image: string;
  name?: string;
  artist?: string; // address 0x...
  content: {
    tokenId: string;
    mintContractAddress: string;
  };
}

interface Haiku {
  poemText: any; // proxy/array, adresse du poète attendu en [7]
  poet?: string;
  mintContractAddress: string;   // ajouté pour navigation
  uniqueIdAssociated: string;    // ajouté pour navigation
}

interface HeroSectionProps {
  nfts: Nft[];
  haikus: Haiku[];
}

// ---------------------- Composant ----------------------
const HeroSection: React.FC<HeroSectionProps> = ({ nfts, haikus }) => {
  const [selectedNft, setSelectedNft] = useState<Nft | null>(null);
  const [selectedHaiku, setSelectedHaiku] = useState<Haiku | null>(null);
  const [ensMap, setEnsMap] = useState<Record<string, string>>({});
  const [showOverlay, setShowOverlay] = useState(false);
  const router = useRouter();
  const [showCollections, setShowCollections] = useState(false);

  const MotionChevron = motion(ChevronDownIcon);


  // ---------------------- Helpers ----------------------
  const formatAddress = (address?: string) => {
    if (!address) return "Adresse inconnue";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const resolveName = (address?: string, unknownLabel = "Inconnu") => {
    if (!address) return unknownLabel;
    const key = address.toLowerCase();
    return ensMap[key] ?? formatAddress(address);
  };

  const fetchENSForAddresses = async (addresses: string[]) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const newMap: Record<string, string> = {};

    await Promise.all(addresses.map(async (addr) => {
      try {
        const name = await provider.lookupAddress(addr);
        newMap[addr.toLowerCase()] = name || formatAddress(addr);
      } catch {
        newMap[addr.toLowerCase()] = formatAddress(addr);
      }
    }));

    setEnsMap(prev => ({ ...prev, ...newMap }));
  };

  const getPoemText = (poemText: any) => {
    if (Array.isArray(poemText) && poemText.length > 6) return poemText[6];
    if (typeof poemText === "string") return poemText;
    return "Texte introuvable";
  };

  // ---------------------- Sélection aléatoire ----------------------
  useEffect(() => {
    if (nfts.length === 0 || haikus.length === 0) return;

    const randomNft = nfts[Math.floor(Math.random() * nfts.length)];
    const randomHaiku = haikus[Math.floor(Math.random() * haikus.length)];

    setSelectedNft(randomNft);
    setSelectedHaiku(randomHaiku);

    const addrs: string[] = [];
    if (randomNft.artist) addrs.push(randomNft.artist);
    const poetAddr = randomHaiku?.poemText?.[7];
    if (typeof poetAddr === "string" && poetAddr.startsWith("0x")) addrs.push(poetAddr);

    fetchENSForAddresses(addrs);
  }, [nfts, haikus]);

  // ---------------------- Navigation ----------------------
  const handleNavigatePoem = () => {
    if (selectedHaiku) {
      router.push(`/poemsId/${selectedHaiku.mintContractAddress}/${selectedHaiku.uniqueIdAssociated}`);
    }
    setShowOverlay(false);
  };

  const handleNavigateNft = () => {

    if (selectedNft) {
      router.push(`/oeuvresId/${selectedNft.content.mintContractAddress}/${selectedNft.content.tokenId}`);
    }
    setShowOverlay(false);
  };

  const handleOverlayClick = () => setShowOverlay(prev => !prev);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start" // start au lieu de center
      w="100%"
      maxW="100%"
      pb={{ base: "2rem", md: "3rem" }} // padding plus raisonnable
      overflow="hidden"
    >

        {selectedNft && selectedHaiku && (
          <>
          <Box
            position="relative"
            w={{ base: "95%", md: "80%", lg: "70%" }}  // largeur responsive
            h={{ base: "350px", md: "450px", lg: "550px" }} // hauteur responsive
            mx="auto" // centre horizontalement
            borderRadius="md"
            cursor="pointer"
            onClick={handleOverlayClick}
          >
              <Image
                src={selectedNft.image}
                alt={selectedNft.name || "NFT"}
                objectFit="cover"
                w="100%"
                h="100%"
                borderRadius="md"
              />

              {/* Poème overlay */}

              <Box
                position="absolute"
                top="0"
                left="0"
                w="100%"
                h="100%"
                display="flex"
                justifyContent="center"
                alignItems="center"
                zIndex={1}
              >
              <ColorOverlayBox imageUrl={selectedNft.image}>

                <VStack spacing={2} textAlign="center" maxW="80%" mx="auto" px={2} bg="rgba(0, 0, 0, 0.1)" >
                  {getPoemText(selectedHaiku.poemText)
                    ?.split("\n")
                    .map((line: string, i: number) => (
                      <Text
                        key={i}
                        fontStyle="italic"
                        fontSize={{ base: "lg", md: "2xl" }} // taille augmentée
                        lineHeight="1.8" // un peu plus espacé
                        fontWeight="bold" // texte plus épais
                        whiteSpace="pre-wrap"
                        wordBreak="break-word"

                      >
                        {line}
                      </Text>
                  ))}
                </VStack>
                </ColorOverlayBox>

              </Box>

              {/* Overlay pour la sélection des actions */}
              {showOverlay && (
                <Box
                  position="absolute" // Overlay positionné au-dessus de tout dans le composant
                  top="85%" // Position verticale de l'overlay
                  left="50%"
                  transform="translate(-50%, -50%)" // Centrage de l'overlay
                  w="80%" // Largeur de l'overlay
                  p={4}
                  borderRadius="md"
                  boxShadow="md"
                  zIndex={2} // Plus élevé que l'overlay du poème
                >
                  <Text fontSize="l" mb={4}>
                    Que voulez-vous faire ?
                  </Text>

                  <HStack spacing={4} justifyContent="center">
                    <Button
                      colorScheme="white"
                      onClick={() => {
                        handleNavigatePoem();
                        handleOverlayClick();
                      }}
                    >
                      Voir le poème
                    </Button>

                    <Button
                      colorScheme="white"
                      onClick={() => {
                        handleNavigateNft();
                        handleOverlayClick();
                      }}
                    >
                      Voir le NFT
                    </Button>
                  </HStack>
                </Box>
              )}
            </Box>

            <HStack spacing={4} mt={4} align="start" flexDirection="column">
              <Box>
                <Text fontWeight="bold" fontSize="md">
                  Œuvre :{" "}
                  <Text as="span" fontWeight="normal">
                    {selectedNft.name || "Sans nom"}
                  </Text>
                </Text>
                {selectedNft.artist && (
                  <Link href={`/u/${selectedNft.artist}`} passHref>
                    <Text
                      as="a"
                      fontStyle="italic"
                      fontSize="sm"
                      _hover={{ textDecoration: "underline" }}
                    >
                      {resolveName(selectedNft.artist, "Artiste inconnu")}
                    </Text>
                  </Link>
                )}
              </Box>


              <Box>
                <Text fontWeight="bold" fontSize="md">
                  Poème :{" "}
                </Text>
                    {selectedHaiku.poemText?.[7] && (
                      <Link href={`/u/${selectedHaiku.poemText[7]}`} passHref>
                        <Text
                          as="a"
                          fontStyle="italic"
                          fontSize="sm"
                          _hover={{ textDecoration: "underline" }}
                        >
                          {resolveName(selectedHaiku.poemText[7], "Poète inconnu")}
                        </Text>
                      </Link>
                    )}
              </Box>
            </HStack>
          </>
        )}
      </Box>
    );
  };

  export default HeroSection;
