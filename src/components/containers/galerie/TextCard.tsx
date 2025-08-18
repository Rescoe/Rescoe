import React from "react";
import { VStack, Text, Button } from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import { useRouter } from 'next/router';

interface TextCardProps {
  nft: {
    tokenId: string;
    poemText: string;
    creatorAddress: string;
    totalEditions: string;
    price: string;
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
  const priceInEth = nft.price ? parseFloat(nft.price) / 1e18 : 0;
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
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: "10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        padding: "10px",
        backgroundColor: "#1a202c",
      }}
    >
      {/* Texte du poème */}
      <VStack textAlign="center" color="white" maxWidth="120%">
        {nft.poemText
          ? nft.poemText.split("\n").map((line, i) => (
              <Text key={i} fontStyle="italic" fontSize="sm">
                {line}
              </Text>
            ))
          : "Pas de poème disponible"}
      </VStack>

      {/* Prix */}
      <p style={{ fontSize: "1rem", color: "#ccc", marginTop: "10px" }}>
        <strong>Prix :</strong> {priceInEth} ETH
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

    </div>
  );
};

export default TextCard;
