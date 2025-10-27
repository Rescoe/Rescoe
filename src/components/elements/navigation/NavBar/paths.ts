// src/components/navigation/NAV_LINKS.ts
import {
  FaHome,
  FaHandshake,
  FaEthereum,
  FaImages,
  FaPalette,
  FaChalkboardTeacher,
  FaImage,
  FaSketch,
  FaNewspaper,
  FaCalendarAlt,
  FaFeather,
  FaRegAddressCard,
  FaUserCheck,
  FaUsers,
  FaPaintBrush,
  FaPen,
  FaBookOpen,
  FaCode,
  FaGem,
  FaBug,
} from 'react-icons/fa';
import { ISubNav } from '../SubNav/SubNav';

const NAV_LINKS: ISubNav[] = [
  {
    label: 'Accueil',
    subLabel: 'Explorer les dernières créations et actualités du réseau',
    href: '/',
    icon: FaHome,
  },

  {
    label: 'L’association',
    subLabel: 'Nos valeurs, nos membres et nos contacts',
    href: '/association',
    icon: FaUsers,

    children: [
      {
        label: 'Présentation',
        subLabel: 'Découvrir la mission et les actions du RESCOE',
        href: '/association/rescoe',
        icon: FaHandshake,
      },
      {
        label: 'Adhérents',
        subLabel: 'Rencontrez les artistes et membres du réseau',
        href: '/association/adherent',
        icon: FaUserCheck,
      },
      {
        label: 'Contacts',
        subLabel: 'Entrer en contact avec notre équipe',
        href: '/association/contact',
        icon: FaRegAddressCard,
      },
    ],
  },

  {
    label: 'Créer',
    subLabel: 'Mintez votre art, code ou poésie sur la blockchain',
    href: '/mintart',
    icon: FaEthereum,
    requiresAuth: true,

    children: [
      {
        label: 'Art visuel',
        subLabel: 'Créez une œuvre unique en un clic',
        href: '/mint/mintart',
        icon: FaPaintBrush,
      },
      {
        label: 'Poésie',
        subLabel: 'Publiez vos poèmes et immortalisez vos mots',
        href: '/mint/poesie',
        icon: FaFeather,
      },
      /*
      {
        label: 'Art génératif',
        subLabel: 'Codez et mintez vos algorithmes créatifs',
        href: '/mint/generative',
        icon: FaCode,
      },
      */
    ],
  },

  {
    label: 'Galerie',
    subLabel: 'Explorez les œuvres et poèmes du réseau RESCOE',
    href: '/galerie',
    icon: FaGem,

    children: [
      {
        label: 'Œuvres',
        subLabel: 'Collection d’œuvres numériques uniques',
        href: '/galerie/art',
        icon: FaImage,
      },
      {
        label: 'Poèmes',
        subLabel: 'Recueil de poèmes des membres du réseau',
        href: '/galerie/poesie',
        icon: FaBookOpen,
      },
    ],
  },

  {
    label: 'Agenda',
    subLabel: 'Ateliers, expositions et actualités du réseau',
    href: '/actus',
    icon: FaCalendarAlt,
  },
];

export default NAV_LINKS;
