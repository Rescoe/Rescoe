import React from 'react';
import { VStack, Text, Button, Divider, Grid } from '@chakra-ui/react';
import { useAuth } from '../../../utils/authContext';

interface TextCardProps {
  nft: {
    tokenId: string;
    poemText: string;
    creatorAddress: string;
    totalEditions: string;
    price: string;
    mintContractAddress: string;
    image?: string;
    totalMinted: string;
    availableEditions?: string;
    isForSale: boolean;
  };
  showBuyButton?: boolean;
  onBuy: (tokenId: string) => void;
  tokenIdsForSale: number[]; // inclure cette prop

}

const TextCard: React.FC<TextCardProps> = ({ nft, showBuyButton = false, onBuy, tokenIdsForSale }) => {
  const { address: authAddress, connectWallet } = useAuth();
  const isOwner = authAddress?.toLowerCase() === nft.creatorAddress.toLowerCase();
  const priceInEth = nft?.price ? parseFloat(nft.price) / 1e18 : 0;

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
        border: '1px solid #ccc',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        padding: '10px',
        backgroundColor: '#1a202c',
      }}
    >
      <VStack textAlign="center" color="white" maxWidth="120%">
        {nft.poemText
          ? nft.poemText.split('\n').map((line, i) => (
              <Text key={i} fontStyle="italic" fontSize="sm">
                {line}
              </Text>
            ))
          : 'Pas de poème disponible'}
      </VStack>

      <p style={{ fontSize: '1rem', color: '#ccc', marginTop: '10px' }}>
        <strong>Prix :</strong> {priceInEth} ETH
      </p>

      <p style={{ fontSize: '1rem', color: '#ccc', marginBottom: '10px' }}>
        <strong>Disponibilité :</strong> {nft.availableEditions || 0} / {nft.totalEditions} éditions
      </p>

      {showBuyButton && tokenIdsForSale && (
        <Grid templateColumns="repeat(auto-fit, minmax(100px, 1fr))" gap={2}>
          {tokenIdsForSale.map((tokenId) => (
            <Button key={tokenId} onClick={(e) => handleBuy(tokenId.toString(), e)} colorScheme="teal" size="sm">
              Acheter #{tokenId}
            </Button>
          ))}
        </Grid>
      )}



      <Divider mt={3} />

      <div style={{ marginTop: '10px' }}>
        <p style={{ fontSize: '1rem', color: '#aaa', marginBottom: '10px' }}>
          <strong>Créateur :</strong> {nft.creatorAddress}
        </p>
        <p style={{ fontSize: '1rem', color: '#aaa', marginBottom: '10px' }}>
          <strong>Contrat de Mint :</strong> {nft.mintContractAddress}
        </p>
        {nft.image && (
          <img
            src={nft.image}
            alt="Poème"
            style={{
              width: '100%',
              marginTop: '10px',
              borderRadius: '8px',
              maxHeight: '200px',
              objectFit: 'cover',
            }}
          />
        )}
      </div>
    </div>
  );
};

export default TextCard;
