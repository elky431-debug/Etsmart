'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Target, Zap, Shield, Cpu, ArrowRight, Play, CheckCircle2, Eye } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import Link from 'next/link';

export default function AboutPage() {
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
              <Link href="/" className="group">
                <Logo size="md" showText={true} />
              </Link>
              <Link href="/">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-full transition-all">
                  <ArrowLeft size={16} />
                  Retour
                </button>
              </Link>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 sm:pt-36 sm:pb-20 overflow-hidden">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-sm text-slate-700">Propulsé par l'IA</span>
              <Cpu className="w-4 h-4 text-[#00d4ff]" />
            </motion.div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            >
              <span className="text-slate-900">À propos de</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">Etsmart</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed"
            >
              L'outil d'analyse IA qui transforme vos idées de produits en{' '}
              <span className="text-slate-900 font-medium">succès sur Etsy</span>.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mb-12 sm:mb-16"
        >
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#00d4ff]/5 to-[#00c9b7]/5 border border-[#00d4ff]/20">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] flex items-center justify-center">
                <Target size={24} className="text-white sm:w-7 sm:h-7" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Notre Mission</h2>
            </div>
            <div className="space-y-3 sm:space-y-4 text-base sm:text-lg text-slate-700 leading-relaxed">
              <p>
                Etsmart a été créé pour aider les vendeurs Etsy à prendre des décisions éclairées avant de lancer leurs produits.
                Nous croyons que chaque produit mérite sa chance de réussir—mais uniquement s'il est lancé au bon moment,
                au bon prix, avec la bonne stratégie.
              </p>
              <p>
                Grâce à <strong className="text-slate-900">notre IA avancée</strong>, nous analysons vos produits AliExpress et fournissons une analyse complète incluant :
                un <strong className="text-[#00d4ff]">Score de Potentiel de Lancement</strong> (0-10), une analyse concurrentielle, des recommandations de prix,
                une simulation de lancement, et une stratégie marketing complète avec des tags SEO, des titres viraux et des idées de publicités.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mb-12 sm:mb-16"
        >
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-[#00d4ff] font-medium mb-3 block uppercase tracking-wider text-xs sm:text-sm">Pourquoi Etsmart</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              <span className="text-slate-900">Ce qui nous rend</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">uniques</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {[
              {
                icon: Eye,
                title: 'Analyse IA basée sur l\'image',
                description: "Notre IA analyse l'image de votre produit—pas seulement le titre—pour une analyse plus précise et fiable.",
                color: 'from-violet-500 to-purple-500',
              },
              {
                icon: Target,
                title: 'Score de Potentiel de Lancement',
                description: 'Obtenez un score clair de 0 à 10 qui évalue la saturation du marché, la densité de la concurrence et la spécificité du produit pour guider votre décision de lancement.',
                color: 'from-[#00d4ff] to-[#00c9b7]',
              },
              {
                icon: Zap,
                title: 'Rapidité',
                description: 'Obtenez une analyse complète en quelques secondes—plus besoin d\'heures de recherche manuelle.',
                color: 'from-amber-500 to-orange-500',
              },
              {
                icon: Shield,
                title: 'Fiabilité',
                description: 'Basé sur de vrais signaux du marché Etsy et de la concurrence—pas sur des suppositions approximatives.',
                color: 'from-emerald-500 to-teal-500',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="group p-6 sm:p-8 bg-white border-2 border-slate-200 rounded-2xl sm:rounded-3xl hover:border-[#00d4ff]/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon size={24} className="text-white sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 sm:mb-3">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] p-8 sm:p-12 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#00b8e6] to-[#00c9b7] opacity-50" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[500px] h-[400px] sm:h-[500px] bg-white/10 rounded-full blur-[120px]" />
          
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4 sm:mb-6"
            >
              <CheckCircle2 size={32} className="text-white sm:w-10 sm:h-10" />
            </motion.div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-white">
              Prêt à lancer votre
              <br />
              premier produit ?
            </h2>
            <p className="text-white/90 mb-6 sm:mb-8 text-base sm:text-lg max-w-2xl mx-auto">
              Commencez gratuitement et découvrez le potentiel de vos produits en quelques secondes.
            </p>
            <Link href="/app">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group inline-flex items-center gap-2 sm:gap-3 px-8 sm:px-10 py-4 sm:py-5 bg-white text-[#00d4ff] text-base sm:text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all"
              >
                <Play size={18} className="fill-[#00d4ff] sm:w-5 sm:h-5" />
                Commencer maintenant
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform sm:w-5 sm:h-5" />
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="py-8 sm:py-12 border-t border-slate-200 bg-white mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            <Link href="/">
              <Logo size="md" showText={true} />
            </Link>
            
            <div className="flex items-center gap-6 sm:gap-8 text-sm text-slate-500">
              <Link href="/about" className="hover:text-slate-900 transition-colors">À propos</Link>
              <Link href="/legal" className="hover:text-slate-900 transition-colors">Mentions légales</Link>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">Confidentialité</Link>
              <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
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

