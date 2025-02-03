import { Stack, useBreakpointValue } from '@chakra-ui/react'; // Utilisation de Stack au lieu de HStack
import { NavItem } from '../NavItem';
import NAV_LINKS from './paths';
import { useAuth } from '../../../../utils/authContext';

const NavBar = () => {
  const { address, isAdmin, isArtist } = useAuth();
  // Vérifie si c'est un affichage mobile
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Stack
      spacing={4}  // Espacement entre les éléments
      direction={isMobile ? 'column' : 'row'} // Disposition en colonne sur mobile, en ligne sur ordinateur
      align={isMobile ? 'flex-start' : 'center'} // Alignement à gauche sur mobile, centré sur desktop
    >
      {NAV_LINKS.map((link) => (
        <NavItem key={`link-${link.label}`} {...link} />
      ))}
    </Stack>
  );
};

export default NavBar;
