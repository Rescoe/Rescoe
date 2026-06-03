export type DeployStep = {
  id: string;
  name: string;
  sourcePath: string;
  artifactPath: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  address?: string;
  txHash?: string;
  enabled: boolean;
  content?: string; // Source Solidity
};

export type AppState = {
  account: string;
  provider: ethers.BrowserProvider | null;
  deploySteps: DeployStep[];
  addresses: Record<string, string>;
  logs: string[];
  selectedContract: string;
};
