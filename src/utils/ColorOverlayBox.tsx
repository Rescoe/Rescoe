import React, { useEffect, useState } from "react";
import { Box, Image, Text, VStack } from "@chakra-ui/react";

// Utilitaire pour extraire la couleur dominante via un canvas
const getDominantColor = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new window.Image(); // ou juste `new Image()`
    img.crossOrigin = "anonymous"; // pour éviter le tainting du canvas
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve("#000000");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      resolve(`rgb(${r},${g},${b})`);
    };
    img.onerror = () => resolve("#000000");
  });
};

// Utilitaire pour savoir si la couleur est claire ou foncée
const isColorLight = (rgb: string) => {
  const [r, g, b] = rgb
    .replace(/[^\d,]/g, "")
    .split(",")
    .map(Number);
  // formule de luminance perçue
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150;
};

interface ColorOverlayBoxProps {
  imageUrl: string;
  children: React.ReactNode;
}

const ColorOverlayBox: React.FC<ColorOverlayBoxProps> = ({ imageUrl, children }) => {
  const [dominantColor, setDominantColor] = useState<string>("rgba(0,0,0,0.3)");
  const [textColor, setTextColor] = useState<string>("white");

  useEffect(() => {
    if (!imageUrl) return;
    getDominantColor(imageUrl).then((color) => {
      setDominantColor(color + "88"); // 0.53 alpha pour overlay semi-transparent
      setTextColor(isColorLight(color) ? "black" : "white");
    });
  }, [imageUrl]);

  return (
    <Box position="relative" w="full" h="full">
      <Image
        src={imageUrl}
        alt="Artwork"
        objectFit="cover"
        w="100%"
        h="100%"
        borderRadius="md"
      />
      <Box
        position="absolute"
        top={0}
        left={0}
        w="100%"
        h="100%"
        bg={dominantColor}
        borderRadius="md"
        display="flex"
        justifyContent="center"
        alignItems="center"
        textAlign="center"
        px={4}
      >
        <VStack color={textColor} spacing={2}>
          {children}
        </VStack>
      </Box>
    </Box>
  );
};

export default ColorOverlayBox;
