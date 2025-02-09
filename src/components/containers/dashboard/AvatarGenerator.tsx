import React, { useState, useEffect, useRef } from 'react';
import { Box, Button } from '@chakra-ui/react';
import * as jdenticon from 'jdenticon'; // Changer l'importation

type AvatarGeneratorProps = {
  userHash: string;
  size?: number;
};

const AvatarGenerator: React.FC<AvatarGeneratorProps> = ({ userHash, size = 100 }) => {
  const [variation, setVariation] = useState(userHash);  // Gère la variation de l'avatar
  const avatarRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (avatarRef.current) {
      // Utilisez `jdenticon.update` pour mettre à jour l'avatar
      jdenticon.update(avatarRef.current, variation);
    }
  }, [variation]);

  const generateNewVariation = () => {
    // Logique simple pour changer la variation en modifiant légèrement le hash
    setVariation(variation + Math.random().toString(36).substring(7));
  };

  return (
    <Box>
      <svg
        ref={avatarRef}
        width={size}
        height={size}
        data-jdenticon-hash={variation}
        style={{ borderRadius: '50%' }}
      />
      {/* Bouton pour générer une nouvelle variation */}
      <Button onClick={generateNewVariation} mt={2}>
        Nouvelle variation
      </Button>
    </Box>
  );
};

export default AvatarGenerator;
