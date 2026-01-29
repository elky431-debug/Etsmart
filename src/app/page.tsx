'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
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
  Lock,
  Menu,
  X,
  Info,
  LayoutDashboard,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  const { user, loading } = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Initialiser isMobile à true par défaut pour éviter les erreurs sur mobile au premier rendu
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  
  // Bloquer le scroll du body quand le menu est ouvert
  useEffect(() => {
    // Vérifier que document existe (évite les erreurs SSR/mobile)
    if (typeof document === 'undefined') return;
    
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [mobileMenuOpen]);
  
  // Détecter si on est sur mobile (avant useScroll pour éviter les bugs)
  useEffect(() => {
    // Vérifier que window existe (évite les erreurs SSR)
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };
    checkMobile();
    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Désactiver useScroll et useTransform sur mobile pour éviter les bugs de performance
  // useScroll doit être appelé inconditionnellement (règle des hooks React)
  // Mais on peut le désactiver fonctionnellement sur mobile
  const scrollData = useScroll();
  const { scrollYProgress } = scrollData;
  
  // Sur mobile, on retourne toujours 1 (opacité complète) sans utiliser useTransform
  const opacity = isMobile 
    ? { get: () => 1 } as any 
    : useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    // Désactiver l'effet de curseur sur mobile
    if (isMobile) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isMobile]);


  const features = [
    {
      icon: Cpu,
      title: 'Advanced AI Analysis',
      description: 'Our AI deeply analyzes the Etsy market and predicts your products\' potential.',
    },
    {
      icon: LineChart,
      title: 'Realistic Simulation',
      description: 'Simulate your sales with conservative, realistic, and optimistic projections.',
    },
    {
      icon: Target,
      title: 'Optimal Pricing',
      description: 'Receive pricing recommendations based on competition and your margins.',
    },
    {
      icon: Shield,
      title: 'Risk Detection',
      description: 'Identify saturated markets and avoid costly mistakes before launching.',
    },
    {
      icon: ShoppingBag,
      title: 'Competitor Analysis',
      description: 'Discover who dominates your niche and how to differentiate effectively.',
    },
    {
      icon: Sparkles,
      title: 'Intelligent Verdict',
      description: 'A clear and actionable verdict: Launch, Competitive Market, or Avoid.',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Products analyzed' },
    { value: '2.5K+', label: 'Active sellers' },
    { value: '95%', label: 'AI accuracy' },
    { value: '24/7', label: 'Availability' },
  ];

  const testimonials = [
    {
      name: 'Thomas Brikia',
      role: 'Etsy Pro Seller',
      content: 'Etsmart saved me from launching 3 products that would have been failures. The AI analysis is impressively accurate.',
      avatar: 'T',
      rating: 5,
    },
    {
      name: 'Samy Limam',
      role: 'Dropshipper',
      content: 'The Launch/Avoid verdict saves me hours of research. Essential for any serious seller.',
      avatar: 'S',
      rating: 5,
    },
    {
      name: 'Yosri Aulombard',
      role: 'POD Creator',
      content: 'The pricing recommendations are spot-on. I increased my margins by 40% thanks to Etsmart.',
      avatar: 'Y',
      rating: 5,
    },
  ];

  // Configuration d'animation désactivée sur mobile
  const animationConfig = isMobile ? {} : {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Cursor glow effect - Désactivé sur mobile */}
      {!isMobile && (
        <div 
          className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
          style={{
            background: `radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, rgba(0, 212, 255, 0.06), transparent 80%)`,
          }}
        />
      )}

      {/* Header */}
      <header 
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className={`${isMobile ? 'mx-0 mt-0' : 'mx-2 sm:mx-4 mt-2 sm:mt-4'}`}>
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 ${isMobile ? 'bg-white border-b border-slate-200' : 'bg-white/90 backdrop-blur-xl border border-slate-200 rounded-xl sm:rounded-2xl shadow-sm'}`}>
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="group" onClick={() => setMobileMenuOpen(false)}>
                <Logo size="md" showText={true} />
              </Link>

              {/* Navigation Desktop */}
              <nav className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Features
                </a>
                <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">
                  Pricing
                </a>
                <a href="#testimonials" className="hidden md:block text-slate-600 hover:text-slate-900 transition-colors">
                  Testimonials
                </a>
                <Link href="/about" className="text-slate-600 hover:text-slate-900 transition-colors">
                  About
                </Link>
              </nav>

              {/* CTA Desktop */}
              <div className="hidden md:flex items-center gap-4">
                {!loading && user ? (
                  // Utilisateur connecté - afficher seulement Dashboard
                  <Link href="/dashboard?section=analyze">
                    <button className="px-5 py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                      <span className="text-white">Dashboard</span>
                      <ArrowRight size={16} className="text-white" />
                    </button>
                  </Link>
                ) : (
                  // User not logged in - show Login and Create account
                  <>
                    <Link href="/login" className="text-slate-600 hover:text-slate-900 transition-colors">
                      Login
                    </Link>
                    <Link href="/register">
                      <button className="px-5 py-2.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all">
                        <span className="text-white">Create account</span>
                        <ArrowRight size={16} className="text-white" />
                      </button>
                    </Link>
                  </>
                )}
              </div>

              {/* Menu Button Mobile - Ultra réactif */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMobileMenuOpen(prev => !prev);
                }}
                className="md:hidden w-10 h-10 rounded-lg bg-gradient-to-br from-[#00d4ff] to-[#00c9b7] flex items-center justify-center shadow-lg shadow-[#00d4ff]/30 active:scale-95 transition-transform duration-100 touch-manipulation"
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
        </div>

        {/* Mobile Menu - Ultra optimisé pour mobile */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop - Affichage immédiat sans animation */}
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'none'
              }}
            />
            
            {/* Menu Panel - Affichage immédiat */}
            <div
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-white rounded-2xl shadow-2xl z-50 md:hidden overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ 
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'auto'
              }}
            >
                <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                  {/* Header */}
                  <div className="pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <Logo size="md" showText={false} />
                      <span className="text-xl font-bold text-slate-900">
                        Menu
                      </span>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <nav className="space-y-1.5">
                    <a
                      href="#features"
                      onClick={(e) => {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        setTimeout(() => {
                          document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 active:bg-gradient-to-r active:from-[#00d4ff]/10 active:to-[#00c9b7]/10 active:text-slate-900 touch-manipulation"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[#00d4ff]" />
                      </div>
                      <span className="font-semibold">Features</span>
                    </a>
                    
                    <Link
                      href="/about"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 active:bg-gradient-to-r active:from-[#00d4ff]/10 active:to-[#00c9b7]/10 active:text-slate-900 touch-manipulation"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#00d4ff]/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-[#00d4ff]" />
                      </div>
                      <span className="font-semibold">About</span>
                    </Link>
                  </nav>

                  {/* Divider */}
                  <div className="pt-2 border-t border-slate-200" />

                  {/* CTA Section */}
                  <div className="space-y-2.5">
                    {!loading && user ? (
                      <Link href="/dashboard?section=analyze" onClick={() => setMobileMenuOpen(false)}>
                        <button className="w-full px-4 py-3.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00d4ff]/30 active:opacity-90 touch-manipulation">
                          <LayoutDashboard size={20} />
                          <span>Dashboard</span>
                          <ArrowRight size={18} />
                        </button>
                      </Link>
                    ) : (
                      <>
                        <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                          <button className="w-full px-4 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-xl active:bg-slate-50 touch-manipulation">
                            Login
                          </button>
                        </Link>
                        <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                          <button className="w-full px-4 py-3.5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00d4ff]/30 active:opacity-90 touch-manipulation">
                            <span>Create account</span>
                            <ArrowRight size={18} />
                          </button>
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                      Quick Actions
                    </p>
                    <Link href="/app" onClick={() => setMobileMenuOpen(false)}>
                      <button className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-2 active:bg-slate-100 touch-manipulation">
                        <Play size={18} className="text-[#00d4ff]" />
                        <span>Analyze my product</span>
                      </button>
                    </Link>
                  </div>
                </div>
            </div>
          </>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-32 overflow-hidden bg-white">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00d4ff]/5 to-transparent" />
        <div className="absolute top-40 left-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-[#00c9b7]/5 rounded-full blur-[100px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 mb-6 sm:mb-8">
              <span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
              <span className="text-sm text-slate-700">Powered by AI • GPT-4</span>
              <Cpu className="w-4 h-4 text-[#00d4ff]" />
            </div>

            {/* Main headline */}
            <h1 className="text-2xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-4 sm:mb-8 px-4 sm:px-0">
              <span className="text-slate-900">Launch profitable products</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">on Etsy</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4 sm:px-0">
              Our AI analyzes your AliExpress products and reveals{' '}
              <span className="text-slate-900 font-medium">their real potential</span> on Etsy.
              <br className="hidden sm:block" />
              No more costly failures, launch with confidence.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-16 px-4 sm:px-0">
              <Link href="/app" className="w-full sm:w-auto">
                <button className="group w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-8 py-2.5 sm:py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white font-semibold rounded-full shadow-xl shadow-[#00d4ff]/20 hover:shadow-[#00d4ff]/30 transition-all btn-mobile">
                  <Play size={16} className="fill-white sm:w-[18px] sm:h-[18px]" />
                  <span className="text-sm sm:text-base">Analyze my product</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform sm:w-[18px] sm:h-[18px]" />
                </button>
              </Link>
              <a href="#features" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 sm:py-4 bg-white border border-slate-200 text-slate-800 font-medium rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all btn-mobile">
                  <span className="text-sm sm:text-base">Discover features</span>
                  <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] mb-1">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator - Désactivé sur mobile */}
        {!isMobile && (
          <motion.div
            style={{ opacity: isMobile ? 1 : (typeof opacity?.get === 'function' ? opacity.get() : 1) }}
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
        )}
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-20">
            <span className="text-[#00d4ff] font-medium mb-3 sm:mb-4 block uppercase tracking-wider text-xs sm:text-sm">Features</span>
            <h2 className="text-2xl sm:text-4xl sm:text-5xl font-bold mb-4 sm:mb-6">
              <span className="text-slate-900">Everything you need to</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">dominate on Etsy</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-lg px-4 sm:px-0">
              A complete suite of AI tools to analyze, simulate and optimize 
              your product launches.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-4 sm:p-8 bg-white border border-slate-200 rounded-2xl sm:rounded-3xl hover:border-[#00d4ff]/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#00d4ff] flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2 sm:mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-32 relative overflow-hidden bg-white">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[150px]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">How it works</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Analyze in</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">3 steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                icon: ShoppingBag,
                title: 'Choose your niche',
                description: 'Select from our popular niches or enter your own.',
              },
              {
                step: '02',
                icon: Globe,
                title: 'Add your products',
                description: 'Paste the AliExpress link or enter your product details.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Get your verdict',
                description: 'Our AI analyzes and gives you a clear and actionable verdict.',
              },
            ].map((item, index) => (
              <div
                key={item.step}
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
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-16">
            <Link href="/app">
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white font-semibold rounded-full shadow-lg shadow-[#00d4ff]/20 transition-all">
                Get started now
                <ArrowRight size={18} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-32 relative bg-slate-50">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Pricing</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">Transparent</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">pricing</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              Start for free, upgrade when you're ready.
            </p>
          </div>

          {/* Plans */}
          <div className="hidden md:grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Smart',
                price: '€19.99',
                period: '/month',
                description: 'Perfect for sellers who want to test products seriously. All features included.',
                features: ['30 analyses / month', 'All features included'],
                cta: 'Get started',
                popular: false,
              },
              {
                name: 'Pro',
                price: '€29.99',
                period: '/month',
                description: 'Ideal for active sellers who analyze multiple products monthly. All features included.',
                features: ['60 analyses / month', 'All features included'],
                cta: 'Choose plan',
                popular: true,
              },
              {
                name: 'Scale',
                price: '€49.99',
                period: '/month',
                description: 'For high-volume shops testing many products strategically. All features included.',
                features: ['100 analyses / month', 'All features included'],
                cta: 'Choose plan',
                popular: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-3xl ${
                  plan.popular 
                    ? 'bg-white border-2 border-[#00d4ff] shadow-xl' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-[#00d4ff] text-white text-sm font-semibold rounded-full shadow-lg">
                      Most popular
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
                        <CheckCircle2 className="w-3 h-3 text-[#00d4ff]" />
                      </div>
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link href="/pricing">
                  <button 
                    className={`w-full py-3.5 rounded-full font-semibold transition-all ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white shadow-lg shadow-[#00d4ff]/20' 
                        : 'bg-slate-100 border border-slate-200 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          {/* Version mobile simplifiée */}
          <div className="md:hidden grid grid-cols-1 gap-6 max-w-md mx-auto">
            {[
              {
                name: 'Smart',
                price: '€19.99',
                period: '/month',
                analysesCount: '30 analyses / month',
                popular: false,
              },
              {
                name: 'Pro',
                price: '€29.99',
                period: '/month',
                analysesCount: '60 analyses / month',
                popular: true,
              },
              {
                name: 'Scale',
                price: '€49.99',
                period: '/month',
                analysesCount: '100 analyses / month',
                popular: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl ${
                  plan.popular 
                    ? 'bg-white border-2 border-[#00d4ff] shadow-lg' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-[#00d4ff] text-white text-xs font-semibold rounded-full">
                      Popular
                    </span>
                  </div>
                )}
                
                <h3 className="text-lg font-semibold text-slate-900 mb-1 text-center">{plan.name}</h3>
                
                <div className="flex items-baseline justify-center gap-1 mb-4">
                  <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00d4ff]/10 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-[#00d4ff]" />
                    <span className="text-slate-900 font-semibold">{plan.analysesCount}</span>
                  </div>
                </div>
                
                <Link href="/pricing">
                  <button 
                    className={`w-full py-3 rounded-full font-semibold text-sm ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] hover:opacity-90 text-white shadow-lg shadow-[#00d4ff]/20' 
                        : 'bg-slate-100 border border-slate-200 text-slate-800'
                    }`}
                  >
                    Choose plan
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Masqué sur mobile pour réduire la latence */}
      <section id="testimonials" className="hidden md:block py-16 sm:py-32 relative bg-white">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="text-[#00d4ff] font-medium mb-4 block uppercase tracking-wider text-sm">Testimonials</span>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-slate-900">They trust</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#00c9b7]">us</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.name}
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-32 relative overflow-hidden bg-[#00d4ff]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00b8e6] to-[#00c9b7] opacity-50" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/10 rounded-full blur-[150px]" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 text-white">
              Ready to launch your
              <br />
              next success?
            </h2>
            <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
              Join thousands of sellers using Etsmart to 
              make better decisions and maximize their profits.
            </p>
            <Link href="/app">
              <button className="group inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-[#00d4ff] to-[#00c9b7] text-white text-lg font-semibold rounded-full shadow-xl hover:shadow-2xl transition-all">
                Start for free
                <ArrowUpRight size={20} className="text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </Link>
            <p className="mt-6 text-white/60 text-sm flex items-center justify-center gap-2">
              <Lock size={14} />
              No credit card required
            </p>
          </div>
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
              <Link href="/legal" className="hover:text-slate-900 transition-colors">Legal</Link>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
            </div>
            
            <p className="text-sm text-slate-400">
              © 2026 Etsmart. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
