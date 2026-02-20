import React from 'react';
import { Box, Text, Image, Stack, Icon, Badge, HStack } from '@chakra-ui/react';
import { FaArtstation, FaFeather, FaCode } from 'react-icons/fa';
import { resolveIPFS } from "@/utils/resolveIPFS";

interface Collection {
    id: string;
    name: string;
    imageUrl: string;
    mintContractAddress: string;
    creator: string;
    isFeatured?: boolean;
}

interface CollectionCardProps {
    collection: Collection;
    type: string;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection, type }) => {
    const renderIcon = () => {
        switch (type) {
            case 'Art': return <Icon as={FaArtstation} boxSize={4} color="blue.500" />;
            case 'Poesie': return <Icon as={FaFeather} boxSize={4} color="purple.500" />;
            case 'Generative': return <Icon as={FaCode} boxSize={4} color="green.500" />;
            default: return null;
        }
    };

    return (
      <Box
        borderWidth="1px"
        borderRadius="xl"
        overflow="hidden"
        p={4}
        m={2}
        w={{ base: "90%", md: "180px" }}
        maxW="200px"
        cursor="pointer"
        _hover={{
          boxShadow: 'xl',
          transform: 'translateY(-4px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        boxShadow="md"
        transition="all 0.3s"
        position="relative"
        height="full"
        display="flex"
        flexDirection="column"
      >
        {/* Featured Badge */}
        {collection.isFeatured && (
          <Badge
            position="absolute"
            top={2}
            right={2}
            colorScheme="yellow"
            boxShadow="sm"
          >
            ⭐
          </Badge>
        )}

        {/* Image */}
        <Box
          flex={1}
          minH={{ base: "140px", md: "160px" }}
          overflow="hidden"
          position="relative"
          mb={3}
        >
          <Image
            src={resolveIPFS(collection.imageUrl, true) || "https://via.placeholder.com/200x200"}
            alt={collection.name}
            objectFit="cover"
            width="100%"
            height="100%"
            transition="transform 0.4s ease"
            _hover={{ transform: "scale(1.05)" }}
            fallbackSrc="https://via.placeholder.com/200x200/eee/999?text=?"
          />
        </Box>

        {/* Content */}
        <Stack spacing={2} flex={1} justify="flex-end">
          <HStack spacing={2} align="center">
            {renderIcon()}
            <Text
              fontWeight="bold"
              fontSize={{ base: "sm", md: "md" }}
              noOfLines={1}
              flex={1}
              title={collection.name} // Tooltip complet
            >
              {collection.name}
            </Text>
          </HStack>

          <Text
            fontSize="xs"
            color="gray.600"
            noOfLines={1}
            textAlign="center"
          >
            {collection.creator.slice(0, 12)}...
          </Text>

          <Badge
            colorScheme="blue"
            fontSize="xs"
            alignSelf="center"
            variant="outline"
          >
            {collection.id}
          </Badge>
        </Stack>
      </Box>
    );
};

export default CollectionCard;
