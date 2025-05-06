import React, { useState } from 'react';
import { VStack, Text } from '@chakra-ui/react';


interface TextCardProps {
  nft: {
    poemText: string;
    creatorAddress: string;
    totalEditions: string;
    price: string;
    mintContractAddress: string;
    image?: string; // image est optionnel
  };
}

const TextCard: React.FC<TextCardProps> = ({ nft }) => {
  // État pour contrôler l'affichage des informations supplémentaires
  const [showDetails, setShowDetails] = useState(false);
  const priceInEth = parseFloat(nft.price) / 1e18;


  // Fonction pour basculer l'affichage des détails
  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // Laisse la hauteur flexible
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        padding: '10px',
      }}
    >
    <div style={{ padding: '10px', textAlign: 'center' }}>
      {/* Affichage du texte du poème avec des retours à la ligne */}
      <VStack textAlign="center" color="white" maxWidth="120%">
        {nft.poemText
          ? nft.poemText.split("\n").map((line, i) => (
              <Text key={i} fontStyle="italic" fontSize="sm"> {/* Texte plus petit */}
                {line}
              </Text>
            ))
          : "Pas de poème disponible"}
      </VStack>

        {/* Affichage du prix */}
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
          <strong>Prix :</strong> {priceInEth} ETH
        </p>

        {/* Affichage de la disponibilité */}
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
          <strong>Disponibilité :</strong> {nft.totalEditions} éditions
        </p>

        {/* Bouton pour afficher/cacher plus d'informations */}
        <button onClick={toggleDetails} style={{ marginTop: '10px' }}>
          {showDetails ? 'Moins' : 'Plus'}
        </button>

        {/* Affichage des détails supplémentaires si showDetails est vrai */}
        {showDetails && (
          <div style={{ marginTop: '10px' }}>
            {/* Affichage du créateur */}
            <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
              <strong>Créateur :</strong> {nft.creatorAddress}
            </p>

            {/* Affichage de l'adresse du contrat de mint */}
            <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
              <strong>Contrat de Mint :</strong> {nft.mintContractAddress}
            </p>

            {/* Affichage de l'image associée si disponible */}
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
        )}
      </div>
    </div>
  );
};

export default TextCard;
