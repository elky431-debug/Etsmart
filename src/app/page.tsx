'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  ArrowRight, 
  Menu, 
  X, 
  Sparkles, 
  Shield, 
  BarChart3, 
  Target, 
  LineChart, 
  ShoppingBag,
  Video,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  Globe,
  ArrowUpRight,
  Lock,
  Loader2,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { PLANS } from '@/types/subscription';

// Composant d'animation pour les sections
function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Composant d'animation pour les cartes avec délai
function AnimatedCard({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Petit composant pour la FAQ
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className="w-full text-left bg-black border border-white/10 rounded-xl px-4 sm:px-6 py-3 sm:py-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold text-sm sm:text-base text-white">{question}</p>
        <span className="text-white/60 text-lg">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <p className="mt-2 text-xs sm:text-sm text-white/70">
          {answer}
        </p>
      )}
    </button>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const features = [
    {
      icon: Sparkles,
      title: 'Analyse IA avancée',
      description: 'Analyse fine du marché Etsy pour valider rapidement le potentiel réel.',
    },
    {
      icon: LineChart,
      title: 'Simulation réaliste',
      description: 'Projections conservatrices, réalistes et optimistes pour décider vite.',
    },
    {
      icon: Target,
      title: 'Pricing optimal',
      description: 'Recommandations de prix basées sur la concurrence et la marge.',
    },
    {
      icon: Shield,
      title: 'Détection des risques',
      description: 'Repérez les marchés saturés et évitez les erreurs coûteuses.',
    },
    {
      icon: ShoppingBag,
      title: 'Boutiques concurrents',
      description: 'Identifiez les leaders et les angles exploitables de votre niche.',
    },
    {
      icon: BarChart3,
      title: 'Verdict intelligent',
      description: 'Un verdict clair et actionnable : Lancer, Tester ou Éviter.',
    },
    {
      icon: Video,
      title: 'Vidéos produit par IA',
      description: 'Génération de vidéos courtes pour mettre en valeur vos produits sur Etsy.',
    },
    {
      icon: FileText,
      title: 'Listing optimisé SEO',
      description: 'Création de titres, descriptions et tags optimisés pour le référencement Etsy.',
    },
    {
      icon: ImageIcon,
      title: 'Images produit par IA',
      description: 'Génération d’images lifestyle et visuels professionnels pour vos fiches produit.',
    },
  ];

  const testimonials = [
    {
      name: 'Thomas Brikia',
      role: 'Vendeur Pro Etsy',
      content: 'Etsmart m’a évité plusieurs lancements perdants. L’analyse est précise et rapide.',
      avatar: 'T',
      rating: 5,
    },
    {
      name: 'Samy Limam',
      role: 'Dropshipper',
      content: 'Le verdict est clair et le pricing est juste. Ça fait gagner un temps énorme.',
      avatar: 'S',
      rating: 5,
    },
    {
      name: 'Yosri Aulombard',
      role: 'Créateur POD',
      content: 'Les conseils sur la niche et les concurrents sont vraiment exploitables.',
      avatar: 'Y',
      rating: 5,
    },
  ];

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.12.48/build/spline-viewer.js';
    script.onload = () => setSplineLoaded(true);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!splineLoaded) return;
    const container = document.getElementById('spline-container');
    if (!container) return;
    // Clear + recréer le container pour forcer un vrai reload
    container.innerHTML = '';
    const viewer = document.createElement('spline-viewer');
    viewer.setAttribute('url', 'https://prod.spline.design/pzv1qS8TW6gHOHZT/scene.splinecode');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.display = 'block';
    container.appendChild(viewer);
  }, [splineLoaded]);

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="px-4 sm:px-6 lg:px-10 mt-3 sm:mt-4">
          <div className="flex items-center justify-between py-2.5 sm:py-3">
              <Link 
                href="/" 
                className="group cursor-pointer" 
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Logo size="md" showText={true} />
              </Link>

              <nav className="hidden md:flex items-center gap-6 text-base font-medium">
                <a href="#features" className="transition-colors cursor-pointer bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]">Fonctionnalités</a>
                <a href="#how" className="transition-colors cursor-pointer bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]">Comment ça marche</a>
                <a href="#pricing" className="transition-colors cursor-pointer bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]">Tarifs</a>
              </nav>

              {/* CTA Desktop */}
              <div className="hidden md:flex items-center gap-3">
                {!loading && user ? (
                  <Link href="/dashboard">
                    <button className="px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                      borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                      borderImageSlice: 1,
                    }}>
                      <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Tableau de bord</span>
                      <ArrowRight size={14} className="text-[#00c9b7]" />
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm text-white/90 hover:text-white transition-colors px-3 py-2 cursor-pointer">
                      Connexion
                    </Link>
                    <Link href="/register">
                      <button className="px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                        borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                        borderImageSlice: 1,
                      }}>
                        <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Inscription</span>
                      </button>
                    </Link>
                  </>
                )}
              </div>

              {/* Menu Button Mobile */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileMenuOpen(prev => !prev);
                }}
                className="md:hidden w-9 h-9 rounded-lg bg-transparent border border-white/5 hover:border-white/10 flex items-center justify-center active:scale-95 transition-all duration-100 cursor-pointer"
                aria-label="Toggle menu"
                type="button"
              >
                {mobileMenuOpen ? (
                  <X size={20} className="text-white" />
                ) : (
                  <Menu size={20} className="text-white" />
                )}
              </button>
            </div>
          </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <>
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
            />
            <div
              className="fixed top-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm bg-black/80 border border-white/5 rounded-lg z-50 md:hidden overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                {!loading && user ? (
                  <Link href="/dashboard?section=analyze" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full px-4 py-3.5 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                      borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                      borderImageSlice: 1,
                    }}>
                      <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Tableau de bord</span>
                      <ArrowRight size={18} className="text-[#00c9b7]" />
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <button className="w-full px-4 py-3 border border-white/10 text-white font-semibold rounded-lg cursor-pointer">
                        Connexion
                      </button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                      <button className="w-full px-4 py-3.5 font-semibold rounded-lg cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                        borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                        borderImageSlice: 1,
                      }}>
                        <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Inscription</span>
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Hero */}
      <section className="relative min-h-screen flex items-end justify-center pb-16 sm:pb-24 md:pb-28 overflow-hidden">
        {/* Spline Background - uniquement dans la landing */}
        <div className="absolute inset-0" id="spline-container" />
        <div className="relative z-10 text-center px-4 sm:px-6 w-full max-w-md mx-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <Link href="/app" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold flex items-center justify-center gap-2 cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              }}>
                <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Essayer gratuitement</span>
                <ArrowRight size={14} className="text-[#00c9b7] sm:w-4 sm:h-4" />
              </button>
            </Link>
            <Link href="#pricing" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base bg-transparent font-semibold transition-colors cursor-pointer border-2 hover:opacity-90" style={{
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              }}>
                <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Voir les tarifs</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Bloc social proof / témoignage (version Etscale adaptée à Etsmart) */}
      <section className="py-14 sm:py-20 md:py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="bg-black rounded-2xl sm:rounded-3xl px-6 sm:px-8 md:px-12 py-8 sm:py-10 md:py-14">
            <div className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)] gap-8 sm:gap-10 items-start">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-5 leading-tight">
                  Plus de 75 vendeurs gagnent du temps et valident leurs produits avec{' '}
                  <span className="text-[#00c9b7]">Etsmart</span>.
                </h2>
                <p className="text-sm sm:text-base md:text-lg text-white/80 max-w-lg">
                  Analyse de niche, listings SEO, images et vidéos par IA, espionnage concurrence — tout en un outil.
                  Prenez les bonnes décisions plus vite, sans perdre des heures.
                </p>
              </div>
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-xl sm:rounded-2xl bg-[#0a0a0a] px-4 sm:px-5 py-4 sm:py-5">
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#00c9b7]">+500</p>
                    <p className="text-xs sm:text-sm text-white/70 leading-snug mt-1">
                      analyses, listings & visuels
                    </p>
                  </div>
                  <div className="rounded-xl sm:rounded-2xl bg-[#0a0a0a] px-4 sm:px-5 py-4 sm:py-5">
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#00c9b7]">+75</p>
                    <p className="text-xs sm:text-sm text-white/70 leading-snug mt-1">
                      vendeurs actifs
                    </p>
                  </div>
                  <div className="rounded-xl sm:rounded-2xl bg-[#0a0a0a] px-4 sm:px-5 py-4 sm:py-5">
                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#00c9b7]">4,8/5</p>
                    <p className="text-xs sm:text-sm text-white/70 leading-snug mt-1">
                      satisfaction moyenne
                    </p>
                  </div>
                </div>
                <div className="rounded-xl sm:rounded-2xl bg-[#0a0a0a] px-5 sm:px-6 py-5 sm:py-6">
                  <div className="flex items-center gap-1 text-[#00c9b7] text-base sm:text-lg mb-3">
                    {'★★★★★'.split('').map((s, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>
                  <p className="text-sm sm:text-base md:text-lg text-white/90 mb-4 leading-relaxed">
                    “Avant Etsmart, je perdais des heures sur l’analyse et les listings. Maintenant je valide mes idées,
                    je génère mes visuels et je lance — tout en un endroit. Je sais quoi tester, pourquoi, et à quel prix.”
                  </p>
                    <p className="text-sm sm:text-base text-white/60">
                    Clément — Vendeur Etsy
                  </p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Section "système de décision" inspirée de la landing Etscale */}
      <section className="py-16 sm:py-20 md:py-28 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-5 leading-tight max-w-4xl mx-auto">
              Etsmart est ton{' '}
              <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">système de décision</span>
              {' '}avant lancement.
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/75 max-w-3xl mx-auto leading-relaxed">
              Il analyse la demande réelle, la concurrence et ton pricing, projette ton potentiel sur 3 mois
              et transforme une idée floue en plan d’action structuré.
            </p>
          </AnimatedSection>
          <div className="grid md:grid-cols-3 gap-5 sm:gap-8">
            <AnimatedCard delay={0}>
              <div className="h-full rounded-2xl border border-[#00d4ff]/30 bg-black px-5 sm:px-8 py-6 sm:py-8 hover:border-[#00d4ff]/60 transition-colors">
                <p className="text-sm font-bold bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent mb-3">01</p>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">Analyse & score stratégique</h3>
                <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                  Un score basé sur la demande réelle, la concurrence, la marge estimée et les zones à risque.
                  Tout est expliqué simplement pour que tu saches où tu mets les pieds.
                </p>
              </div>
            </AnimatedCard>
            <AnimatedCard delay={0.1}>
              <div className="h-full rounded-2xl border border-[#00d4ff]/30 bg-black px-5 sm:px-8 py-6 sm:py-8 hover:border-[#00d4ff]/60 transition-colors">
                <p className="text-sm font-bold bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent mb-3">02</p>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">Projection réaliste sur 3 mois</h3>
                <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                  Trois scénarios cohérents (prudent, réaliste, optimiste) pour visualiser ton potentiel de ventes,
                  ton chiffre d’affaires et ta marge avant d’investir.
                </p>
              </div>
            </AnimatedCard>
            <AnimatedCard delay={0.2}>
              <div className="h-full rounded-2xl border border-[#00d4ff]/30 bg-black px-5 sm:px-8 py-6 sm:py-8 hover:border-[#00d4ff]/60 transition-colors">
                <p className="text-sm font-bold bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent mb-3">03</p>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-3">Verdict clair & plan d’action</h3>
                <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                  Lancer, tester intelligemment ou éviter : Etsmart te donne un verdict clair avec des
                  recommandations concrètes à appliquer sur ton listing et ta stratégie produit.
                </p>
              </div>
            </AnimatedCard>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 sm:py-16 md:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <span className="font-medium mb-2 sm:mb-3 block uppercase tracking-wider text-xs bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Fonctionnalités</span>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white px-2">
                Tout ce qu'il faut pour dominer sur Etsy
              </h2>
              <p className="text-white/70 text-sm sm:text-base max-w-2xl mx-auto mt-2 sm:mt-3 px-2">
                Une suite complète d'outils IA pour analyser, simuler et optimiser vos lancements.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {features.map((feature, index) => (
              <AnimatedCard key={feature.title} delay={index * 0.1}>
                <div className="p-4 sm:p-6 md:p-8 rounded-lg border border-white/5 bg-transparent hover:border-white/10 transition-colors">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3 sm:mb-5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-1.5 sm:mb-2">{feature.title}</h3>
                  <p className="text-white/70 text-xs sm:text-sm leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - style CREIX */}
      <section id="how" className="py-12 sm:py-16 md:py-28 bg-black">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00c9b7] border border-[#00c9b7] mb-4">
                <Zap className="w-4 h-4 text-white" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white">Simple & rapide</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
                Comment ça marche ?
              </h2>
            </div>
          </AnimatedSection>

          <div className="relative">
            {/* Ligne conductrice entre les étapes - couleurs Etsmart */}
            <div className="hidden md:block absolute top-16 left-[16.666%] right-[16.666%] h-px bg-gradient-to-r from-[#00d4ff]/40 via-[#00c9b7] to-[#00d4ff]/40" />
            <div className="grid md:grid-cols-3 gap-8 sm:gap-10 relative">
              {[
                { step: '01', icon: ShoppingBag, title: 'Choisissez votre niche', description: 'Sélectionnez une niche ou entrez la vôtre pour lancer l’analyse.' },
                { step: '02', icon: Globe, title: 'Ajoutez vos produits', description: 'Collez un lien fournisseur ou importez vos produits en un clic.' },
                { step: '03', icon: Sparkles, title: 'Obtenez votre verdict', description: 'L’IA vous donne un verdict clair : Lancer, Tester ou Éviter.' },
              ].map((item, index) => (
                <AnimatedCard key={item.step} delay={index * 0.12}>
                  <div className="relative flex flex-col items-center text-center pt-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-[#00c9b7] flex items-center justify-center mb-4 bg-[#00c9b7]/10">
                      <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#00c9b7]" strokeWidth={1.5} />
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-[#00c9b7]/90 mb-1">{item.step}</span>
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-[#00c9b7]/95 leading-snug max-w-[220px] mx-auto">{item.description}</p>
                  </div>
                </AnimatedCard>
              ))}
            </div>
            <div className="text-center mt-10 sm:mt-12">
              <Link
                href={user ? '/dashboard' : '/login'}
                className="inline-flex items-center gap-2 font-semibold text-[#00c9b7] hover:text-[#00d4ff] transition-colors"
              >
                <span className="text-[#00c9b7]">Commencer maintenant</span>
                <ArrowRight className="w-4 h-4 flex-shrink-0 text-[#00c9b7]" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-12 sm:py-16 md:py-28 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-8 sm:mb-12 md:mb-14">
              <span className="font-medium mb-2 sm:mb-3 block uppercase tracking-wider text-xs bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Tarifs</span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white px-2">Des tarifs clairs pour chaque étape</h2>
              <p className="text-white/70 text-sm sm:text-base max-w-2xl mx-auto mt-2 sm:mt-3 px-2">
                Commencez petit, mettez à l’échelle quand vous avez trouvé vos winners.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {PLANS.filter(p => p.id !== 'FREE').map((plan, index) => {
              const creditLine = plan.analysesPerMonth === -1
                ? 'Crédits illimités'
                : plan.bonusCredits
                  ? `${plan.analysesPerMonth - plan.bonusCredits} crédits + ${plan.bonusCredits} offerts`
                  : `${plan.analysesPerMonth} crédits / mois`;
              const displayPrice = plan.price === 0 ? 'Sur devis' : `€${plan.price.toFixed(2)}`;
              const displayPeriod = plan.price === 0 ? '' : '/mois';
              const isPopular = plan.id === 'SCALE';
              const handleSubscribe = async () => {
                // Si l'utilisateur n'est pas connecté, rediriger vers login
                if (!user) {
                  router.push(`/login?redirect=${encodeURIComponent('/dashboard')}&plan=${plan.id}`);
                  return;
                }

                setLoadingPlan(plan.id);

                try {
                  // Récupérer le token d'authentification Supabase
                  const { supabase } = await import('@/lib/supabase');
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;

                  // Créer une session Stripe Checkout
                  const headers: HeadersInit = {
                    'Content-Type': 'application/json',
                  };

                  // Ajouter le token d'authentification si disponible
                  if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                  }

                  const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      planId: plan.id as string,
                      userId: user.id,
                      userEmail: user.email,
                    }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    throw new Error(data.error || 'Failed to create checkout session');
                  }

                  // Rediriger vers Stripe Checkout
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    throw new Error('No checkout URL returned');
                  }
                } catch (error: any) {
                  console.error('Error creating checkout session:', error);
                  alert(error.message || 'Failed to start checkout. Please try again.');
                  setLoadingPlan(null);
                }
              };

              return (
                <AnimatedCard key={plan.name} delay={index * 0.15}>
                  <div
                    className={`relative h-full rounded-2xl border px-5 sm:px-6 py-5 sm:py-6 md:py-7 ${
                      isPopular
                        ? 'border-[#00d4ff] bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.18),_transparent_55%),_rgba(0,0,0,1)] shadow-[0_0_40px_rgba(0,212,255,0.25)]'
                        : 'border-white/10 bg-[#020408]'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/40 text-[10px] font-semibold uppercase tracking-wide text-[#00d4ff]">
                        Plus populaire
                      </div>
                    )}
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                      {plan.name.replace('Etsmart ', '')}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-white/60 mb-3">
                      {plan.description || (isPopular ? 'Parfait pour scaler avec plusieurs tests par mois.' : 'Idéal pour démarrer et valider tes premiers produits.')}
                    </p>
                    <div className="flex items-baseline gap-2 mb-3 sm:mb-4">
                      <span className="text-3xl sm:text-4xl font-bold text-white">{displayPrice}</span>
                      <span className="text-white/60 text-sm sm:text-base">{displayPeriod}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#00c9b7] mb-4">{creditLine}</p>
                    <div className="flex items-center gap-2 text-white/70 text-xs sm:text-sm mb-5">
                      <CheckCircle2 className="w-4 h-4 text-[#00c9b7] flex-shrink-0" />
                      <span>Toutes les fonctionnalités incluses</span>
                    </div>
                    <button 
                      onClick={handleSubscribe}
                      disabled={loadingPlan === plan.id}
                      className={`w-full py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isPopular
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-black hover:opacity-90'
                          : 'border border-white/20 text-white hover:border-[#00d4ff]/70'
                      }`}
                    >
                      {loadingPlan === plan.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Chargement...</span>
                        </span>
                      ) : (
                        <span>{isPopular ? 'Choisir ce plan' : 'Découvrir ce plan'}</span>
                      )}
                    </button>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>

          <AnimatedSection className="mt-10 sm:mt-12">
            <p className="text-center text-white/50 text-xs sm:text-sm mb-3">Inclus dans tous les plans</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-white/60 text-xs sm:text-sm max-w-3xl mx-auto">
              {PLANS.find(p => p.id === 'SMART')?.features.map(f => f.name).slice(0, 8).map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16 md:py-24 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
              Les questions fréquentes
            </h2>
            <p className="text-xs sm:text-sm text-white/70">
              Tout ce que les vendeurs me demandent avant d’utiliser Etsmart.
            </p>
          </AnimatedSection>
          <div className="space-y-3 sm:space-y-4">
            <FaqItem
              question="Est‑ce que mes données restent privées ?"
              answer="Oui. Tes données ne sont ni revendues ni partagées. Etsmart analyse uniquement les informations nécessaires pour générer le verdict et les projections."
            />
            <FaqItem
              question="Puis‑je utiliser Etsmart sans boutique Etsy ?"
              answer="Oui. Tu peux analyser un produit, une niche ou la concurrence même avant de créer ta boutique. C’est idéal pour valider une idée avant de te lancer."
            />
            <FaqItem
              question="Comment est calculée la projection sur 3 mois ?"
              answer="Elle repose sur la demande réelle, le niveau de concurrence, le pricing du marché et ta marge potentielle. L’IA génère trois scénarios cohérents : prudent, réaliste et optimiste."
            />
            <FaqItem
              question="Est‑ce adapté aux débutants ?"
              answer="Oui. L’analyse est automatique et le verdict est expliqué clairement. Tu sais quoi tester, pourquoi, et comment optimiser ton listing."
            />
            <FaqItem
              question="Puis‑je annuler quand je veux ?"
              answer="Oui. Le plan Pro est sans engagement. Tu peux annuler ton abonnement à tout moment, directement depuis ton espace compte."
            />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-12 sm:py-16 md:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <span className="font-medium mb-2 sm:mb-3 block uppercase tracking-wider text-xs bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Témoignages</span>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white px-2">Ils nous font confiance</h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((t, index) => (
              <AnimatedCard key={t.name} delay={index * 0.1}>
                <div className="p-4 sm:p-6 rounded-lg border border-white/5 bg-transparent">
                  <div className="flex items-center gap-1 mb-3 sm:mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <CheckCircle2 key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00c9b7]" />
                    ))}
                  </div>
                  <p className="text-white/80 mb-3 sm:mb-4 text-xs sm:text-sm leading-relaxed">&ldquo;{t.content}&rdquo;</p>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex-shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{t.name}</p>
                      <p className="text-white/60 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 sm:py-16 md:py-24 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-white mb-3 sm:mb-4 px-2">
              Prêt à lancer votre prochain succès ?
            </h2>
            <p className="text-white/70 text-sm sm:text-base mb-6 sm:mb-8 px-2">
              Rejoignez des vendeurs qui utilisent Etsmart pour prendre de meilleures décisions.
            </p>
            <Link href="/app">
              <button className="px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-sm sm:text-base font-semibold cursor-pointer border-2 bg-transparent hover:opacity-90" style={{
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              }}>
                <span className="bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent">Essayer gratuitement</span>
                <ArrowUpRight className="inline-block ml-2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00c9b7]" />
              </button>
            </Link>
            <p className="mt-3 sm:mt-4 text-white/60 text-xs sm:text-sm flex items-center justify-center gap-2">
              <Lock size={12} className="sm:w-3.5 sm:h-3.5" />
              Aucune carte de crédit requise
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-10 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <Link 
            href="/" 
            className="flex items-center gap-3 cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Logo size="sm" showText={true} />
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/60">
            <Link href="/legal" className="hover:text-white cursor-pointer">Mentions légales</Link>
            <Link href="/privacy" className="hover:text-white cursor-pointer">Confidentialité</Link>
            <Link href="/contact" className="hover:text-white cursor-pointer">Contact</Link>
          </div>
          <p className="text-white/40 text-xs sm:text-sm text-center md:text-left">© 2026 Etsmart. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
