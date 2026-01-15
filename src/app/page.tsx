'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, 
  Check, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  Shield,
  Zap,
  BarChart3,
  Target,
  Users,
  Star,
  Play,
  ChevronRight,
  Cpu,
  LineChart,
  ShoppingBag,
  ArrowUpRight,
  Globe,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  const { user, loading } = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: Cpu,
      title: 'Analyse IA avancée',
      description: 'Notre IA analyse en profondeur le marché Etsy et prédit le potentiel de vos produits.',
    },
    {
      icon: LineChart,
      title: 'Simulation réaliste',
      description: 'Simulez vos ventes avec des projections prudentes, réalistes et optimistes.',
    },
    {
      icon: Target,
      title: 'Prix optimal',
      description: 'Recevez des recommandations de prix basées sur la concurrence et vos marges.',
    },
    {
      icon: Shield,
      title: 'Détection des risques',
      description: 'Identifiez les marchés saturés et évitez les erreurs coûteuses avant de lancer.',
    },
    {
      icon: ShoppingBag,
      title: 'Analyse concurrents',
      description: 'Découvrez qui domine votre niche et comment vous différencier efficacement.',
    },
    {
      icon: Sparkles,
      title: 'Verdict intelligent',
      description: 'Un verdict clair et actionnable : Lancer, Marché concurrentiel, ou Éviter.',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Produits analysés' },
    { value: '2.5K+', label: 'Vendeurs actifs' },
    { value: '95%', label: 'Précision IA' },
    { value: '24/7', label: 'Disponibilité' },
  ];

  const testimonials = [
    {
      name: 'Marie Laurent',
      role: 'Vendeuse Etsy Pro',
      content: 'Etsmart m\'a évité de lancer 3 produits qui auraient été des échecs. L\'analyse IA est bluffante de précision.',
      avatar: 'M',
      rating: 5,
    },
    {
      name: 'Thomas Dubois',
      role: 'Dropshipper',
      content: 'Le verdict Lancer/Éviter me fait gagner des heures de recherche. Indispensable pour tout vendeur sérieux.',
      avatar: 'T',
      rating: 5,
    },
    {
      name: 'Sophie Martin',
      role: 'Créatrice POD',
      content: 'Les recommandations de prix sont spot-on. J\'ai augmenté mes marges de 40% grâce à Etsmart.',
      avatar: 'S',
      rating: 5,
    },
  ];

  const plans = [
    {
      name: 'Starter',
      price: '0€',
      period: 'gratuit',
      description: 'Pour découvrir la puissance d\'Etsmart',
      features: ['3 analyses / mois', 'Analyse IA basique', 'Verdict simplifié', 'Support communauté'],
      cta: 'Commencer',
      popular: false,
    },
    {
      name: 'Pro',
      price: '29€',
      period: '/mois',
      description: 'Pour les vendeurs qui veulent dominer',
      features: ['Analyses illimitées', 'IA avancée GPT-4', 'Simulation complète', 'Titres SEO viraux', 'Support prioritaire'],
      cta: 'Essayer 7 jours',
      popular: true,
    },
    {
      name: 'Agency',
      price: '79€',
      period: '/mois',
      description: 'Pour les équipes et agences',
      features: ['Tout dans Pro', 'Multi-boutiques', 'API access', 'Export rapports', 'Account manager dédié'],
      cta: 'Nous contacter',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Cursor glow effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 212, 255, 0.06), transparent 80%)`,
        }}
      />

      {/* Header */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="mx-4 mt-4">
          <div className="max-w-7xl mx-auto px-6 py-4 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="group">
                <Logo size="md" showText={true} />
              </Link>

              {/* Navigation */}
              <nav className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Fonctionnalités
                </a>
                <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Tarifs
                </a>
                <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Témoignages
                </a>
                <Link href="/about" className="text-slate-600 hover:text-slate-900 transition-colors">
                  À propos
                </Link>
              </nav>

              {/* CTA */}
              <div className="flex items-center gap-4">
                {!loading && user ? (
                  // Utilisateur connecté - afficher seulement Dashboard
                  <Link href="/dashboard">
                    <button className="px-5 py-2.5 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                      <span className="text-white">Dashboard</span>
                      <ArrowRight size={16} className="text-white" />
                    </button>
                  </Link>
                ) : (
                  // Utilisateur non connecté - afficher Connexion et Créer un compte
                  <>
                    <Link href="/login" className="hidden sm:block text-slate-600 hover:text-slate-900 transition-colors">
                      Connexion
                    </Link>
                    <Link href="/register">
                      <button className="px-5 py-2.5 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                        <span className="text-white">Créer un compte</span>
                        <ArrowRight size={16} className="text-white" />
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
        <div className="absolute top-40 left-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#00c9b7]/5 rounded-full blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-sm text-slate-700">Propulsé par l&apos;IA • GPT-4</span>
              <Cpu className="w-4 h-4 text-[#00d4ff]" />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-8"
            >
              <span className="text-slate-900">Lancez des produits</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">rentables sur Etsy</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Notre IA analyse vos produits AliExpress et vous révèle{' '}
              <span className="text-slate-900 font-medium">leur potentiel réel</span> sur Etsy.
              <br className="hidden sm:block" />
              Fini les échecs coûteux, lancez en toute confiance.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link href="/app">
                <button className="group flex items-center gap-3 px-8 py-4 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full shadow-xl shadow-[#00d4ff]/20 hover:shadow-[#00d4ff]/30 transition-all">
                  <Play size={18} className="fill-white" />
                  Analyser mon produit
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <a href="#features">
                <button className="flex items-center gap-2 px-8 py-4 bg-white border border-slate-200 text-slate-800 font-medium rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all">
                  Découvrir les fonctionnalités
                  <ChevronRight size={18} />
                </button>
              </a>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          style={{ opacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex justify-center pt-2">
            <motion.div 
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Fonctionnalités</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Tout ce qu&apos;il faut pour</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">dominer sur Etsy</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Une suite complète d&apos;outils IA pour analyser, simuler et optimiser 
              vos lancements de produits.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group p-8 bg-white border border-slate-200 rounded-3xl hover:border-[#00d4ff]/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#00d4ff] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[150px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Comment ça marche</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Analysez en</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">3 étapes</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                icon: ShoppingBag,
                title: 'Choisissez votre niche',
                description: 'Sélectionnez parmi nos niches populaires ou entrez la vôtre.',
              },
              {
                step: '02',
                icon: Globe,
                title: 'Ajoutez vos produits',
                description: 'Collez le lien AliExpress ou entrez les détails de votre produit.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Recevez votre verdict',
                description: 'Notre IA analyse et vous donne un verdict clair et actionnable.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {/* Connector line */}
                {index < 2 && (
                  <div className="hidden md:block absolute top-20 left-full w-full h-px">
                    <div className="w-3/4 h-full bg-gradient-to-r from-[#00d4ff]/50 to-transparent" />
                  </div>
                )}
                
                <div className="text-center">
                  <div className="relative inline-flex mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <item.icon className="w-8 h-8 text-[#00d4ff]" />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#00d4ff] flex items-center justify-center text-sm font-bold text-white shadow-lg">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Link href="/app">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-[#00d4ff] hover:bg-[#00b8e6] text-white font-semibold rounded-full shadow-lg shadow-[#00d4ff]/20 transition-all">
                Commencer maintenant
                <ArrowRight size={18} />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Tarifs</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Des prix</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">transparents</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Commencez gratuitement, évoluez quand vous êtes prêt.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative p-8 rounded-3xl ${
                  plan.popular 
                    ? 'bg-white border-2 border-[#00d4ff] shadow-xl' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-[#00d4ff] text-white text-sm font-semibold rounded-full shadow-lg">
                      Le plus populaire
                    </span>
                  </div>
                )}
                
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-6">{plan.description}</p>
                
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#00d4ff]/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-[#00d4ff]" />
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/app">
                  <button 
                    className={`w-full py-3.5 rounded-full font-semibold transition-all ${
                      plan.popular 
                        ? 'bg-[#00d4ff] hover:bg-[#00b8e6] text-white shadow-lg shadow-[#00d4ff]/20' 
                        : 'bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-32 relative bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Témoignages</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Ils nous font</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">confiance</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 bg-slate-50 border border-slate-200 rounded-3xl"
              >
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-8 leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#00d4ff] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden bg-[#00d4ff]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00b8e6] to-[#00c9b7] opacity-50" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 rounded-full blur-[150px]" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 text-white">
              Prêt à lancer votre
              <br />
              prochain succès ?
            </h2>
            <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
              Rejoignez des milliers de vendeurs qui utilisent Etsmart pour 
              prendre de meilleures décisions et maximiser leurs profits.
            </p>
            <Link href="/app">
              <button className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all">
                Commencer gratuitement
                <ArrowUpRight size={20} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </Link>
            <p className="mt-6 text-white/60 text-sm flex items-center justify-center gap-2">
              <Lock size={14} />
              Aucune carte bancaire requise
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00d4ff] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                Ets<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">mart</span>
              </span>
            </Link>
            
            <div className="flex items-center gap-8 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-900 transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Contact</a>
            </div>
            
            <p className="text-sm text-slate-400">
              © 2026 Etsmart. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
