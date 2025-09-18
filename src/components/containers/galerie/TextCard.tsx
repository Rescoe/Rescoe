import React from "react";
import { VStack, Text, Button, Box } from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import { useRouter } from 'next/router';
import { FramedText } from '../../../utils/Cadre';
import useEthToEur from "../../../hooks/useEuro";



interface TextCardProps {
  nft: {
    tokenId: string;
    poemText: string;
    creatorAddress: string;
    totalEditions: string;
    price: string;
    priceEur: string;   // prix en EUR
    mintContractAddress: string;
    totalMinted: string;
    availableEditions: string;
    isForSale: boolean;
    tokenIdsForSale?: number[]; // Optionnel
  };
  showBuyButton?: boolean;
  onBuy: (tokenId: string) => void;
}

const TextCard: React.FC<TextCardProps> = ({
  nft,
  showBuyButton = false,
  onBuy,
}) => {
  const { address: authAddress, connectWallet } = useAuth();

  if (!nft) {
    return <Text>Chargement du NFT...</Text>;
  }

  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();

  const priceInEth = nft.price ? parseFloat(nft.price) / 1e18 : 0;

  const priceEur = convertEthToEur(priceInEth);

  const isOwner = authAddress?.toLowerCase() === nft.creatorAddress.toLowerCase();
  const router = useRouter();



  const handleBuy = async (tokenId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authAddress) {
      await connectWallet();
    }
    if (authAddress) {
      onBuy(tokenId);
    }
  };

  return (
    <Box // Peut-être optez pour un style flex si nécessaire
      textAlign="center"
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      position="relative"
      display="inline-block" // largeur adaptée au contenu
      maxWidth="90%" // pas trop large sur les grands écrans
      margin="20px auto" // centrer le cadre
      padding="4px"

    >
    <FramedText>

      {/* Texte du poème 1 */}
      <VStack textAlign="center" color="black" maxWidth="120%">
        {nft.poemText
          ? nft.poemText.split("\n").map((line, i) => (
              <Text key={i} fontStyle="italic" fontSize="sm">
                {line}
              </Text>
            ))
          : "Pas de poème disponible"}
      </VStack>


      </FramedText>

      {/* Prix */}
      <p style={{ fontSize: "1rem", color: "#ccc", marginTop: "10px" }}>
        <strong>Prix :</strong> {priceInEth} ETH
        {priceEur !== null && priceEur !== undefined && ` (~${priceEur} €)`}

      </p>

      {/* Disponibilité */}
      <p style={{ fontSize: "1rem", color: "#ccc", marginBottom: "10px" }}>
        <strong>Disponibilité :</strong>{" "}
        {nft.availableEditions !== undefined
          ? `${nft.availableEditions} / ${nft.totalEditions} éditions`
          : "loading..."}
      </p>

      {/* Bouton achat */}
      {showBuyButton && nft.tokenIdsForSale && nft.tokenIdsForSale.length > 0 ? (
  <Button
    onClick={(e) => handleBuy(nft.tokenIdsForSale![0].toString(), e)} // Utilisation du "non-null assertion operator" !
    colorScheme="teal"
    size="sm"
  >
    Acheter
  </Button>
) : (
  showBuyButton && nft.availableEditions && nft.tokenIdsForSale?.length === 0 && (
    <Text color="red.300" fontSize="sm">
      Plus aucune édition en vente
    </Text>
  )
)}

      {isOwner && (
        <Text color="orange.300" fontSize="sm">
          Vous êtes le créateur de ce poème
        </Text>
      )}

      <Button
        onClick={() => router.push(`/poemsId/${nft.mintContractAddress}/${nft.tokenId}`)}
        border="1px solid gray"
        borderRadius="md"
        p={4}
        colorScheme="gray" // optionnel pour style
      >
        Aller au poème
      </Button>

</Box>
  );
};

export default TextCard;
