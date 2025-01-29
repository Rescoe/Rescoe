import React, { useState, useEffect } from "react";
import { Box, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";

const GridLayout = ({ nfts, haikus }) => {
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const alternateItems = [];
    const maxLength = Math.max(nfts.length, haikus.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < haikus.length) {
        alternateItems.push({
          type: "haiku",
          content: haikus[i].poemText, // Haiku text
          associatedNft: nfts[i % nfts.length], // Associe avec un NFT
        });
      }
      if (i < nfts.length) {
        alternateItems.push({
          type: "nft",
          content: nfts[i], // Directement l'objet NFT
          associatedHaiku: haikus[i % haikus.length]?.poemText, // Associe avec un Haiku
        });
      }
    }

    setItems(alternateItems);
  }, [nfts, haikus]);

  const moveToIndex = (newIndex) => {
    setIndex(newIndex % items.length);
  };

  const handleClick = (item) => {
    if (item?.type === "nft") {
      const nftId = item.content.id;
      router.push(`/tokenId/${Achanger}/${nftId}`);
    } else if (item?.type === "haiku") {
      // Ajouter action pour haiku
    }
  };

  const renderContent = (item) => {
    if (item.type === "haiku") {
      return (
        <Box
          position="relative"
          w="100%"
          h="100%"
          borderRadius="md"
          cursor="pointer"
          onMouseEnter={() => setHoveredItem(item)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Box
            bg="rgba(0, 0, 0, 0.5)"
            color="white"
            p={4}
            borderRadius="md"
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >
            <Text fontStyle="italic" textAlign="center">
              {item.content}
            </Text>
          </Box>

          {hoveredItem?.type === "haiku" && hoveredItem.content === item.content && (
            <Box
              position="absolute"
              top="0"
              left="0"
              w="100%"
              h="100%"
              display="flex"
              justifyContent="center"
              alignItems="center"
              zIndex="2"
            >
              <Image
                src={item.associatedNft?.image} // Affiche l'image associée au haiku
                alt={item.associatedNft?.name || "NFT"}
                objectFit="cover"
                w="100%"
                h="100%"
                borderRadius="md"
                opacity={0.3}  // Image translucide pour l'effet de superposition
              />
            </Box>
          )}
        </Box>
      );
    } else if (item.type === "nft") {
      return (
        <Box
          position="relative"
          w="100%"
          h="100%"
          borderRadius="md"
          cursor="pointer"
          onMouseEnter={() => setHoveredItem(item)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Image
            src={item.content.image} // Accède directement à l'image du NFT
            alt={item.content.name || "NFT"}
            objectFit="cover"
            w="100%"
            h="100%"
            borderRadius="md"
            opacity={hoveredItem?.type === "nft" && hoveredItem.content === item.content ? 0.7 : 1}
          />

          {hoveredItem?.type === "nft" && hoveredItem.content === item.content && (
            <Box
              position="absolute"
              top="0"
              left="0"
              w="100%"
              h="100%"
              bg="rgba(0, 0, 0, 0.5)"
              display="flex"
              justifyContent="center"
              alignItems="center"
              zIndex="2"
            >
              <Text
                fontStyle="italic"
                fontSize="lg"
                textAlign="center"
                color="white"
                maxWidth="80%"
              >
                {item.associatedHaiku}  {/* Affiche le haiku associé */}
              </Text>
            </Box>
          )}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box position="relative" p={4} w="100%" h="600px">
      <Box
        display="grid"
        gridTemplateColumns="repeat(4, 1fr)"
        gridTemplateRows="repeat(3, 1fr)"
        gap={4}
        h="100%"
      >
        {[{ column: "1 / span 3", row: "1", offset: -1 },
          { column: "4 / span 1", row: "1", offset: 1 },
          { column: "1 / span 1", row: "2 / span 2", offset: -2 },
          { column: "2 / span 2", row: "2", offset: 0 },
          { column: "2 / span 3", row: "3", offset: 2 }].map(({ column, row, offset }, i) => (
          <Box
            key={i}
            gridColumn={column}
            gridRow={row}
            p={2}
            alignItems="left"
            cursor="pointer"
            minWidth="150px"
            minHeight="150px"
            width="100%"
            height="100%"
            position="relative"
            onClick={() => {
              moveToIndex((index + offset + items.length) % items.length);
              if (column === "2 / span 2" && row === "2") {
                handleClick(items[(index + offset + items.length) % items.length]);
              }
            }}
          >
            {items.length > 0 && renderContent(items[(index + offset + items.length) % items.length])}
          </Box>
        ))}

        {items.length > 0 && (
          <Box
            gridColumn="4 / span 1"
            gridRow="2"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            p={2}
            borderRadius="md"
            boxShadow="md"
            bg="rgba(0, 0, 0, 0.7)"
            color="white"
          >
            {items[index].type === "haiku" ? (
              <>
                <Text fontWeight="bold" mb={2}>
                  {items[index]?.content.artist || "Poète inconnu"}
                </Text>
                <Text fontStyle="italic">{items[index]?.content.title || "Titre du haiku"}</Text>
              </>
            ) : items[index].type === "nft" ? (
              <>
                <Text fontWeight="bold" mb={2}>
                  {items[index]?.content.artist || "Artiste inconnu"}
                </Text>
                <Text>{items[index]?.content.name || "Nom de l'œuvre"}</Text>
              </>
            ) : (
              <Text>{items[index]?.content.artist || "Parfois, un poème est un NFT."}</Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GridLayout;
