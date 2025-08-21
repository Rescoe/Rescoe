import { Box, Text } from "@chakra-ui/react";

interface FramedTextProps {
  children: React.ReactNode;
}

export const FramedText: React.FC<FramedTextProps> = ({ children }) => {
  return (
    <Box
      position="relative"
      display="inline-block" // largeur adaptée au contenu
      maxWidth="90%" // pas trop large sur les grands écrans
      padding="40px"
      borderRadius="12px"
      bgColor="rgba(255, 255, 255, 0.8)"
      boxShadow="0 10px 30px rgba(0, 0, 0, 0.1)"
      margin="20px auto" // centrer le cadre
      textAlign="center"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top="-10px"
        left="-10px"
        right="-10px"
        bottom="-10px"
        border="3px solid transparent"
        borderRadius="16px"
        zIndex="-1"
        background="linear-gradient(white, white), radial-gradient(circle at top right, teal, transparent), radial-gradient(circle at bottom left, teal, transparent)"
        backgroundSize="100% 100%, 60% 60%, 60% 60%"
        backgroundPosition="0 0, 100% 0%, 100% 100%"
        backgroundRepeat="no-repeat"
        clipPath="polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)"
      />

      <Text
        fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
        lineHeight="1.6"
        color="teal.800"
        fontFamily="'Merriweather', serif" // police lisible et élégante pour poésie
        textShadow="1px 1px 2px rgba(0, 0, 0, 0.2)"
      >
        {children}
      </Text>
    </Box>
  );
};
