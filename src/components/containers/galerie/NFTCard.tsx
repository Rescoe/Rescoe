import React from "react";
import { useAuth } from '../../../utils/authContext';
import { resolveIPFS } from "@/utils/resolveIPFS";

interface NFT {
  owner: string;
  tokenId: string;
  image: string;
  name: string;
  description: string;
  forSale: boolean;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

interface NFTCardProps {
  nft: NFT;
  buyNFT?: (nft: NFT) => void;
  isForSale: boolean;
  proprietaire: string;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, buyNFT }) => {
  const { address: authAddress, connectWallet } = useAuth();

  const isForSaleLocal = nft.forSale;
  const isOwner = authAddress && authAddress.toLowerCase() === nft.owner.toLowerCase();
  const canPurchase = !isOwner && isForSaleLocal;
  const imageSrc = resolveIPFS(nft.image, true) || '/fallback-nft.png';

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        background: "white",
        position: "relative"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-8px)";
        e.currentTarget.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.08)";
      }}
    >
      {/* Image Hero */}
      <div style={{
        flex: 1,
        minHeight: "240px",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
      }}>
        <img
          src={imageSrc}
          alt={nft.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "transform 0.4s ease",
            filter: "brightness(1.05)"
          }}
          onError={(e) => { (e.target as HTMLImageElement).src = '/fallback-nft.png'; }}
          onLoad={(e) => { (e.target as HTMLImageElement).style.transform = "scale(1.08)"; }}
        />

        {/* Status Badge */}
        <div style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: canPurchase
            ? "linear-gradient(135deg, #10b981, #059669)"
            : isOwner
            ? "linear-gradient(135deg, #f59e0b, #d97706)"
            : "#6b7280",
          color: "white",
          padding: "6px 12px",
          borderRadius: "24px",
          fontSize: "13px",
          fontWeight: "700",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          backdropFilter: "blur(10px)"
        }}>
          {canPurchase ? "À vendre" : isOwner ? "Propriétaire" : "Vendu"}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px", flexShrink: 0 }}>
        {/* Titre + Token ID */}
        <div style={{ marginBottom: "12px" }}>
          <h2 style={{
            fontSize: "1.25rem",
            fontWeight: "800",
            margin: "0 0 4px 0",
            color: "#1e293b",
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}>
            {nft.name}
          </h2>
          <div style={{
            fontSize: "0.75rem",
            color: "#64748b",
            fontWeight: "500"
          }}>
            #{nft.tokenId.padStart(4, '0')}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: "0.875rem",
          color: "#475569",
          marginBottom: "16px",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden"
        }}>
          {nft.description || "Œuvre unique de la collection."}
        </p>

        {/* Prix & Action */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          gap: "12px"
        }}>
          {canPurchase ? (
            <>
              <div>
                <span style={{
                  fontSize: "1.5rem",
                  fontWeight: "900",
                  color: "#059669",
                  lineHeight: 1
                }}>
                  {nft.price.toFixed(4)}
                </span>
                <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: "600" }}>
                  ETH
                </span>
              </div>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!authAddress) await connectWallet();
                  else buyNFT?.(nft);
                }}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "0.95rem",
                  boxShadow: "0 8px 24px rgba(16, 185, 129, 0.4)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  minWidth: "100px",
                  textAlign: "center"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 12px 32px rgba(16, 185, 129, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(16, 185, 129, 0.4)";
                }}
              >
                Acheter
              </button>
            </>
          ) : (
            <div style={{
              width: "100%",
              textAlign: "center",
              padding: "12px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "1rem"
            }}>
              {isOwner ? (
                <span style={{
                  color: "#d97706",
                  background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                  padding: "8px 16px"
                }}>
                  🎨 Votre œuvre
                </span>
              ) : (
                <span style={{
                  color: "#6b7280",
                  background: "#f1f5f9",
                  padding: "8px 16px"
                }}>
                  Indisponible
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tags */}
        {nft.tags?.length > 0 && (
          <div style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap"
          }}>
            {nft.tags.slice(0, 4).map((tag, i) => (
              <span
                key={i}
                style={{
                  fontSize: "0.75rem",
                  color: "#475569",
                  background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
                  padding: "4px 10px",
                  borderRadius: "16px",
                  fontWeight: "600",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTCard;
