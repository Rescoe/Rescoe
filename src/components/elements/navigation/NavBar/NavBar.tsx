import { Stack, useBreakpointValue } from '@chakra-ui/react'; // Utilisation de Stack au lieu de HStack
import { NavItem } from '../NavItem';
import NAV_LINKS from './paths';
import { useAuth } from '../../../../utils/authContext';

const NavBar = () => {
  const { address, isAdmin, isArtist } = useAuth();
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Stack
      spacing={4}
      direction={isMobile ? 'column' : 'row'}
      align={isMobile ? 'flex-start' : 'center'}
    >
      {NAV_LINKS.filter(link => {
        // Inclut tous les liens qui ne nécessitent pas d'authentification
        // ou ceux qui nécessitent une authentification lorsque l'utilisateur est connecté
        return !link.requiresAuth || address;
      }).map((link) => (
        <NavItem key={`link-${link.label}`} {...link} />
      ))}
    </Stack>
  );
};


export default NavBar;
