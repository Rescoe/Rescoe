'use client';

import React, { useState, useEffect } from 'react';
import {
  Box, Heading, VStack, Tabs, TabList, Tab, TabPanels, TabPanel, Text, Avatar, Badge, HStack,
  Card, CardBody, CardHeader, SimpleGrid, FormControl, Input, Textarea, InputGroup, Button,
  Spinner, Divider, useToast, IconButton, FormLabel
} from '@chakra-ui/react';
import { FiSave, FiUpload, FiImage, FiEdit3 } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { useAuth } from '@/utils/authContext';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import CopyableAddress from '@/hooks/useCopyableAddress';
import FilteredCollectionsCarousel from '@/components/containers/galerie/art/filtrage';
import UserNFTFeed from '@/hooks/Moralis/userNFT';
import UserTransactionsFeed from '@/hooks/Moralis/UserTransactionsFeed';
import CreateSocialCollection from '../CreateSocialCollection';

const STORAGE_KEY = (address: string) => `rescoe-resident-${address.toLowerCase()}`;

type ResidentConfig = {
  displayName: string;
  bio: string;
  avatar?: string;
  banner?: string;
  background?: string;
  role: string;
  featuredNFTs: string[];
  updatedAt: string;
};

const ResidentDashboard = () => {
  const router = useRouter();
  const { address: connectedAddress } = useAuth();
  const { uploadToIPFS } = usePinataUpload();
  const toast = useToast();

  const urlAddress = String(router.query?.address || connectedAddress || "");
  const [config, setConfig] = useState<ResidentConfig>({
    displayName: "Résident RESCOE",
    bio: "Configurez votre profil depuis l'onglet Éditeur.",
    avatar: "",
    banner: "",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    role: "Résident",
    featuredNFTs: [],
    updatedAt: ""
  });
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Partial<ResidentConfig>>({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const isOwner = connectedAddress?.toLowerCase() === urlAddress.toLowerCase();

  useEffect(() => {
    const init = async () => {
      if (!urlAddress) {
        setLoading(false);
        return;
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY(urlAddress.toLowerCase()));
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig({
            ...config,
            ...parsed,
            displayName: parsed.displayName || "Résident RESCOE",
            bio: parsed.bio || "",
            role: parsed.role || "Résident"
          });
        }
      } catch (e) {
        console.warn("Config load error:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [urlAddress]);

  const previewConfig = { ...config, ...editDraft };

  const saveConfig = async () => {
  setUploading(true);
  try {
    let finalConfig = { ...previewConfig, updatedAt: new Date().toISOString() };

    // ✅ AVATAR - SAFE CHECK
    if (editDraft.avatar && typeof editDraft.avatar !== 'string') {
      const avatarFile = editDraft.avatar as unknown as File;
      const avatarBlobUrl = URL.createObjectURL(avatarFile);
      const avatarUpload = await uploadToIPFS({
        imageUrl: avatarBlobUrl,
        name: "avatar",
        bio: "Profile avatar",
        role: "user",
        level: 1,
        attributes: [],
        family: "resident",
        sprite_name: "avatar"
      });
      finalConfig.avatar = avatarUpload.url;
    }

    // ✅ BANNER - SAFE CHECK
    if (editDraft.banner && typeof editDraft.banner !== 'string') {
      const bannerFile = editDraft.banner as unknown as File;
      const bannerBlobUrl = URL.createObjectURL(bannerFile);
      const bannerUpload = await uploadToIPFS({
        imageUrl: bannerBlobUrl,
        name: "banner",
        bio: "Profile banner",
        role: "user",
        level: 1,
        attributes: [],
        family: "resident",
        sprite_name: "banner"
      });
      finalConfig.banner = bannerUpload.url;
    }

    localStorage.setItem(STORAGE_KEY(urlAddress.toLowerCase()), JSON.stringify(finalConfig));
    setConfig(finalConfig);
    setEditDraft({});
    setEditMode(false);
    toast({ title: "💾 Profil sauvegardé !", status: "success" });
  } catch (err) {
    toast({ title: "❌ Erreur sauvegarde", status: "error" });
  } finally {
    setUploading(false);
  }
};


  const handleFileUpload = (type: 'avatar' | 'banner') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEditDraft(prev => ({ ...prev, [type]: file }));
  };

  const handleInputChange = (field: keyof ResidentConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditDraft(prev => ({ ...prev, [field]: e.target.value }));
  };

  if (loading) {
    return (
      <Box minH="50vh" display="flex" justifyContent="center" alignItems="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box
      mt={10}
      w="100%"
      maxW="1400px"
      mx="auto"
      bg={previewConfig.background}
      minH="100vh"
      py={12}
      transition="all 0.3s ease"
    >
      {/* HEADER */}
      <Box textAlign="center" mb={12}>
        <HStack justify="center" spacing={8} mb={6}>
          <Box w="140px" h="140px" borderRadius="full" overflow="hidden" boxShadow="2xl">
            <Avatar
              size="2xl"
              src={previewConfig.avatar}
              name={previewConfig.displayName}
            />
          </Box>
          <Box>
            <Heading size="2xl" mb={2}>{previewConfig.displayName}</Heading>
            <Badge colorScheme="purple" fontSize="xl" px={4} py={2}>{previewConfig.role}</Badge>
            <Text fontSize="lg" mt={4} color="gray.300">{previewConfig.bio}</Text>
            <Text fontSize="sm" mt={2} color="gray.500">
              {config.updatedAt ? `Mis à jour: ${new Date(config.updatedAt).toLocaleDateString('fr-FR')}` : 'Non configuré'}
            </Text>
          </Box>
        </HStack>
        <CopyableAddress address={urlAddress} />
      </Box>

      {/* TABS */}
      <Tabs variant="soft-rounded" colorScheme="purple" maxW="1200px" mx="auto">
        <TabList>
          <Tab>👤 Profil</Tab>
          {isOwner && <Tab>✨ Éditeur</Tab>}
          <Tab>🎨 Collections</Tab>
          <Tab>🖼️ Œuvres</Tab>
          <Tab>📅 Événements</Tab>
          <Tab>📊 Transactions</Tab>
        </TabList>

        <TabPanels mt={8}>
          {/* PROFIL */}
          <TabPanel>
            <VStack spacing={8} align="start">
              <Card w="full" shadow="xl">
                <CardHeader>
                  <Heading size="md">Informations</Heading>
                </CardHeader>
                <CardBody>
                  <VStack align="start" spacing={4}>
                    <Text><strong>Adresse :</strong> <CopyableAddress address={urlAddress} /></Text>
                    <Text><strong>Rôle :</strong> {previewConfig.role}</Text>
                    <Text><strong>Bio :</strong> {previewConfig.bio}</Text>
                  </VStack>
                </CardBody>
              </Card>

              {isOwner && (
                <Card w="full" shadow="xl">
                  <CardBody>
                    <CreateSocialCollection />
                  </CardBody>
                </Card>
              )}
            </VStack>
          </TabPanel>

          {/* ÉDITEUR */}
          {isOwner && (
            <TabPanel>
              <Card shadow="xl">
                <CardHeader pb={2}>
                  <Heading size="lg">✨ Personnaliser votre profil</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={6}>
                    {/* FICHIERS */}
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                      <FormControl>
                        <FormLabel>Avatar</FormLabel>
                        <Input type="file" accept="image/*" onChange={handleFileUpload('avatar')} />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Bannière</FormLabel>
                        <Input type="file" accept="image/*" onChange={handleFileUpload('banner')} />
                      </FormControl>
                    </SimpleGrid>

                    {/* TEXTES */}
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                      <FormControl>
                        <FormLabel>Nom d'affichage</FormLabel>
                        <Input
                          value={editDraft.displayName ?? config.displayName}
                          onChange={handleInputChange('displayName')}
                          placeholder="Votre nom d'artiste"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Rôle</FormLabel>
                        <Input
                          value={editDraft.role ?? config.role}
                          onChange={handleInputChange('role')}
                          placeholder="Artiste, Résident, etc."
                        />
                      </FormControl>
                    </SimpleGrid>

                    <FormControl>
                      <FormLabel>Bio</FormLabel>
                      <Textarea
                        value={editDraft.bio ?? config.bio}
                        onChange={handleInputChange('bio')}
                        rows={4}
                        placeholder="Présentez-vous..."
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Background CSS</FormLabel>
                      <Input
                        value={editDraft.background ?? config.background}
                        onChange={handleInputChange('background')}
                        placeholder="linear-gradient(...) ou url(...)"
                      />
                    </FormControl>

                    <Button
                      colorScheme="purple"
                      size="lg"
                      leftIcon={<FiSave />}
                      onClick={saveConfig}
                      isLoading={uploading}
                      w="full"
                    >
                      💾 Sauvegarder mon profil
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </TabPanel>
          )}

          {/* COLLECTIONS */}
          <TabPanel>
            <FilteredCollectionsCarousel creator={urlAddress} />
          </TabPanel>

          {/* ŒUVRES */}
          <TabPanel>
            <UserNFTFeed walletAddress={urlAddress} />
          </TabPanel>

          {/* ÉVÉNEMENTS */}
          <TabPanel>
            <Card shadow="xl" w="full">
              <CardHeader>
                <Heading>📅 Événements & Ateliers</Heading>
              </CardHeader>
              <CardBody>
                <Text>Calendrier des ateliers Social (à implémenter)</Text>
              </CardBody>
            </Card>
          </TabPanel>

          {/* TRANSACTIONS */}
          <TabPanel>
            <UserTransactionsFeed walletAddress={urlAddress} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default ResidentDashboard;
