import React from 'react';
import { Box, Text, Image } from '@chakra-ui/react';
import { FaArtstation, FaFeather, FaCode } from 'react-icons/fa'; // Importez vos icônes

interface Collection {
    id: string;
    name: string;
    imageUrl: string;
    mintContractAddress: string;
    creator: string;
}

interface CollectionCardProps {
    collection: Collection;
    type: string; // Ajoutez un prop pour le type
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection, type }) => {
    // Déterminez l'icône à afficher en fonction du type de collection
    const renderIcon = () => {
        switch (type) {
            case 'Art':
                return <FaArtstation style={{ marginRight: '8px' }} />;
            case 'Poesie':
                return <FaFeather style={{ marginRight: '8px' }} />;
            case 'Generative':
                  return <FaCode style={{ marginRight: '8px' }} />;
            default:
                return null; // Pas d'icône par défaut
        }
    };

    return (
      <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        p={3}
        m="0 5px"
        w="150px"
        cursor="pointer"
        _hover={{ boxShadow: 'md',transition: '0.2s' }}
      >

            <Box height="150px" overflow="hidden">
                <Image
                    src={collection.imageUrl}
                    alt={collection.name}
                    objectFit="cover"
                    width="100%"
                    height="100%"
                />
            </Box>
            <Box display="flex" alignItems="center" mt={2}>
                {renderIcon()} {/* Affichage de l'icône ici */}
                <Text fontWeight="bold" fontSize="lg">{collection.name}</Text>
            </Box>
        </Box>
    );
};

export default CollectionCard;
