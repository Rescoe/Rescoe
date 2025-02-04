// moralisConfig.js
import Moralis from 'moralis';

const initializeMoralis = async () => {
  await Moralis.start({
    apiKey: process.env.MORALIS_API_KEY, // Assurez-vous que cette clé est définie dans votre fichier .env
  });
};

export default initializeMoralis;
