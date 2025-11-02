import { UseToastOptions } from "@chakra-ui/react";

export const handleMessageTransactions = async (
  txPromise: Promise<any>,
  toast: (options: UseToastOptions) => void,
  successMessage = "Transaction réussie 🎉",
  errorMessage = "Erreur lors de la transaction"
) => {
  try {
    const receipt = await txPromise;

    // ✅ Succès
    toast({
      title: successMessage,
      description: `Hash : ${receipt.transactionHash.slice(0, 10)}...`,
      status: "success",
      position: "top-right",
      duration: 5000,
      isClosable: true,
    });

    return receipt;
  } catch (error: any) {
    console.error("Erreur transaction:", error);

    // 🧩 Gestion fine des erreurs les plus courantes
    let description = "Une erreur est survenue.";

    if (error?.message?.includes("insufficient funds")) {
      description = "Solde insuffisant pour couvrir les frais de gas.";
    } else if (error?.message?.includes("User denied transaction")) {
      description = "Signature refusée par l’utilisateur.";
    } else if (error?.message?.includes("network")) {
      description = "Problème de connexion au réseau Ethereum.";
    } else if (error?.code === 4001) {
      description = "Transaction annulée par l’utilisateur.";
    }

    toast({
      title: errorMessage,
      description,
      status: "error",
      position: "top-right",
      duration: 6000,
      isClosable: true,
    });

    throw error;
  }
};
