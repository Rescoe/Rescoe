import React from "react";

import { useAuth } from '../../../utils/authContext';


interface NFT {
  owner: string;
  tokenId: string;
  image: string;
  name: string;
  description: string;
  forSale:boolean;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

interface NFTCardProps {
  nft: NFT;
  buyNFT?: (nft: NFT) => void; // Fonction optionnelle pour acheter un NFT
  isForSale: boolean; // Ajouter isForSale
  proprietaire: string;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, buyNFT }) => {
  const { address: authAddress } = useAuth();

  const isForSale = nft.forSale;

  const isOwner = authAddress && authAddress.toLowerCase() === nft.owner.toLowerCase();
  const canPurchase = !isOwner && isForSale; // L'utilisateur ne doit pas être le propriétaire et le NFT doit être en vente


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
      }}
    >
      <div style={{ flex: 1, width: "100%", overflow: "hidden" }}>
        <img
          src={nft.image}
          alt={nft.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      <div style={{ padding: "10px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "5px" }}>
          {nft.name}
        </h2>

        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "10px" }}>
          {nft.description}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {canPurchase ? (
            <>
              <span style={{ fontSize: "1rem", fontWeight: "bold" }}>
                {nft.price} ETH
              </span>
              {buyNFT && (
                <button
                  onClick={() => buyNFT(nft)} // Appel de la fonction buyNFT avec le NFT
                  style={{
                    backgroundColor: "#008CBA",
                    color: "white",
                    padding: "5px 10px",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Acheter
                </button>
              )}
            </>
          ) : isOwner ? ( // Vérifiez si l'utilisateur est le propriétaire
            <span style={{ fontSize: "1rem", color: "#999" }}>
              Vous êtes propriétaire de cette œuvre
            </span>
          ) : (
            <span style={{ fontSize: "1rem", color: "#999" }}>
              Non disponible à la vente
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export default NFTCard;
