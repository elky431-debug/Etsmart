export type Language = 'fr' | 'en';

export const translations = {
  fr: {
    // Navigation
    'nav.startAnalyzing': 'Commencer l\'analyse',
    'nav.subscription': 'Abonnement',
    'nav.profile': 'Profil',
    'nav.history': 'Historique',
    'nav.settings': 'Paramètres',
    'nav.returnHome': 'Retour à l\'accueil',
    'nav.signOut': 'Se déconnecter',
    'nav.home': 'Accueil',
    'nav.dashboard': 'Tableau de bord',
    
    // Homepage
    'home.title': 'Lancez des produits rentables',
    'home.subtitle': 'sur Etsy',
    'home.description': 'Notre IA analyse vos produits AliExpress et révèle leur véritable potentiel sur Etsy.',
    'home.analyzeButton': 'Analyser mon produit',
    'home.discoverFeatures': 'Découvrir les fonctionnalités',
    'home.getStarted': 'Commencer maintenant',
    'home.choosePlan': 'Choisir un plan',
    'home.createAccount': 'Créer un compte',
    'home.login': 'Connexion',
    
    // Settings
    'settings.title': 'Paramètres',
    'settings.general': 'Général',
    'settings.targetCountry': 'Pays cible',
    'settings.targetCountryDesc': 'Pays principal pour vos ventes Etsy',
    'settings.currency': 'Devise',
    'settings.language': 'Langue',
    'settings.changePassword': 'Changer le mot de passe',
    'settings.currentPassword': 'Mot de passe actuel',
    'settings.newPassword': 'Nouveau mot de passe',
    'settings.confirmPassword': 'Confirmer le nouveau mot de passe',
    'settings.passwordMinLength': 'Doit contenir au moins 8 caractères',
    'settings.changePasswordButton': 'Changer le mot de passe',
    'settings.changing': 'Changement en cours...',
    'settings.saveSettings': 'Enregistrer les paramètres',
    'settings.saving': 'Enregistrement...',
    'settings.saved': 'Paramètres enregistrés avec succès !',
    
    // Dashboard
    'dashboard.howItWorks': 'Comment fonctionne l\'analyse ?',
    'dashboard.description': 'Notre IA analyse en profondeur vos produits AliExpress pour vous donner toutes les informations nécessaires à une décision éclairée',
    'dashboard.ready': 'Prêt à découvrir le potentiel de vos produits ?',
    'dashboard.readyDesc': 'Lancez votre première analyse en quelques clics et recevez un rapport complet en moins de 2 minutes',
    'dashboard.startAnalyzing': 'Commencer l\'analyse',
    'dashboard.processTitle': 'Le processus en 3 étapes',
    'dashboard.step1Title': '1. Analyse visuelle',
    'dashboard.step1Desc': 'Notre IA examine l\'image de votre produit pour comprendre ce que c\'est, identifier sa niche et estimer sa valeur',
    'dashboard.step2Title': '2. Analyse de marché',
    'dashboard.step2Desc': 'Recherche de concurrents sur Etsy, analyse de la saturation du marché et estimation du potentiel de ventes',
    'dashboard.step3Title': '3. Rapport complet',
    'dashboard.step3Desc': 'Vous recevez un verdict clair avec toutes les données nécessaires : prix, marketing, SEO et stratégie',
    
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'common.edit': 'Modifier',
    'common.back': 'Retour',
  },
  en: {
    // Navigation
    'nav.startAnalyzing': 'Start analyzing',
    'nav.subscription': 'Subscription',
    'nav.profile': 'Profile',
    'nav.history': 'History',
    'nav.settings': 'Settings',
    'nav.returnHome': 'Return to home',
    'nav.signOut': 'Sign out',
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    
    // Homepage
    'home.title': 'Launch profitable products',
    'home.subtitle': 'on Etsy',
    'home.description': 'Our AI analyzes your AliExpress products and reveals their real potential on Etsy.',
    'home.analyzeButton': 'Analyze my product',
    'home.discoverFeatures': 'Discover features',
    'home.getStarted': 'Get started now',
    'home.choosePlan': 'Choose plan',
    'home.createAccount': 'Create account',
    'home.login': 'Login',
    
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.targetCountry': 'Target country',
    'settings.targetCountryDesc': 'Main country for your Etsy sales',
    'settings.currency': 'Currency',
    'settings.language': 'Language',
    'settings.changePassword': 'Change Password',
    'settings.currentPassword': 'Current password',
    'settings.newPassword': 'New password',
    'settings.confirmPassword': 'Confirm new password',
    'settings.passwordMinLength': 'Must be at least 8 characters long',
    'settings.changePasswordButton': 'Change Password',
    'settings.changing': 'Changing...',
    'settings.saveSettings': 'Save settings',
    'settings.saving': 'Saving...',
    'settings.saved': 'Settings saved successfully!',
    
    // Dashboard
    'dashboard.howItWorks': 'How does the analysis work?',
    'dashboard.description': 'Our AI deeply analyzes your AliExpress products to give you all the information needed for an informed decision',
    'dashboard.ready': 'Ready to discover your products\' potential?',
    'dashboard.readyDesc': 'Launch your first analysis in a few clicks and receive a complete report in less than 2 minutes',
    'dashboard.startAnalyzing': 'Start analyzing',
    'dashboard.processTitle': 'The process in 3 steps',
    'dashboard.step1Title': '1. Visual analysis',
    'dashboard.step1Desc': 'Our AI examines your product image to understand what it is, identify its niche and estimate its value',
    'dashboard.step2Title': '2. Market analysis',
    'dashboard.step2Desc': 'Search for competitors on Etsy, analyze market saturation and estimate sales potential',
    'dashboard.step3Title': '3. Complete report',
    'dashboard.step3Desc': 'You receive a clear verdict with all necessary data: pricing, marketing, SEO and strategy',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.back': 'Back',
  },
};

export function getTranslation(key: string, lang: Language): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      // Fallback to English if translation missing
      value = translations.en;
      for (const k2 of keys) {
        value = value?.[k2];
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

