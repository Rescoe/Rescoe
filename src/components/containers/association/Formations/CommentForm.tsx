import React, { useState } from 'react';
import { Box, Button, Textarea, VStack, FormControl, FormLabel, Heading, Alert, AlertIcon } from '@chakra-ui/react';
import { motion } from 'framer-motion';

const CommentForm: React.FC = () => {
  const [comment, setComment] = useState<string>('');
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null); // Typage explicite pour submitStatus

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { // Typage de l'événement ici
    e.preventDefault();

    // Simuler l'envoi du commentaire (à remplacer par la logique de backend / blockchain)
    if (comment.trim()) {
      // Réinitialiser le formulaire et afficher le statut de succès
      setComment('');
      setSubmitStatus('success');
    } else {
      // Afficher une erreur si le commentaire est vide
      setSubmitStatus('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box p={5} borderWidth="1px" borderRadius="lg" bg="black.50">
        <Heading as="h3" size="md" mb={4} textAlign="center">
          Laissez un commentaire sur la formation
        </Heading>
        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl id="comment" isRequired>
              <FormLabel>Votre commentaire</FormLabel>
              <Textarea
                placeholder="Partagez votre retour sur la formation..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </FormControl>
            <Button colorScheme="blue" type="submit">
              Soumettre le commentaire
            </Button>
            {submitStatus === 'success' && (
              <Alert status="success" borderRadius="md">
                <AlertIcon />
                Merci pour votre commentaire ! Il a bien été enregistré.
              </Alert>
            )}
            {submitStatus === 'error' && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                Veuillez entrer un commentaire avant de le soumettre.
              </Alert>
            )}
          </VStack>
        </form>
      </Box>
    </motion.div>
  );
};

export default CommentForm;
