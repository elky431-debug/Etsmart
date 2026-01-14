import type { NicheInfo } from '@/types';

export const niches: NicheInfo[] = [
  {
    id: 'personalized-gifts',
    name: 'Cadeaux Personnalisés',
    description: 'Articles personnalisables avec noms, dates ou messages',
    icon: 'gift',
    avgCompetition: 'high',
    avgDemand: 'high',
  },
  {
    id: 'wedding',
    name: 'Mariage',
    description: 'Décoration, invitations et accessoires de mariage',
    icon: 'heart',
    avgCompetition: 'high',
    avgDemand: 'high',
  },
  {
    id: 'home-decor',
    name: 'Décoration Maison',
    description: 'Art mural, objets déco et accessoires intérieurs',
    icon: 'home',
    avgCompetition: 'medium',
    avgDemand: 'high',
  },
  {
    id: 'pets',
    name: 'Animaux',
    description: 'Accessoires, portraits et cadeaux pour animaux',
    icon: 'pawprint',
    avgCompetition: 'medium',
    avgDemand: 'medium',
  },
  {
    id: 'baby',
    name: 'Bébé & Naissance',
    description: 'Cadeaux de naissance, vêtements et accessoires bébé',
    icon: 'baby',
    avgCompetition: 'medium',
    avgDemand: 'high',
  },
  {
    id: 'wellness',
    name: 'Bien-être',
    description: 'Bougies, soins naturels et articles relaxation',
    icon: 'sparkles',
    avgCompetition: 'low',
    avgDemand: 'medium',
  },
  {
    id: 'jewelry',
    name: 'Bijoux',
    description: 'Colliers, bracelets et boucles d\'oreilles artisanaux',
    icon: 'gem',
    avgCompetition: 'high',
    avgDemand: 'high',
  },
  {
    id: 'art',
    name: 'Art & Illustrations',
    description: 'Prints, posters et œuvres d\'art originales',
    icon: 'palette',
    avgCompetition: 'medium',
    avgDemand: 'medium',
  },
  {
    id: 'vintage',
    name: 'Vintage & Rétro',
    description: 'Articles vintage et inspirations rétro',
    icon: 'clock',
    avgCompetition: 'low',
    avgDemand: 'medium',
  },
  {
    id: 'crafts',
    name: 'Artisanat & DIY',
    description: 'Kits créatifs et fournitures artisanales',
    icon: 'scissors',
    avgCompetition: 'low',
    avgDemand: 'medium',
  },
  {
    id: 'sport',
    name: 'Sport & Fitness',
    description: 'Accessoires sportifs, équipements fitness et articles de motivation',
    icon: 'activity',
    avgCompetition: 'medium',
    avgDemand: 'high',
  },
  {
    id: 'fashion',
    name: 'Mode & Vêtements',
    description: 'Vêtements, accessoires mode et articles de style personnalisés',
    icon: 'shirt',
    avgCompetition: 'high',
    avgDemand: 'high',
  },
  {
    id: 'kitchen',
    name: 'Cuisine & Maison',
    description: 'Accessoires de cuisine, ustensiles et articles pour la maison',
    icon: 'utensils',
    avgCompetition: 'medium',
    avgDemand: 'high',
  },
  {
    id: 'garden',
    name: 'Jardin & Extérieur',
    description: 'Décoration extérieure, accessoires jardin et articles pour terrasses',
    icon: 'flower',
    avgCompetition: 'low',
    avgDemand: 'medium',
  },
  {
    id: 'custom',
    name: 'Autre Niche',
    description: 'Définissez votre propre niche personnalisée',
    icon: 'plus',
    avgCompetition: 'medium',
    avgDemand: 'medium',
  },
];

export const getNicheById = (id: string): NicheInfo | undefined => {
  return niches.find((n) => n.id === id);
};

export const getCompetitionColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      return 'text-[#00c9b7]';
    case 'medium':
      return 'text-orange-400';
    case 'high':
      return 'text-rose-400';
  }
};

export const getDemandColor = (level: 'low' | 'medium' | 'high'): string => {
  switch (level) {
    case 'low':
      return 'text-rose-400';
    case 'medium':
      return 'text-orange-400';
    case 'high':
      return 'text-[#00c9b7]';
  }
};
