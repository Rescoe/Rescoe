import { useEffect, useState } from "react";
import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { Contract, JsonRpcProvider } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";

type CollectionOnChain = {
  id: string;
  name: string;
  collectionType: string;
  creator: string;
  mintContractAddress: string;
  imageUrl?: string;
  uri: string;
};

const CollectionsVignettes: React.FC<{ creator: string }> = ({ creator }) => {
  const [collections, setCollections] = useState<CollectionOnChain[]>([]);
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
  const contract = new Contract(
    process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!,
    ABIRESCOLLECTION,
    provider
  );

  useEffect(() => {
    const fetchCollections = async () => {
      if (!creator) return;
      try {
        const allCollections: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
        // on ne garde que les 5 dernières
        const lastCollections = [...allCollections].slice(-2).reverse(); // 5 dernières
        setCollections(lastCollections);

        // fetch metadata pour récupérer l'image
        const collectionsWithImages = await Promise.all(
          lastCollections.map(async (col) => {
            let uri = col.uri;
            if (!uri) {
              uri = await contract.getCollectionURI(col.id.toString());
            }
            const ipfsHash = uri?.split("/").pop();
            if (!ipfsHash) return col;
            const res = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
            if (!res.ok) return col;
            const metadata = await res.json();
            return { ...col, imageUrl: metadata.image || "" };
          })
        );

        setCollections(collectionsWithImages);

      } catch (err) {
        console.error("Erreur fetchCollections", err);
      }
    };

    fetchCollections();
  }, [creator]);

  if (collections.length === 0) return null;

  return (
    <Flex mt={2} gap={2} wrap="wrap">
      {collections.map((col) => (
        <Flex
          key={col.id}
          direction="column"
          align="center"
          w="40px"
        >
          <Box
            w="40px"
            h="40px"
            borderRadius="8px"
            overflow="hidden"
            border="1px solid #555"
          >
            {col.imageUrl && (
              <Image
                src={col.imageUrl}
                alt={col.name}
                objectFit="cover"
                w="100%"
                h="100%"
              />
            )}
          </Box>
          {/*
          <Text
            fontSize="xs"
            mt={1}
            textAlign="center"
            noOfLines={1} // tronque si trop long
            title={col.name} // tooltip si le nom est tronqué
          >
            {col.name}
          </Text>
          */}
        </Flex>
      ))}
    </Flex>


  );

};

export default CollectionsVignettes;
