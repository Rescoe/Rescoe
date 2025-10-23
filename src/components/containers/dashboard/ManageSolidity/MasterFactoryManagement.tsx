import React, { useState, useEffect } from 'react';
import Web3 from 'web3';

import { useAuth } from '../../../../utils/authContext';

import axios from 'axios';
import {
    Box,
    Button,
    Heading,
    Text,
    Image,
    Center,
    Input,
    VStack,
    HStack,
    Select,
    Divider,
    FormControl,
    FormLabel,
} from '@chakra-ui/react';
import detectEthereumProvider from '@metamask/detect-provider';
import ABIMasterFactory from '../../../ABI/Factories/ABI_MasterFactory.json';
import ABISocial from '../../../ABI/Factories/MessageFactory.json';
import CreateSocialCollection from "./CreateSocialCollection"

const ManageContracts = () => {
  const [factoryType, setFactoryType] = useState<string>('Art');
  const [newAddress, setNewAddress] = useState<string>('');
  const [currentAddresses, setCurrentAddresses] = useState<Record<string, string>>({});
  const [web3, setWeb3] = useState<Web3 | null>(null);


  const masterFactoryAddress = process.env.NEXT_PUBLIC_MASTERFACTORY_CONTRACT as string;

  const { address: authAddress } = useAuth();
  const [account, setAccount] = useState<string>('');

  useEffect(() => {
      const initWeb3 = async () => {
          const provider = await detectEthereumProvider();
          if (provider) {
              const web3Instance = new Web3(provider);
              setWeb3(web3Instance);

              // Récupérer les comptes après avoir initialisé Web3
              const accounts = await web3Instance.eth.getAccounts();
              setAccount(accounts[0] || ''); // Si aucun compte n'est trouvé, le compte est vide
              // Optionnel: récupérer d'autres informations comme le prix de mint
          } else {
              alert('Veuillez installer MetaMask!');
          }
      };

      initWeb3();
  }, []); // Cette dépendance vide assure que ce code ne s'exécute qu'une seule fois au montage du composant


  // Charger les adresses existantes des factories
  const fetchFactories = async () => {
    if (web3 && account) {
      try {
        const contract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
        const types = ["Art", "Poesie", "Generative", "Social"];
        const results: Record<string, string> = {};
        for (const type of types) {
          results[type] = await contract.methods.collectionFactories(type).call();
        }
        setCurrentAddresses(results);
      } catch (err) {
        console.error("Erreur lors du chargement des factories:", err);
      }
    }
  };

  // Mettre à jour une factory
  const handleUpdateFactory = async () => {
    if (!newAddress) return alert("Veuillez entrer une adresse valide.");
    if (web3 && account) {
      try {
        const contract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
        await contract.methods.updateFactory(factoryType, newAddress).send({ from: account });
        alert(`Factory ${factoryType} mise à jour avec succès !`);
        fetchFactories(); // Rafraîchir la liste
      } catch (error) {
        console.error("Erreur lors de la mise à jour:", error);
        alert("Échec de la mise à jour !");
      }
    }
  };

  // Créer une collection via la MasterFactory
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionType, setNewCollectionType] = useState('Art');
  const [newCollectionId, setNewCollectionId] = useState<number>(0);

  const handleCreateCollection = async () => {
    if (!newCollectionName || !newCollectionType) return alert("Nom et type requis.");
    if (web3 && account) {
      try {
        const contract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
        const tx = await contract.methods.createDynamicCollection(
          newCollectionName,
          newCollectionType,
          account,
          newCollectionId
        ).send({ from: account });
        alert(`Collection ${newCollectionName} créée avec succès !`);
        console.log("TX:", tx);
      } catch (error) {
        console.error("Erreur lors de la création:", error);
        alert("Échec de la création !");
      }
    }
  };

  useEffect(() => {
    fetchFactories();
  }, [web3, account]);

  return (
    <VStack spacing={6} align="stretch" maxW="800px" mx="auto">
      <Heading size="md">Gestion des Contrats Factory</Heading>
    <Box p={4} borderWidth="1px" borderRadius="lg">
    <Heading size="md">MasterFactory</Heading>

      <Box p={4} borderWidth="1px" borderRadius="lg">
        <Heading size="sm">Adresses actuelles</Heading>
        {Object.entries(currentAddresses).map(([type, addr]) => (
          <Text key={type}><strong>{type}:</strong> {addr}</Text>
        ))}
      </Box>

      <Divider />

      <Box p={4} borderWidth="1px" borderRadius="lg">
        <Heading size="sm">Mettre à jour une Factory</Heading>
        <Select value={factoryType} onChange={(e) => setFactoryType(e.target.value)}>
          <option value="Art">Art</option>
          <option value="Poesie">Poesie</option>
          <option value="Generative">Generative</option>
          <option value="Social">Social</option>
        </Select>
        <Input placeholder="Nouvelle adresse" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
        <Button mt={2} colorScheme="blue" onClick={handleUpdateFactory}>Mettre à jour</Button>
      </Box>
      </Box>

      <Divider />

      <Box p={4} borderWidth="1px" borderRadius="lg">
      <Heading size="md">Creation de collection Social</Heading>
      <CreateSocialCollection/>
      </Box>

    </VStack>
  );
};


export default ManageContracts;
