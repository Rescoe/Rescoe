import { JsonRpcProvider } from "ethers";
import { rpcCache } from "./rpcCache";

let globalProvider: JsonRpcProvider | null = null;

export const getProvider = () => {
  if (!globalProvider) {
    globalProvider = new JsonRpcProvider(
      process.env.NEXT_PUBLIC_RPC_URL || "https://mainnet.base.org"
    );
  }
  return globalProvider;
};

export const cachedCall = async <T = unknown>(
  contract: any,
  method: string,
  ...args: any[]
): Promise<T> => {
  const contractAddress =
    typeof contract?.target === "string"
      ? contract.target
      : typeof contract?.address === "string"
      ? contract.address
      : "unknown";

  const key = `${contractAddress}-${method}-${JSON.stringify(args)}`;
  const cached = rpcCache.get<T>(key);

  if (cached !== null) {
    return cached;
  }

  try {
    const result = await contract[method](...args);
    rpcCache.set(key, result);
    return result as T;
  } catch (e) {
    console.warn(`RPC cachedCall failed: ${key}`, e);
    throw e;
  }
};
