import React, { useState, useEffect, RefObject } from 'react';
import { Box, Image } from '@chakra-ui/react';
import { useAuth } from '../../utils/authContext';

interface InsecteProps {
  headerRef: RefObject<HTMLElement>;
  selectedInsect: string | null;
  level: number; // 0,1,2,3
}

const Insecte = ({ headerRef, selectedInsect, level }: InsecteProps) => {
  const { address } = useAuth();
  const [insectPosition, setInsectPosition] = useState<number>(0);
  const [leftPosition, setLeftPosition] = useState<number>(10);

  const isLevel2 = level === 2;

  // Effect to handle the position updates
  useEffect(() => {
    const headerHeight = headerRef.current ? headerRef.current.getBoundingClientRect().height : 0;
    const newTopPosition = headerHeight - 57;
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
        sx={
          isLevel2
            ? {
              transform: 'translateY(60%)',
            } // pas d’animation pour les cocons
            : {
                '@keyframes moveInsect': {
                  '0%': { transform: 'translateX(0) scaleX(-1)' },
                  '50%': { transform: 'translateX(90vw)' },
                  '49%': { transform: 'translateX(90vw) scaleX(-1)' },
                  '98%': { transform: 'translateX(0)' },
                },
                animation: 'moveInsect 1200s linear infinite',
              }
        }
      >
        <Image
          src={selectedInsect}
          alt="Insecte"
          boxSize="100px"
          objectFit="contain"
          transform={isLevel2 ? 'none' : 'rotate(20deg) scaleY(0.98)'}
        />
      </Box>

  );
};

export default Insecte;
