import React from 'react';

const TextCard = ({ nft }) => {
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
        {/* Affichage du texte du haiku */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>
          {nft.poemText}
        </h2>

        {/* Affichage du créateur */}
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
          <strong>Créateur :</strong> {nft.creatorAddress}
        </p>

        {/* Affichage du nombre d'éditions */}
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
          <strong>Nombre d'éditions :</strong> {nft.totalEditions}
        </p>

        {/* Affichage du prix */}
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '10px' }}>
          <strong>Prix :</strong> {nft.price} ETH
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
    </div>
  );
};

export default TextCard;
