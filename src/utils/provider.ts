// utils/provider.ts
import { JsonRpcProvider } from "ethers";

let globalProvider: JsonRpcProvider | null = null;

export const getProvider = () => {
  if (!globalProvider) {
    globalProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
  }
  return globalProvider;
};
