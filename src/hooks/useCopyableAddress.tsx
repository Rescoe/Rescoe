import { Text, useToast } from "@chakra-ui/react";
import React, { useEffect, useState, useCallback } from "react";
import { JsonRpcProvider, Contract } from "ethers";

type Props = {
  address?: string;
  size?: string;
  color?: string;
};

const CopyableAddress: React.FC<Props> = ({
  address,
  size = "sm",
  color = "blue.500",
}) => {
  const toast = useToast();
  const [display, setDisplay] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const resolveAddress = useCallback(async (addr: string) => {
    if (!addr) return;

    setIsLoading(true);
    try {
      const provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.base.org"
      );

      let code: string;
      try {
        code = await Promise.race<string>([
          provider.getCode(addr),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 3000)
          ),
        ]);
      } catch (codeErr) {
        console.warn("getCode failed (normal pour EOA):", codeErr);
        code = "0x";
      }

      if (code !== "0x") {
        try {
          const contract = new Contract(
            addr,
            ["function name() view returns (string)"],
            provider
          );

          const name = await Promise.race<string>([
            contract.name(),
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error("name timeout")), 2000)
            ),
          ]);

          if (name && name !== "") {
            setDisplay(name);
            return;
          }
        } catch (nameErr) {
          console.warn("contract.name() failed:", nameErr);
        }
      }

      setDisplay(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (error) {
      console.error("Résolution adresse failed:", error);
      setDisplay(`${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) {
      resolveAddress(address);
    } else {
      setDisplay("");
      setIsLoading(false);
    }
  }, [address, resolveAddress]);

  if (!address) return null;

  const handleClick = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Adresse copiée !",
      description: `${display} → ${address.slice(0, 6)}...${address.slice(-4)}`,
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Text
      as="span"
      cursor="pointer"
      color={color}
      fontSize={size}
      title={address}
      onClick={handleClick}
      opacity={isLoading ? 0.6 : 1}
    >
      {isLoading ? "..." : display}
    </Text>
  );
};

export default CopyableAddress;
