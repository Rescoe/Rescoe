import React, { useState, useEffect } from 'react';
import { Box, Image } from '@chakra-ui/react';
import { JsonRpcProvider } from 'ethers';
import ABI from '../ABI/ABIAdhesion.json';
import { Contract } from 'ethers';
import { useAuth } from '../../utils/authContext';

const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;

const Insecte = ({ headerRef, selectedInsect }) => {
  const { address } = useAuth();
  const [insectPosition, setInsectPosition] = useState<number>(0);
  const [leftPosition, setLeftPosition] = useState<number>(10);

  // Effect to handle the position updates
  useEffect(() => {
    const headerHeight = headerRef.current ? headerRef.current.getBoundingClientRect().height : 0;
    const newTopPosition = headerHeight - 27;
    setInsectPosition(newTopPosition);

    const windowWidth = window.innerWidth;
    const newLeftPosition = Math.max(0, windowWidth * 0.1);
    setLeftPosition(newLeftPosition);
  }, [headerRef]);

  if (!selectedInsect) {
    return null;
  }

  return (
    <Box
      position="absolute"
      top={`${insectPosition}px`}
      left={`${leftPosition}px`}
      sx={{
        '@keyframes moveInsect': {
          '0%': { transform: 'translateX(0) scaleX(-1)' },
          '50%': { transform: 'translateX(90vw) ' },
          '49%': { transform: 'translateX(90vw) scaleX(-1)' },
          '98%': { transform: 'translateX(0) ' },
        },
        animation: 'moveInsect 1200s linear infinite',
      }}
    >
      <Image
        src={selectedInsect}
        alt="Insecte"
        boxSize="45px"
        objectFit="contain"
        transform='rotate(20deg) scaleY(0.98)'
      />
    </Box>
  );
};

export default Insecte;
