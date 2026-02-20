import React, { useState, useRef } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  Image,
  List,
  ListItem,
  Icon,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  Container,
  Divider,
  Badge,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from '@chakra-ui/react';
import { FaEnvelope, FaPhoneAlt, FaMapMarkerAlt, FaGlobe, FaUsers, FaPalette } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface ContactInfo {
  title: string;
  value: string;
  icon: any;
}

interface TeamMember {
  name: string;
  role: string;
  image: string;
  description: string;
  social?: string;
  expertise: string[];
}

// Données association RESCOE (Art & Web3)
const contactInfo: ContactInfo[] = [
  { title: 'Email', value: 'rescoe.association@gmail.com', icon: FaEnvelope },
  { title: 'Téléphone', value: '+33 6 76 76 91 62', icon: FaPhoneAlt },
  { title: 'Adresse', value: '8 rue Burgade, 33500 Libourne, France', icon: FaMapMarkerAlt },
  { title: 'Site Web', value: 'rescoe.xyz', icon: FaGlobe },
];

const teamMembers: TeamMember[] = [
  {
    name: 'Clément Roubeyrie',
    role: 'Président du Bureau',
    image: '/insects/lvl3/Agni/AgniSpecRON.gif',
    description: 'Dirigeant de l\'association RESCOE, porteur de la vision artistique et Web3.',
    expertise: ['Direction Générale', 'Gestion Associative', 'Écosystème'],
  },
  {
    name: 'Thibault Franzinetti',
    role: 'Vice-Président & Trésorier',
    image: '/insects/lvl3/Basil/BasilSpecOVA.gif',
    description: 'Membre du bureau, responsable technique et financier.',
    expertise: ['Développement', 'Partenariats', 'Opérations'],
  },
  {
    name: 'May Santot',
    role: 'Directrice de Publication',
    image: '/insects/lvl3/Core/CoreSpecOVA.gif',
    description: 'Membre du bureau, responsable éditoriale et communication artistique.',
    //social: 'https://instagram.com/may.santot',  // Instagram préféré
    expertise: ['Publications', 'Communication', 'Contenu artistique'],
  },
];

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const toast = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSuccessModalOpen(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      toast({
        title: 'Message transmis au Bureau',
        description: 'Réponse sous 48h par un dirigeant.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Erreur transmission',
        description: 'Contactez-nous directement par email.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box minH="100vh" py={{ base: 8, md: 20 }} px={6}>
      <Container maxW="7xl">
        {/* Hero Association Art/Web3 */}
        <VStack spacing={8} textAlign="center" mb={20}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge colorScheme="purple" mb={4} px={4} py={1} borderRadius="full" fontSize="sm" fontWeight="bold">
              Association Loi 1901 • Art Numérique & Web3
            </Badge>
            <Heading as="h1" size={{ base: "2xl", md: "4xl" }} fontWeight="extrabold" lineHeight={1.2}>
              Contactez le Bureau RESCOE
            </Heading>
            <Text fontSize={{ base: "lg", md: "xl" }} maxW="lg" mx="auto" opacity={0.9} mt={4}>
              Association d'artistes dédiée à l'exploration générative, poétique et blockchain.
            </Text>
          </motion.div>
          {/*
          <HStack spacing={4} flexWrap="wrap" justify="center">
            <Button size="lg" colorScheme="purple" leftIcon={<FaEnvelope />} boxShadow="xl" _hover={{ boxShadow: "2xl" }}>
              Message au Bureau
            </Button>
            <Button variant="outline" size="lg" leftIcon={<FaPhoneAlt />} _hover={{ bg: "purple.500" }}>
              +33 6 76 76 91 62
            </Button>
          </HStack>
          */}
        </VStack>

        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 12, md: 20 }} mb={20}>
          {/* Coordonnées Bureau */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <Box>
              <Heading as="h2" size="2xl" mb={8} textAlign={{ base: "center", lg: "left" }}>
                Bureau de l'Association
              </Heading>
              {/*
              <VStack align="start" spacing={6}>
                {contactInfo.map((info, index) => (
                  <HStack key={index} spacing={4} p={6} borderWidth={1} borderRadius="2xl" w="full" _hover={{ transform: "translateX(8px)" }} transition="all 0.3s">
                    <Icon as={info.icon} boxSize={8} color="purple.400" />
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold" fontSize="lg">{info.title}</Text>
                      <Link
                        href={info.title === 'Email' ? `mailto:${info.value}` : info.title === 'Téléphone' ? `tel:${info.value.replace(/\s/g, '')}` : `https://maps.google.com/?q=${encodeURIComponent(info.value)}`}
                        isExternal
                        color="purple.400"
                        fontSize="md"
                      >
                        {info.value}
                      </Link>
                    </VStack>
                  </HStack>
                ))}
              </VStack>
              */}
              <HStack mt={8} spacing={6} flexWrap="wrap">
                <VStack p={4} borderWidth={1} borderRadius="xl" align="start">
                  <Icon as={FaUsers} boxSize={8} color="purple.400" />
                  <Text fontWeight="bold">Bureau Actif</Text>
                  <Text fontSize="sm" opacity={0.9}>4 Dirigeants</Text>
                </VStack>
                <VStack p={4} borderWidth={1} borderRadius="xl" align="start">
                  <Icon as={FaPalette} boxSize={8} color="purple.400" />
                  <Text fontWeight="bold">Focus Art/Web3</Text>
                  <Text fontSize="sm" opacity={0.9}>NFT Artistiques</Text>
                </VStack>
              </HStack>
            </Box>
          </motion.div>

          {/* Formulaire Bureau */}
          {/*
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            <Box as="form" onSubmit={handleSubmit} p={{ base: 8, md: 12 }} borderWidth={1} borderRadius="3xl" boxShadow="2xl">
              <Heading as="h2" size="xl" mb={6}>Message au Bureau</Heading>
              <VStack spacing={6}>
                <FormControl id="name">
                  <FormLabel>Nom</FormLabel>
                  <Input name="name" value={formData.name} onChange={handleInputChange} required focusBorderColor="purple.400" />
                </FormControl>
                <FormControl id="email">
                  <FormLabel>Email</FormLabel>
                  <Input type="email" name="email" value={formData.email} onChange={handleInputChange} required focusBorderColor="purple.400" />
                </FormControl>
                <FormControl id="subject">
                  <FormLabel>Sujet</FormLabel>
                  <Input name="subject" value={formData.subject} onChange={handleInputChange} placeholder="Exposition • Adhésion • Partenariat Artistique" focusBorderColor="purple.400" />
                </FormControl>
                <FormControl id="message">
                  <FormLabel>Message</FormLabel>
                  <Textarea name="message" value={formData.message} onChange={handleInputChange} rows={5} placeholder="Présentez votre projet artistique ou Web3..." required focusBorderColor="purple.400" resize="vertical" />
                </FormControl>
                <Button type="submit" isLoading={isSubmitting} loadingText="Transmission..." colorScheme="purple" size="lg" w="full" boxShadow="xl" _hover={{ boxShadow: "2xl" }}>
                  Transmettre au Bureau
                </Button>
              </VStack>
            </Box>
          </motion.div>
          */}
        </Grid>

        {/* Bureau Dirigeants */}
        <VStack spacing={12} w="full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}>
            <Heading as="h2" size="3xl" textAlign="center" mb={4}>Les Dirigeants de RESCOE</Heading>
            <Text fontSize="lg" textAlign="center" maxW="2xl" mx="auto" opacity={0.8} mb={2}>
              Bureau élu de l'association d'art et Web3.
            </Text>
            <Text fontSize="md" textAlign="center" maxW="xl" mx="auto" opacity={0.7}>
              <strong>Remerciements :</strong> Application développée bénévolement par <em>BLOCKOS MEMORS</em>,
              entreprise experte blockchain et mandales.
            </Text>
          </motion.div>
          <Grid templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={8}>
            {teamMembers.map((member, index) => (
              <GridItem key={index}>
                <Box
                  p={8}
                  borderWidth={1}
                  borderRadius="3xl"
                  textAlign="center"
                  boxShadow="xl"
                  _hover={{ transform: "translateY(-12px)", boxShadow: "2xl" }}
                  transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
                  position="relative"
                  overflow="hidden"
                >
                  <Box position="absolute" top={4} right={4}>
                    <Badge colorScheme="purple" px={3} py={1}>Rescoe</Badge>
                  </Box>
                  <Image src={member.image} alt={member.name} borderRadius="2xl" boxSize="140px" mx="auto" mb={6} boxShadow="lg" />
                  <Heading as="h3" size="md" mb={2}>{member.name}</Heading>
                  <Text fontWeight="bold" color="purple.400" mb={1}>{member.role}</Text>
                  <Text opacity={0.8} mb={4} lineHeight={1.4}>{member.description}</Text>
                  <VStack spacing={1} mb={6} align="start" w="full">
                    {member.expertise.map((exp, i) => (
                      <HStack key={i} spacing={2}>
                        <Icon as={FaPalette} boxSize={4} color="purple.400" />
                        <Text fontSize="sm">{exp}</Text>
                      </HStack>
                    ))}
                  </VStack>
                  {member.social && (
                    <Button as={Link} href={member.social} isExternal size="sm" colorScheme="purple" w="full" leftIcon={<FaGlobe />}>
                      Instagram
                    </Button>
                  )}
                </Box>
              </GridItem>
            ))}
          </Grid>
        </VStack>
      </Container>

      {/* Modal Succès Bureau */}
      {/*
      <Modal isOpen={isSuccessModalOpen} onClose={() => setIsSuccessModalOpen(false)} isCentered size="xl">
        <ModalOverlay />
        <ModalContent color="black" borderRadius="3xl" borderWidth={1}>
          <ModalHeader textAlign="center">
            <Icon as={FaEnvelope} boxSize={12} color="purple.400" mb={2} />
            Message Reçu par le Bureau
          </ModalHeader>
          <ModalCloseButton color="black" />
          <ModalBody textAlign="center" py={8}>
            <Text fontSize="lg" mb={4}>Merci {formData.name} pour votre intérêt artistique.</Text>
            <Text opacity={0.8}>Un dirigeant vous répondra sous 48h.</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
      */}
    </Box>
  );
};

export default ContactPage;
