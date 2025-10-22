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
    <Button size="sm" onClick={toggleColorMode}>
      {colorMode === 'light' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
};

export default ColorModeButton;
