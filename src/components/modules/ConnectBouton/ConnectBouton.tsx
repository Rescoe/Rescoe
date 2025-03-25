import React, { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import Web3 from "web3";
import detectEthereumProvider from '@metamask/detect-provider';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { Button, Text, HStack, useToast, Tooltip, Box, Menu, MenuButton, MenuList, MenuItem } from '@chakra-ui/react';
import { getEllipsisTxt } from '../../../utils/format';
import { useAuth } from '../../../utils/authContext';
import { useAuthRequestChallengeEvm } from '@moralisweb3/next';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';

const ConnectBouton: React.FC = () => {
    const { disconnectAsync } = useDisconnect();
    const { isConnected, address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const toast = useToast();
    const { requestChallengeAsync } = useAuthRequestChallengeEvm();
    const { role, setAddress, isMember } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);
    const { isAuthenticated, setIsAuthenticated } = useAuth();
    const [selectedChainId, setSelectedChainId] = useState(11155111);
    const [chainName, setChainName] = useState("Sepolia");
    const [web3, setWeb3] = useState<Web3 | null>(null);

    useEffect(() => {
        const initWeb3 = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
            }
        };
        initWeb3();
    }, []);

    const handleChainSelect = async (chainId: number) => {
        setSelectedChainId(chainId);
        if (web3 && web3.currentProvider) {
            try {
                await web3.currentProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${chainId.toString(16)}` }],
                });

                const chainMap: { [key: number]: string } = {
                    1: "Ethereum",
                    11155111: "Sepolia",
                    42161: "Arbitrum",
                    10: "Optimism",
                    84531: "Base",
                };

                setChainName(chainMap[chainId] || "Réseau inconnu");
            } catch (error) {
                console.error("Erreur lors du changement de chaîne:", error);
            }
        }
    };

    useEffect(() => {
        const storedAddress = localStorage.getItem('connectedAddress');
        const storedAuth = localStorage.getItem('isAuthenticated') === 'true';

        if (storedAddress && isConnected) {
            setAddress(storedAddress);
            setIsAuthenticated(storedAuth);
        } else if (isConnected && address) {
            handleAuth(address, selectedChainId);
        } else {
            setIsAuthenticated(false);
        }
    }, [isConnected, address, setAddress, selectedChainId, setIsAuthenticated]);

    const handleAuth = async (account: string, chainId: number) => {
        setIsConnecting(true);
        try {
            const challenge = await requestChallengeAsync({ address: account, chainId });
            if (!challenge?.message) {
                throw new Error("Challenge non valide.");
            }

            const signature = await signMessageAsync({ message: challenge.message });
            const result = await signIn('moralis-auth', { message: challenge.message, signature, network: 'Evm', redirect: false });

            if (result?.error) {
                throw new Error(result.error);
            }

            setAddress(account.toLowerCase());
            setIsAuthenticated(true);
            localStorage.setItem('connectedAddress', account.toLowerCase());
            localStorage.setItem('isAuthenticated', 'true');
        } catch (e) {
            console.error("Erreur lors de l'authentification:", e);
            toast({
                title: 'Oops, quelque chose s\'est mal passé...',
                description: 'Essayez de vous reconnecter.',
                status: 'error',
                position: 'top-right',
                isClosable: true,
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        await disconnectAsync();
        signOut({ callbackUrl: '/' });
        setIsAuthenticated(false);
        setAddress('');
        localStorage.removeItem('connectedAddress');
        localStorage.removeItem('isAuthenticated');
    };

    const getUserRole = () => {
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';
    };

    return (
        <Box>
            <RainbowConnectButton.Custom>
                {({ account, chain, openConnectModal, mounted }) => {
                    if (!mounted) return null;

                    return (
                        <Box>
                            {!isAuthenticated && (
                                <Button
                                    onClick={async () => {
                                        await openConnectModal(); // Ouvre le wallet
                                        if (isConnected && account) {
                                            handleAuth(account.address, selectedChainId); // Tenter la vérification automatiquement
                                        }
                                    }}
                                    colorScheme="blue"
                                    size="sm"
                                    isLoading={isConnecting}
                                    loadingText="Vérification..."
                                >
                                    Connect Wallet
                                </Button>
                            )}

                            {isAuthenticated && (
                                <Tooltip label={`Connecté : ${getUserRole()}`} aria-label="User Role Tooltip" hasArrow placement="bottom">
                                    <Menu>
                                        <MenuButton as={HStack} cursor="pointer" gap={'20px'} spacing={{ base: 2, md: 4 }} direction={{ base: 'column', md: 'row' }}>
                                            <Text fontWeight="medium">
                                                {account ? getEllipsisTxt(account.address) : "Non connecté"}
                                            </Text>
                                            <Text fontSize="sm" color="gray.500">
                                                {chain ? chain.name : "Réseau inconnu"}
                                            </Text>
                                        </MenuButton>
                                        <MenuList>
                                            <MenuItem onClick={() => handleChainSelect(1)}>Ethereum</MenuItem>
                                            <MenuItem onClick={() => handleChainSelect(11155111)}>Sepolia</MenuItem>
                                            <MenuItem onClick={() => handleChainSelect(84531)}>Base</MenuItem>
                                            <MenuItem onClick={handleDisconnect}>Se déconnecter</MenuItem>
                                            {/* Ajouter l'option de vérification d'adhésion dans le menu */}
                                            {account && chain && (
                                                <MenuItem onClick={() => handleAuth(account.address, selectedChainId)}>Vérifier l'adhésion</MenuItem>
                                            )}
                                        </MenuList>
                                    </Menu>
                                </Tooltip>
                            )}
                        </Box>
                    );
                }}
            </RainbowConnectButton.Custom>
        </Box>
    );
};

export default ConnectBouton;
