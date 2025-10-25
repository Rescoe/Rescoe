import React from 'react';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import { Button, useColorMode } from '@chakra-ui/react';

const ColorModeButton = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      document.body.setAttribute('data-theme', colorMode === 'dark' ? 'dark' : 'light');
    }
  }, [colorMode]);

  return (
    <Button
      size="sm"
      onClick={toggleColorMode}
      variant="ghost"       // enlève la bulle
      bg="transparent"      // supprime tout fond
      _hover={{ bg: 'transparent' }}
      _active={{ bg: 'transparent' }}
      _focus={{ boxShadow: 'none' }} // pas de contour
    >
      {colorMode === 'light' ? <SunIcon /> : <MoonIcon />}
    </Button>

  );
};

export default ColorModeButton;
