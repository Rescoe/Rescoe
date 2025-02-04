import React from 'react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import { Button, useColorMode } from '@chakra-ui/react';

const ColorModeButton = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  // Utiliser useEffect pour interagir avec le DOM uniquement côté client
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      // Initialiser le mode sombre dès le début
      document.body.setAttribute('data-theme', colorMode === 'dark' ? 'dark' : 'light');
    }
  }, [colorMode]);

  // Forcer le mode sombre au démarrage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && colorMode !== 'dark') {
      toggleColorMode();  // Force le mode sombre au premier rendu
    }
  }, []); // Ce useEffect ne s'exécute qu'une seule fois au montage initial

  return (
    <Button size="sm" onClick={toggleColorMode}>
      {colorMode === 'light' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
};

export default ColorModeButton;
