import { IconType } from 'react-icons';  // Import IconType de react-icons
import { Icon, ChevronRightIcon } from '@chakra-ui/icons';
import { useColorModeValue, Stack, Flex, Box, Text, Link } from '@chakra-ui/react';
import NextLink from 'next/link';

export interface ISubNav {
  label: string;
  subLabel?: string;
  icon?: IconType;  // Remplacement de `logo` par `icon`
  href?: string;
  children?: Array<ISubNav>;
  requiresAuth?: boolean; // Ajout de requiresAuth comme propriété facultative

}

const SubNav = ({ label, href, subLabel, icon }: ISubNav) => {
  return (
    <NextLink href={href || '#'} legacyBehavior>
      <Link
        role={'group'}
        display={'block'}
        p={2}
        rounded={'md'}
        _hover={{ bg: useColorModeValue('green.50', 'gray.900') }}
      >
        <Stack direction={'row'} align={'center'}>
          {/* Affiche l'icône s'il est fourni */}
          {icon && <Icon as={icon} boxSize={5} color="green.400" />}
          <Box>
            <Text transition={'all .3s ease'} _groupHover={{ color: 'green.400' }} fontWeight={500}>
              {label}
            </Text>
            <Text fontSize={'sm'}>{subLabel}</Text>
          </Box>
          <Flex
            transition={'all .3s ease'}
            transform={'translateX(-10px)'}
            opacity={0}
            _groupHover={{ opacity: '100%', transform: 'translateX(0)' }}
            justify={'flex-end'}
            align={'center'}
            flex={1}
          >
            <Icon color={'green.400'} w={5} h={5} as={ChevronRightIcon} />
          </Flex>
        </Stack>
      </Link>
    </NextLink>
  );
};

export default SubNav;
