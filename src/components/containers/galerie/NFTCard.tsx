import React from "react";

interface NFT {
  tokenId: string;
  image: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

interface NFTCardProps {
  nft: NFT;
  buyNFT?: (nft: NFT) => void; // Fonction optionnelle pour acheter un NFT
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, buyNFT }) => {
  const isForSale = nft.price > 0;

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
      {/* Image avec objectFit pour garantir un bon redimensionnement */}
      <div style={{ flex: 1, width: "100%", overflow: "hidden" }}>
        <img
          src={nft.image}
          alt={nft.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover", // Recadrage pour s'assurer que l'image couvre l'espace
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
          {isForSale ? (
            <>
              <span style={{ fontSize: "1rem", fontWeight: "bold" }}>
                {nft.price} ETH
              </span>
              {buyNFT && (
                <button
                  onClick={() => buyNFT(nft)}
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
