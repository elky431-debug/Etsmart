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
  CheckCircle2,
  Globe,
  ArrowUpRight,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { motion, useInView } from 'framer-motion';

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

export default function HomePage() {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);

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
      title: 'Analyse concurrentielle',
      description: 'Identifiez les leaders et les angles exploitables de votre niche.',
    },
    {
      icon: BarChart3,
      title: 'Verdict intelligent',
      description: 'Un verdict clair et actionnable : Lancer, Tester ou Éviter.',
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
                <a href="#features" className={`transition-colors cursor-pointer ${
                  process.env.NODE_ENV === 'development' 
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]' 
                    : 'text-white/90 hover:text-white'
                }`}>Fonctionnalités</a>
                <a href="#how" className={`transition-colors cursor-pointer ${
                  process.env.NODE_ENV === 'development' 
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]' 
                    : 'text-white/90 hover:text-white'
                }`}>Comment ça marche</a>
                <a href="#pricing" className={`transition-colors cursor-pointer ${
                  process.env.NODE_ENV === 'development' 
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent hover:from-[#00d4ff] hover:to-[#00c9b7]' 
                    : 'text-white/90 hover:text-white'
                }`}>Tarifs</a>
              </nav>

              {/* CTA Desktop */}
              <div className="hidden md:flex items-center gap-3">
                {!loading && user ? (
                  <Link href="/dashboard?section=analyze">
                    <button className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                      process.env.NODE_ENV === 'development' 
                        ? 'border-2 bg-transparent hover:opacity-90' 
                        : 'force-white shadow-black/30'
                    }`} style={process.env.NODE_ENV === 'development' ? {
                      borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                      borderImageSlice: 1,
                    } : {}}>
                      <span className={process.env.NODE_ENV === 'development' 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                        : 'text-black'}>Tableau de bord</span>
                      <ArrowRight size={14} className={process.env.NODE_ENV === 'development' ? 'text-[#00c9b7]' : 'text-black'} />
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-sm text-white/90 hover:text-white transition-colors px-3 py-2 cursor-pointer">
                      Connexion
                    </Link>
                    <Link href="/register">
                      <button className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                        process.env.NODE_ENV === 'development' 
                          ? 'border-2 bg-transparent hover:opacity-90' 
                          : 'force-white shadow-black/30'
                      }`} style={process.env.NODE_ENV === 'development' ? {
                        borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                        borderImageSlice: 1,
                      } : {}}>
                        <span className={process.env.NODE_ENV === 'development' 
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                          : 'text-black'}>Inscription</span>
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
                    <button className={`w-full px-4 py-3.5 font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer ${
                      process.env.NODE_ENV === 'development' 
                        ? 'border-2 bg-transparent hover:opacity-90' 
                        : 'force-white'
                    }`} style={process.env.NODE_ENV === 'development' ? {
                      borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                      borderImageSlice: 1,
                    } : {}}>
                      <span className={process.env.NODE_ENV === 'development' 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                        : 'text-black'}>Tableau de bord</span>
                      <ArrowRight size={18} className={process.env.NODE_ENV === 'development' ? 'text-[#00c9b7]' : 'text-black'} />
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
                      <button className={`w-full px-4 py-3.5 font-semibold rounded-lg cursor-pointer ${
                        process.env.NODE_ENV === 'development' 
                          ? 'border-2 bg-transparent hover:opacity-90' 
                          : 'force-white'
                      }`} style={process.env.NODE_ENV === 'development' ? {
                        borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                        borderImageSlice: 1,
                      } : {}}>
                        <span className={process.env.NODE_ENV === 'development' 
                          ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                          : 'text-black'}>Inscription</span>
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
      <section className="relative min-h-screen flex items-end justify-center pb-24 sm:pb-28 overflow-hidden">
        {/* Spline Background - uniquement dans la landing */}
        <div className="absolute inset-0" id="spline-container" />
        <div className="relative z-10 text-center px-6">
          <div className="flex items-center justify-center gap-4">
            <Link href="/app">
              <button className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 cursor-pointer ${
                process.env.NODE_ENV === 'development' 
                  ? 'border-2 bg-transparent hover:opacity-90' 
                  : 'force-white'
              }`} style={process.env.NODE_ENV === 'development' ? {
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              } : {}}>
                <span className={process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-black'}>Essayer gratuitement</span>
                <ArrowRight size={16} className={process.env.NODE_ENV === 'development' ? 'text-[#00c9b7]' : 'text-black'} />
              </button>
            </Link>
            <Link href="#pricing">
              <button className={`px-6 py-3 rounded-lg bg-transparent font-semibold transition-colors cursor-pointer ${
                process.env.NODE_ENV === 'development' 
                  ? 'border-2 hover:opacity-90' 
                  : 'border border-white/30 text-white hover:bg-white/10'
              }`} style={process.env.NODE_ENV === 'development' ? {
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              } : {}}>
                <span className={process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-white'}>Voir les tarifs</span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-12 sm:mb-16">
              <span className={`font-medium mb-3 block uppercase tracking-wider text-xs sm:text-sm ${
                process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-[#00d4ff]'
              }`}>Fonctionnalités</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">
                Tout ce qu’il faut pour dominer sur Etsy
              </h2>
              <p className="text-white/70 max-w-2xl mx-auto mt-3">
                Une suite complète d’outils IA pour analyser, simuler et optimiser vos lancements.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <AnimatedCard key={feature.title} delay={index * 0.1}>
                <div className="p-6 sm:p-8 rounded-lg border border-white/5 bg-transparent hover:border-white/10 transition-colors">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 ${
                    process.env.NODE_ENV === 'development' 
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]' 
                      : 'bg-[#00d4ff]'
                  }`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 sm:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-12 sm:mb-16">
              <span className={`font-medium mb-3 block uppercase tracking-wider text-xs sm:text-sm ${
                process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-[#00d4ff]'
              }`}>Comment ça marche</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">
                Analysez en 3 étapes
              </h2>
            </div>
          </AnimatedSection>

          <div className="relative">
            {/* Ligne conductrice */}
            <div className="hidden md:block absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '01', icon: ShoppingBag, title: 'Choisissez votre niche', description: 'Sélectionnez une niche ou entrez la vôtre.' },
                { step: '02', icon: Globe, title: 'Ajoutez vos produits', description: 'Collez un lien fournisseur ou importez vos produits.' },
                { step: '03', icon: Sparkles, title: 'Obtenez votre verdict', description: 'Notre IA vous donne un verdict clair et actionnable.' },
              ].map((item, index) => (
                <AnimatedCard key={item.step} delay={index * 0.15}>
                  <div className="relative p-6 pt-10 rounded-lg border border-white/5 bg-transparent">
                    <div className={`absolute -top-5 left-6 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                      process.env.NODE_ENV === 'development' 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] shadow-[#00d4ff]/30' 
                        : 'bg-[#00d4ff] shadow-[#00d4ff]/30'
                    }`}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-white/60 text-xs font-semibold mb-2">{item.step}</div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-white/70 text-sm">{item.description}</p>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-12 sm:mb-16">
              <span className={`font-medium mb-3 block uppercase tracking-wider text-xs sm:text-sm ${
                process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-[#00d4ff]'
              }`}>Tarifs</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">Des tarifs transparents</h2>
              <p className="text-white/70 max-w-2xl mx-auto mt-3">
                Commencez gratuitement, passez à la vitesse supérieure quand vous êtes prêt.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Smart', price: '€19.99', period: '/mois', features: ['30 analyses / mois', 'Toutes les fonctionnalités'] },
              { name: 'Pro', price: '€29.99', period: '/mois', features: ['60 analyses / mois', 'Toutes les fonctionnalités'], popular: true },
              { name: 'Scale', price: '€49.99', period: '/mois', features: ['100 analyses / mois', 'Toutes les fonctionnalités'] },
            ].map((plan, index) => (
              <AnimatedCard key={plan.name} delay={index * 0.15}>
                <div
                  className={`p-6 rounded-lg border ${
                    plan.popular ? 'border-[#00d4ff] bg-transparent' : 'border-white/5 bg-transparent'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-white/60">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-white/80 text-sm">
                        <CheckCircle2 className={`w-4 h-4 ${
                          process.env.NODE_ENV === 'development' 
                            ? 'text-[#00c9b7]' 
                            : 'text-[#00d4ff]'
                        }`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-3 rounded-lg font-semibold cursor-pointer ${
                    process.env.NODE_ENV === 'development' 
                      ? 'border-2 bg-transparent hover:opacity-90' 
                      : 'force-white'
                  }`} style={process.env.NODE_ENV === 'development' ? {
                    borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                    borderImageSlice: 1,
                  } : {}}>
                    <span className={process.env.NODE_ENV === 'development' 
                      ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                      : 'text-black'}>Choisir ce plan</span>
                  </button>
                </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-28 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="text-center mb-12 sm:mb-16">
              <span className={`font-medium mb-3 block uppercase tracking-wider text-xs sm:text-sm ${
                process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-[#00d4ff]'
              }`}>Témoignages</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">Ils nous font confiance</h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, index) => (
              <AnimatedCard key={t.name} delay={index * 0.1}>
                <div className="p-6 rounded-lg border border-white/5 bg-transparent">
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <CheckCircle2 key={i} className={`w-4 h-4 ${
                        process.env.NODE_ENV === 'development' 
                          ? 'text-[#00c9b7]' 
                          : 'text-[#00d4ff]'
                      }`} />
                    ))}
                  </div>
                  <p className="text-white/80 mb-4 text-sm leading-relaxed">&ldquo;{t.content}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      process.env.NODE_ENV === 'development' 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]' 
                        : 'bg-[#00d4ff]'
                    }`}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{t.name}</p>
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
      <section className="py-16 sm:py-24 bg-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AnimatedSection>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              Prêt à lancer votre prochain succès ?
            </h2>
            <p className="text-white/70 mb-8">
              Rejoignez des vendeurs qui utilisent Etsmart pour prendre de meilleures décisions.
            </p>
            <Link href="/app">
              <button className={`px-8 py-4 rounded-lg font-semibold cursor-pointer ${
                process.env.NODE_ENV === 'development' 
                  ? 'border-2 bg-transparent hover:opacity-90' 
                  : 'force-white'
              }`} style={process.env.NODE_ENV === 'development' ? {
                borderImage: 'linear-gradient(to right, #00d4ff, #00c9b7) 1',
                borderImageSlice: 1,
              } : {}}>
                <span className={process.env.NODE_ENV === 'development' 
                  ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] bg-clip-text text-transparent' 
                  : 'text-black'}>Commencer gratuitement</span>
                <ArrowUpRight className={`inline-block ml-2 w-4 h-4 ${process.env.NODE_ENV === 'development' ? 'text-[#00c9b7]' : 'text-black'}`} />
              </button>
            </Link>
            <p className="mt-4 text-white/60 text-sm flex items-center justify-center gap-2">
              <Lock size={14} />
              Aucune carte de crédit requise
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
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
          <div className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/legal" className="hover:text-white cursor-pointer">Mentions légales</Link>
            <Link href="/privacy" className="hover:text-white cursor-pointer">Confidentialité</Link>
            <Link href="/contact" className="hover:text-white cursor-pointer">Contact</Link>
          </div>
          <p className="text-white/40 text-sm">© 2026 Etsmart. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
