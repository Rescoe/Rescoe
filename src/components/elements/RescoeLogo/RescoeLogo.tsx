import React from 'react';
import { useColorMode } from '@chakra-ui/react';

const RescoeLogo = () => {
  const { colorMode } = useColorMode();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%', // Assure l'alignement vertical
      position: 'relative',
    }}>
      <img
        src={colorMode === 'dark' ? '/RescoleoptereBlanc.svg' : '/RESCOELight.svg'}
        style={{
          width: '150px', // Taille fixe en pixels
          height: 'auto', // Maintient le ratio d'aspect de l'image
        }}
        alt="Rescoe"
      />
    </div>
  );
};

export default RescoeLogo;
