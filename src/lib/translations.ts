export type Language = 'fr' | 'en';

export const translations = {
  fr: {
    // Navigation
    'startAnalyzing': 'Commencer l\'analyse',
    'subscription': 'Abonnement',
    'profile': 'Profil',
    'history': 'Historique',
    'settings': 'Paramètres',
    'returnHome': 'Retour à l\'accueil',
    'signOut': 'Se déconnecter',
    'home': 'Accueil',
    'dashboard': 'Tableau de bord',
    
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
    'home.descriptionFull': 'Notre IA analyse vos produits AliExpress et révèle leur véritable potentiel sur Etsy. Plus d\'échecs coûteux, lancez en toute confiance.',
    'home.poweredBy': 'Propulsé par l\'IA • GPT-4',
    'home.features': 'Fonctionnalités',
    'home.featuresTitle': 'Tout ce dont vous avez besoin pour',
    'home.featuresSubtitle': 'dominer sur Etsy',
    'home.featuresDesc': 'Une suite complète d\'outils IA pour analyser, simuler et optimiser vos lancements de produits.',
    'home.feature1Title': 'Analyse IA avancée',
    'home.feature1Desc': 'Notre IA analyse en profondeur le marché Etsy et prédit le potentiel de vos produits.',
    'home.feature2Title': 'Simulation réaliste',
    'home.feature2Desc': 'Simulez vos ventes avec des projections conservatrices, réalistes et optimistes.',
    'home.feature3Title': 'Prix optimal',
    'home.feature3Desc': 'Recevez des recommandations de prix basées sur la concurrence et vos marges.',
    'home.feature4Title': 'Détection des risques',
    'home.feature4Desc': 'Identifiez les marchés saturés et évitez les erreurs coûteuses avant de lancer.',
    'home.feature5Title': 'Analyse concurrentielle',
    'home.feature5Desc': 'Découvrez qui domine votre niche et comment vous différencier efficacement.',
    'home.feature6Title': 'Verdict intelligent',
    'home.feature6Desc': 'Un verdict clair et actionnable : Lancer, Marché concurrentiel, ou Éviter.',
    'home.stats1': 'Produits analysés',
    'home.stats2': 'Vendeurs actifs',
    'home.stats3': 'Précision IA',
    'home.stats4': 'Disponibilité',
    'home.howItWorks': 'Comment ça marche',
    'home.howItWorksTitle': 'Analysez en',
    'home.howItWorksSubtitle': '3 étapes',
    'home.step1Title': 'Choisissez votre niche',
    'home.step1Desc': 'Sélectionnez parmi nos niches populaires ou entrez la vôtre.',
    'home.step2Title': 'Ajoutez vos produits',
    'home.step2Desc': 'Collez le lien AliExpress ou entrez les détails de votre produit.',
    'home.step3Title': 'Obtenez votre verdict',
    'home.step3Desc': 'Notre IA analyse et vous donne un verdict clair et actionnable.',
    'home.pricing': 'Tarification',
    'home.pricingTitle': 'Tarification',
    'home.pricingSubtitle': 'transparente',
    'home.pricingDesc': 'Commencez gratuitement, passez à la version supérieure quand vous êtes prêt.',
    'home.planSmart': 'Smart',
    'home.planPro': 'Pro',
    'home.planScale': 'Scale',
    'home.planMonth': '/mois',
    'home.planSmartDesc': 'Parfait pour les vendeurs qui veulent tester des produits sérieusement. Toutes les fonctionnalités incluses.',
    'home.planProDesc': 'Idéal pour les vendeurs actifs qui analysent plusieurs produits par mois. Toutes les fonctionnalités incluses.',
    'home.planScaleDesc': 'Pour les boutiques à fort volume testant de nombreux produits stratégiquement. Toutes les fonctionnalités incluses.',
    'home.planFeature1': 'analyses / mois',
    'home.planFeature2': 'Toutes les fonctionnalités incluses',
    'home.planMostPopular': 'Le plus populaire',
    'home.planGetStarted': 'Commencer',
    'home.testimonials': 'Témoignages',
    'home.testimonialsTitle': 'Ils nous',
    'home.testimonialsSubtitle': 'font confiance',
    'home.testimonial1Role': 'Vendeur Pro Etsy',
    'home.testimonial1Content': 'Etsmart m\'a évité de lancer 3 produits qui auraient été des échecs. L\'analyse IA est remarquablement précise.',
    'home.testimonial2Role': 'Dropshipper',
    'home.testimonial2Content': 'Le verdict Lancer/Éviter me fait gagner des heures de recherche. Essentiel pour tout vendeur sérieux.',
    'home.testimonial3Role': 'Créateur POD',
    'home.testimonial3Content': 'Les recommandations de prix sont parfaites. J\'ai augmenté mes marges de 40% grâce à Etsmart.',
    'home.finalCtaTitle': 'Prêt à lancer votre',
    'home.finalCtaSubtitle': 'prochain succès ?',
    'home.finalCtaDesc': 'Rejoignez des milliers de vendeurs utilisant Etsmart pour prendre de meilleures décisions et maximiser leurs profits.',
    'home.finalCtaButton': 'Commencer gratuitement',
    'home.finalCtaNoCard': 'Aucune carte bancaire requise',
    'home.about': 'À propos',
    
    // Settings
    'settingsTitle': 'Paramètres',
    'general': 'Général',
    'targetCountry': 'Pays cible',
    'targetCountryDesc': 'Pays principal pour vos ventes Etsy',
    'currency': 'Devise',
    'language': 'Langue',
    'changePassword': 'Changer le mot de passe',
    'currentPassword': 'Mot de passe actuel',
    'newPassword': 'Nouveau mot de passe',
    'confirmPassword': 'Confirmer le nouveau mot de passe',
    'passwordMinLength': 'Doit contenir au moins 8 caractères',
    'changePasswordButton': 'Changer le mot de passe',
    'changing': 'Changement en cours...',
    'saveSettings': 'Enregistrer les paramètres',
    'saving': 'Enregistrement...',
    'saved': 'Paramètres enregistrés avec succès !',
    
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
    'startAnalyzing': 'Start analyzing',
    'subscription': 'Subscription',
    'profile': 'Profile',
    'history': 'History',
    'settings': 'Settings',
    'returnHome': 'Return to home',
    'signOut': 'Sign out',
    'home': 'Home',
    'dashboard': 'Dashboard',
    
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
    'home.descriptionFull': 'Our AI analyzes your AliExpress products and reveals their real potential on Etsy. No more costly failures, launch with confidence.',
    'home.poweredBy': 'Powered by AI • GPT-4',
    'home.features': 'Features',
    'home.featuresTitle': 'Everything you need to',
    'home.featuresSubtitle': 'dominate on Etsy',
    'home.featuresDesc': 'A complete suite of AI tools to analyze, simulate and optimize your product launches.',
    'home.feature1Title': 'Advanced AI Analysis',
    'home.feature1Desc': 'Our AI deeply analyzes the Etsy market and predicts your products\' potential.',
    'home.feature2Title': 'Realistic Simulation',
    'home.feature2Desc': 'Simulate your sales with conservative, realistic, and optimistic projections.',
    'home.feature3Title': 'Optimal Pricing',
    'home.feature3Desc': 'Receive pricing recommendations based on competition and your margins.',
    'home.feature4Title': 'Risk Detection',
    'home.feature4Desc': 'Identify saturated markets and avoid costly mistakes before launching.',
    'home.feature5Title': 'Competitor Analysis',
    'home.feature5Desc': 'Discover who dominates your niche and how to differentiate effectively.',
    'home.feature6Title': 'Intelligent Verdict',
    'home.feature6Desc': 'A clear and actionable verdict: Launch, Competitive Market, or Avoid.',
    'home.stats1': 'Products analyzed',
    'home.stats2': 'Active sellers',
    'home.stats3': 'AI accuracy',
    'home.stats4': 'Availability',
    'home.howItWorks': 'How it works',
    'home.howItWorksTitle': 'Analyze in',
    'home.howItWorksSubtitle': '3 steps',
    'home.step1Title': 'Choose your niche',
    'home.step1Desc': 'Select from our popular niches or enter your own.',
    'home.step2Title': 'Add your products',
    'home.step2Desc': 'Paste the AliExpress link or enter your product details.',
    'home.step3Title': 'Get your verdict',
    'home.step3Desc': 'Our AI analyzes and gives you a clear and actionable verdict.',
    'home.pricing': 'Pricing',
    'home.pricingTitle': 'Transparent',
    'home.pricingSubtitle': 'pricing',
    'home.pricingDesc': 'Start for free, upgrade when you\'re ready.',
    'home.planSmart': 'Smart',
    'home.planPro': 'Pro',
    'home.planScale': 'Scale',
    'home.planMonth': '/month',
    'home.planSmartDesc': 'Perfect for sellers who want to test products seriously. All features included.',
    'home.planProDesc': 'Ideal for active sellers who analyze multiple products monthly. All features included.',
    'home.planScaleDesc': 'For high-volume shops testing many products strategically. All features included.',
    'home.planFeature1': 'analyses / month',
    'home.planFeature2': 'All features included',
    'home.planMostPopular': 'Most popular',
    'home.planGetStarted': 'Get started',
    'home.testimonials': 'Testimonials',
    'home.testimonialsTitle': 'They trust',
    'home.testimonialsSubtitle': 'us',
    'home.testimonial1Role': 'Etsy Pro Seller',
    'home.testimonial1Content': 'Etsmart saved me from launching 3 products that would have been failures. The AI analysis is impressively accurate.',
    'home.testimonial2Role': 'Dropshipper',
    'home.testimonial2Content': 'The Launch/Avoid verdict saves me hours of research. Essential for any serious seller.',
    'home.testimonial3Role': 'POD Creator',
    'home.testimonial3Content': 'The pricing recommendations are spot-on. I increased my margins by 40% thanks to Etsmart.',
    'home.finalCtaTitle': 'Ready to launch your',
    'home.finalCtaSubtitle': 'next success?',
    'home.finalCtaDesc': 'Join thousands of sellers using Etsmart to make better decisions and maximize their profits.',
    'home.finalCtaButton': 'Start for free',
    'home.finalCtaNoCard': 'No credit card required',
    'home.about': 'About',
    
    // Settings
    'settingsTitle': 'Settings',
    'general': 'General',
    'targetCountry': 'Target country',
    'targetCountryDesc': 'Main country for your Etsy sales',
    'currency': 'Currency',
    'language': 'Language',
    'changePassword': 'Change Password',
    'currentPassword': 'Current password',
    'newPassword': 'New password',
    'confirmPassword': 'Confirm new password',
    'passwordMinLength': 'Must be at least 8 characters long',
    'changePasswordButton': 'Change Password',
    'changing': 'Changing...',
    'saveSettings': 'Save settings',
    'saving': 'Saving...',
    'saved': 'Settings saved successfully!',
    
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
  try {
    const keys = key.split('.');
    let value: any = translations[lang];
    
    for (const k of keys) {
      if (value === undefined || value === null) {
        break;
      }
      value = value[k];
    }
    
    // If translation found, return it
    if (typeof value === 'string') {
      return value;
    }
    
    // Fallback to English if translation missing
    value = translations.en;
    for (const k of keys) {
      if (value === undefined || value === null) {
        return key; // Return key if not found in English either
      }
      value = value[k];
    }
    
    return typeof value === 'string' ? value : key;
  } catch (error) {
    console.error('Translation error:', error, 'key:', key, 'lang:', lang);
    return key;
  }
}

