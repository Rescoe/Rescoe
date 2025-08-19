import React from 'react';
import { Box, Text, Image, Stack } from '@chakra-ui/react';
import { FaArtstation, FaFeather, FaCode } from 'react-icons/fa';

interface Collection {
    id: string;
    name: string;
    imageUrl: string;
    mintContractAddress: string;
    creator: string;
}

interface CollectionCardProps {
    collection: Collection;
    type: string;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection, type }) => {
    const renderIcon = () => {
        switch (type) {
            case 'Art':
                return <FaArtstation style={{ marginRight: '8px' }} />;
            case 'Poesie':
                return <FaFeather style={{ marginRight: '8px' }} />;
            case 'Generative':
                return <FaCode style={{ marginRight: '8px' }} />;
            default:
                return null;
        }
    };

    return (
      <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        p={3}
        m={2} // Adjusted margin to ensure spacing works well on mobile
        w={{ base: "90%", md: "150px" }} // Use 90% width on mobile for flexibility
        maxW="150px" // Max width ensures uniformity
        cursor="pointer"
        _hover={{ boxShadow: 'lg', transition: '0.2s' }} // Enhanced box shadow on hover
        boxShadow="sm" // Default box shadow
      >
        <Box height={{ base: "120px", md: "150px" }} overflow="hidden">
            <Image
                src={collection.imageUrl}
                alt={collection.name}
                objectFit="cover"
                width="100%"
                height="100%"
                fallbackSrc="https://via.placeholder.com/150" // Fallback in case of an error
            />
        </Box>
        <Stack spacing={1} mt={2} align="center"> {/* Stack for better vertical spacing */}
            <Box display="flex" alignItems="center">
                {renderIcon()}
                <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }} noOfLines={1}>{collection.name}</Text>
            </Box>
        </Stack>
      </Box>
    );
};

export default CollectionCard;
