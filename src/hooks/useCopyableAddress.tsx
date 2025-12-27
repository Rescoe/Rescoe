import { Text, useToast } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { JsonRpcProvider, Contract } from "ethers";

type Props = {
  address?: string;
  size?: string; // xs, sm, md, lg
  color?: string;
};

const CopyableAddress: React.FC<Props> = ({
  address,
  size = "sm",
  color = "blue.500",
}) => {
  const toast = useToast();
  const [display, setDisplay] = useState<string>("");

  useEffect(() => {
    if (!address) return;

    const provider = new JsonRpcProvider(
      process.env.NEXT_PUBLIC_URL_SERVER_MORALIS
    );

    const resolveAddress = async () => {
      try {
        // Résoudre le nom ENS si présent

        // Vérifiez si l'adresse est un contrat
        const code = await provider.getCode(address);
        if (code === "0x") {
          // Ce n'est pas un contrat, donc on affiche l'adresse abrégée
          setDisplay(`${address.slice(0, 6)}...${address.slice(-4)}`);
        } else {
          // C'est un contrat, donc récupérer le nom
          const contract = new Contract(address, ["function name() view returns (string)"], provider);
          const tokenName = await contract.name();
          setDisplay(tokenName);
        }
      } catch (error) {
        // En cas d'erreur de résolution
        console.error("Erreur de résolution d'adresse : ", error);
        setDisplay(`${address.slice(0, 6)}...${address.slice(-4)}`);
      }
    };

    resolveAddress();
  }, [address]);

  if (!address) return null; // Ne rien afficher si l'adresse n'est pas fournie

  const handleClick = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Adresse copiée !",
      description: address,
      status: "success",
      duration: 1500,
      isClosable: true,
    });
  };

  return (
    <Text
      as="span"
      cursor="pointer"
      color="white"
      fontSize={size}
      onClick={handleClick}
    >
      {display}
    </Text>
  );
};

export default CopyableAddress;
