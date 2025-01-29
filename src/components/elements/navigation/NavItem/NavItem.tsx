import { Box, Popover, PopoverContent, PopoverTrigger, Stack, useColorModeValue, HStack, Icon } from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { FC } from 'react';
import { ISubNav } from '../SubNav/SubNav';
import { SubNav } from '../SubNav';
import NextLink from 'next/link';
import { useRouter } from 'next/router';

const NavItem: FC<ISubNav> = ({ label, children, href, icon }) => {  // Ajout de l'icon
  const linkColor = useColorModeValue('gray.600', 'gray.400');
  const linkActiveColor = useColorModeValue('gray.800', 'white');
  const router = useRouter();
  const isCurrentPath = router.asPath === href || (href !== '/' && router.pathname.startsWith(href || ''));

  return (
    <Popover trigger={'hover'} placement={'bottom-start'}>
      <PopoverTrigger>
        <Box>
          <Box
            fontSize={15}
            fontWeight={500}
            color={isCurrentPath ? linkActiveColor : linkColor}
            _hover={{
              textDecoration: 'none',
              color: linkActiveColor,
            }}
            cursor="pointer"
          >
            {children ? (
              <HStack>
                {icon && <Icon as={icon} boxSize={4} />}  {/* Ajout de l'icône avant le label */}
                <span>{label}</span>
                <ChevronDownIcon />
              </HStack>
            ) : (
              <HStack>
                {icon && <Icon as={icon} boxSize={4} />}  {/* Icône avant le label */}
                <NextLink href={href || '/'}>{label}</NextLink>
              </HStack>
            )}
          </Box>
        </Box>
      </PopoverTrigger>

      {children && (
        <PopoverContent border={0} boxShadow={'xl'} p={4} rounded={'xl'} minW={'sm'}>
          <Stack>
            {children.map((child) => (
              <SubNav key={child.label} {...child} />
            ))}
          </Stack>
        </PopoverContent>
      )}
    </Popover>
  );
};

export default NavItem;
