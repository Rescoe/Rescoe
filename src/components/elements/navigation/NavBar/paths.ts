import { FaHome, FaHandshake, FaEthereum, FaImages, FaPalette, FaChalkboardTeacher, FaImage , FaSketch , FaNewspaper, FaCalendarAlt, FaFeather, FaRegAddressCard, FaUserCheck, FaUsers, FaPaintBrush, FaPen, FaBookOpen, FaCode, FaGem, FaBug } from 'react-icons/fa';
import { ISubNav } from '../SubNav/SubNav';

const NAV_LINKS: ISubNav[] = [
  { label: 'Accueil', href: '/', icon: FaHome },  // Ajout de l'icône

  {
    label: 'Association',
    href: '/association', //Ajouter une page qui détaille les 4 onglets
    icon: FaUsers,  // Icône livre pour l'association

    children: [
      {
        label: "L'association",
        subLabel: 'Qui sommes nous ?',
        href: '/association/rescoe',
        icon: FaHandshake,  // Icône livre pour l'association
      },
      {
        label: "Adhérents",
        subLabel: 'Liste des adhérents',
        href: '/association/adherent',
        icon: FaBug  ,  // Icône livre pour l'association
      },
      {
        label: "Ateliers",
        subLabel: 'Découvrir nos offres',
        href: '/association/formations',
        icon: FaChalkboardTeacher ,  // Icône livre pour l'association
      },
      {
        label: "Contacts",
        subLabel: 'Qui sommes nous ?',
        href: '/association/contact',
        icon: FaRegAddressCard ,  // Icône livre pour l'association
      },

    ],
  },

  {
    label: 'Minter',
    href: '/mintart',
    icon: FaEthereum ,  // Icône palette ajoutée
    requiresAuth: true, // Ajout de la propriété
    children: [
      {
        label: "Art 1/1",
        subLabel: 'Créez une oeuvre unique',
        href: '/mint/mintart',
        icon: FaPaintBrush,  // Icône livre pour l'association
      },
      /*
      {
        label: 'Art génératif',
        subLabel: 'Mintez du code !',
        href: '/mint/art-generatif',
        icon: FaCode,  // Icône flèches pour les NFT
      },
    */

      {
        label: 'Poesie',
        subLabel: 'Mintez vos poèmes',
        href: '/mint/poesie',
        icon: FaFeather,  // Icône flèches pour les NFT
      },
    ],
  },

  {
    label: 'Galerie',
    href: '/galerie',
    icon: FaGem ,  // Icône livre pour l'association

    children: [
      {
        label: 'Digital Art',
        subLabel: 'Collection digitale',
        href: '/galerie/art',
        icon: FaImage ,  // Icône pinceau pour les collections
      },
      /*
      {
        label: 'Generative Art',
        subLabel: 'Generative art collection',
        href: '/galerie/generative',
        icon: FaSketch,  // Icône pinceau pour les collections
      },
      */
      {
        label: 'Poemes',
        subLabel: 'Recueil de poèmes',
        href: '/galerie/poesie',
        icon: FaBookOpen,  // Icône flèches pour les NFT
      },
    ],
  },

  {
    label: 'Actu & Expo',
    href: '/actus',
    icon: FaNewspaper ,  // Icône livre pour l'association
/*
    children: [
      {
        label: 'Actus du moment',
        subLabel: 'Unique art collection',
        href: '/galerie/art',
        icon: FaSketch,  // Icône pinceau pour les collections
      },
      {
        label: '?',
        subLabel: 'Generative art collection',
        href: '/galerie/generative',
        icon: FaSketch,  // Icône pinceau pour les collections
      },
      {
        label: 'Poemes',
        subLabel: '/!\ Ne renvoi rien pour le moment',
        href: '/gelerie/poesie',
        icon: FaFeather,  // Icône flèches pour les NFT
      },
    ],
  */
  },

];

export default NAV_LINKS;
