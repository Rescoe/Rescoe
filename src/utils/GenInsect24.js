import GIF from 'gif.js';
import { parseGIF, decompressFrames } from 'gifuct-js';

// Liste des fichiers d'images par catégorie
const basePath = '../gifs/';
const imageFiles = {
    wings: ['Ailes1.gif', 'Ailes2.gif'],
    antennas: ['Antennes1.gif', 'Antennes2.gif', 'Antennes3.gif'],
    heads: ['Tete1.gif', 'Tete2.gif', 'Tete3.gif', 'Tete4.gif', 'Tete5.gif'],
    bodies: ['Corps1.gif', 'Corps2.gif', 'Corps3.gif', 'Corps4.gif'],
    legs: ['Pattes1.gif', 'Pattes2.gif', 'Pattes3.gif', 'Pattes4.gif', 'Pattes5.gif'],
};

// Fonction pour obtenir un élément aléatoire
const getRandomElementFromCategory = (category) => {
    const randomIndex = Math.floor(Math.random() * imageFiles[category].length);
    return `${basePath}${imageFiles[category][randomIndex]}`;
};

// Fonction pour extraire les frames d'un GIF à l'aide de gifuct-js
const loadGifFrames = async (gifUrl) => {
    const response = await fetch(gifUrl);
    const arrayBuffer = await response.arrayBuffer();
    const gif = parseGIF(arrayBuffer); // Parse le GIF
    const frames = decompressFrames(gif, true); // Décompresse les frames du GIF

    // Convertir les frames en objets image
    return frames.map(frame => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = frame.dims.width;
        canvas.height = frame.dims.height;

        // Appliquer le patch sur le canvas
        const imageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
        ctx.putImageData(imageData, 0, 0);

        return canvas;
    });
};

// Fonction pour combiner les frames (superposition des images)
const combineFrames = (frames) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Utiliser les dimensions de la première frame comme référence
    const width = frames[0].width;
    const height = frames[0].height;

    canvas.width = width;
    canvas.height = height;

    // Superposer toutes les frames sur le même canvas
    frames.forEach(frame => {
        ctx.drawImage(frame, 0, 0);
    });

    return canvas;
};

// Fonction pour combiner les GIFs et créer un GIF animé
const getRandomInsectGif = async () => {
    // Récupère un élément aléatoire pour chaque catégorie
    const layers = [
        getRandomElementFromCategory('legs'),
        getRandomElementFromCategory('bodies'),
        getRandomElementFromCategory('heads'),
        getRandomElementFromCategory('wings'),
        getRandomElementFromCategory('antennas'),
    ];

    const gif = new GIF({
        workers: 2,
        quality: 10,
        transparent: 'rgba(0,0,0,0)',  // Fond transparent
    });

    // Charger toutes les frames des GIFs sélectionnés
    const loadedFrames = await Promise.all(layers.map(loadGifFrames));

    // Trouver le nombre maximum de frames parmi toutes les couches (GIFs)
    const numFrames = Math.max(...loadedFrames.map(frames => frames.length));

    // Pour chaque frame de chaque GIF (layer)
    for (let i = 0; i < numFrames; i++) {
        const frameLayers = [];
        // Combiner les frames de chaque layer
        for (const layerFrames of loadedFrames) {
            const frameIndex = i % layerFrames.length;  // Gérer les GIFs de tailles différentes
            const frame = layerFrames[frameIndex];
            frameLayers.push(frame);
        }

        // Créer une frame combinée avec les frames de chaque couche
        const combinedFrame = combineFrames(frameLayers);
        gif.addFrame(combinedFrame, { copy: true, delay: 500 });
    }

    // Générer le GIF
    return new Promise((resolve, reject) => {
        gif.on('finished', (blob) => {
            const gifURL = URL.createObjectURL(blob);
            resolve(gifURL); // Retourner l'URL du GIF généré
        });
        gif.render();
    });
};

export default getRandomInsectGif;
